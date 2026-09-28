import { Tracer } from "@luna/core";
import { ContextMenu, MediaItem, safeInterval, type MediaCollection } from "@luna/lib";

import { getDownloadFolder, getDownloadPath, getFileName } from "./helpers";
import { isDownloaded, markDownloaded } from "./downloadHistory";
import { fileExists } from "./fs.native";
import { saveMetaForTrack } from "./trackMeta";
import { unloads } from "./index.safe";
import { settings } from "./Settings";
import { FavoriteTracks } from "./favoriteTracks";
import { saveLyricsForTrack } from "./trackLyrics";
import {
	downloadState,
	setBannerCurrent,
	setBannerDone,
	setBannerFileProgress,
	setBannerStatus,
	setBannerTotal,
} from "./downloadBanner";

export type CtxButton = ReturnType<typeof ContextMenu.addButton>;
export type JobStatus = "queued" | "active" | "done" | "stopped";
export type JobKind = "favorites" | "collection";

export type QueueJob = {
	id: number;
	kind: JobKind;
	title: string;
	total: number;
	done: number;
	succeeded: number;
	failed: number;
	skipped: number;
	status: JobStatus;
	collection: MediaCollection;
	uiButton?: CtxButton;
	/** Dossier de destination spécifique au job (sinon dossier par défaut). */
	folderOverride?: string;
	/** Tracks en cours de traitement par les workers (clé unique -> détail). */
	current: Map<string, ActiveTrack>;
	/** Ligne dépliée dans la fenêtre (voir les tracks en cours). */
	tracksOpen?: boolean;
};

export type ActiveTrack = {
	key: string;
	label: string;
	cover?: string;
	downloaded?: number;
	total?: number;
};

const { trace } = Tracer("[SongDownloader][Queue]");

// Workers concurrents par job. Note : le core Luna sérialise le fetch des flux
// audio côté natif (Semaphore 1) ; le gain vient de la parallélisation de tout
// le reste : RealMAX, tags/MusicBrainz, playbackInfo, filenames et lyrics.
const MAX_CONCURRENT = 5;

// Résolution d'un item : 3 tentatives, car Tidal répond parfois
// TIMEOUT sous la rafale (interceptActionResp.TIMEOUT sur LOAD_SINGLE_MEDIA_ITEM).
const RESOLVE_RETRIES = 3;
const RESOLVE_BACKOFF_MS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

type FromIdParams = Parameters<typeof MediaItem.fromId>;
type RawRef = { id: NonNullable<FromIdParams[0]>; type: NonNullable<FromIdParams[1]> };

/** Entrée de queue : soit un item résolu, soit un échec comptabilisé (jamais de throw). */
export type QueueEntry = { item: MediaItem } | { failed: true; label: string };

/**
 * Références brutes des tracks d'une collection, pour les résoudre une par
 * une avec retry (au lieu du générateur luna qui MEURT au premier throw et
 * faisait avorter toute la fin de la queue en silence).
 * Retourne null si les refs sont inaccessibles -> repli sur le générateur d'origine.
 */
async function rawRefs(collection: MediaCollection): Promise<RawRef[] | null> {
	try {
		if (collection instanceof FavoriteTracks) {
			return FavoriteTracks.ids().map((id) => ({ id, type: "track" as const }));
		}
		const maybe = collection as unknown as {
			tMediaItems?: () => Promise<Array<{ item?: { id?: RawRef["id"] }; type?: RawRef["type"] } | undefined> | undefined>;
		};
		if (typeof maybe.tMediaItems === "function") {
			const arr = await maybe.tMediaItems();
			if (Array.isArray(arr)) {
				return arr
					.filter((e) => e?.item?.id !== undefined)
					.map((e) => ({ id: e!.item!.id!, type: e!.type ?? "track" }));
			}
		}
	} catch (err) {
		trace.msg.warn.withContext("Cannot list collection refs, legacy generator fallback")(err);
	}
	return null;
}

/** Résout chaque ref avec retry ; un échec persistant devient une entrée {failed} (skip compté). */
async function* resolveEntries(refs: RawRef[]): AsyncGenerator<QueueEntry, unknown, unknown> {
	for (const ref of refs) {
		if (downloadState.cancel) return;
		let item: MediaItem | undefined;
		for (let attempt = 0; attempt < RESOLVE_RETRIES; attempt++) {
			if (downloadState.cancel) return;
			try {
				item = await MediaItem.fromId(ref.id, ref.type);
				break;
			} catch (err) {
				trace.msg.warn.withContext(`Resolve id ${ref.id} failed (attempt ${attempt + 1}/${RESOLVE_RETRIES})`)(err);
				if (attempt + 1 < RESOLVE_RETRIES) await sleep(RESOLVE_BACKOFF_MS[attempt] ?? 4000);
			}
		}
		if (item !== undefined) yield { item };
		else yield { failed: true, label: `id ${ref.id}` };
	}
}

/** Repli legacy : passe le générateur d'origine (peut mourir au premier throw). */
async function* legacyEntries(src: AsyncGenerator<MediaItem, unknown, unknown>): AsyncGenerator<QueueEntry, unknown, unknown> {
	while (true) {
		let next: IteratorResult<MediaItem, unknown>;
		try {
			next = await src.next();
		} catch (err) {
			trace.msg.warn.withContext("Prefetch failed to pull next media item")(err);
			return;
		}
		if (next.done || next.value === undefined) return;
		yield { item: next.value };
	}
}

let jobs: QueueJob[] = [];
let processing = false;
let nextId = 1;
let trackToken = 1;

const listeners = new Set<() => void>();
let progressPainter: ((job: QueueJob) => void) | null = null;

function notify() {
	for (const cb of listeners) {
		try {
			cb();
		} catch (err) {
			trace.msg.warn.withContext("Queue listener failed")(err);
		}
	}
}

function paint(job: QueueJob) {
	try {
		progressPainter?.(job);
	} catch (err) {
		trace.msg.warn.withContext("Queue progress painter failed")(err);
	}
}

/** L'island s'abonne pour re-rendre la liste ( changements structurels ). */
export function onQueueChange(cb: () => void): () => void {
	listeners.add(cb);
	unloads.add(() => listeners.delete(cb));
	return () => listeners.delete(cb);
}

/** L'island enregistre ici le patch léger des barres de progression (ticks). */
export function setQueueProgressPainter(fn: ((job: QueueJob) => void) | null) {
	progressPainter = fn;
}

export function getJobs(): QueueJob[] {
	return jobs;
}

/** Vrai si la queue a du travail (actif ou en attente). */
export function isQueueBusy(): boolean {
	return jobs.some((j) => j.status === "queued" || j.status === "active");
}

/** Position d'un job favoris dans la file (pour les labels). */
export function getFavoritesQueueInfo(): { status: JobStatus; pos: number } | null {
	const queued = jobs.filter((j) => j.status === "queued");
	const fav = jobs.find((j) => j.kind === "favorites" && (j.status === "queued" || j.status === "active"));
	if (!fav) return null;
	if (fav.status === "active") return { status: "active", pos: 0 };
	return { status: "queued", pos: queued.findIndex((j) => j.id === fav.id) + 1 };
}

export async function enqueueCollection(collection: MediaCollection, uiButton?: CtxButton, kind: JobKind = "collection"): Promise<QueueJob | null> {
	const total = await collection.count();
	if (total === 0) return null;
	const title = (await collection.title()) ?? `${total} tracks`;
	const job: QueueJob = {
		id: nextId++,
		kind,
		title,
		total,
		done: 0,
		succeeded: 0,
		failed: 0,
		skipped: 0,
		status: "queued",
		collection,
		uiButton,
		current: new Map<string, ActiveTrack>(),
	};
	jobs.push(job);
	if (uiButton) {
		const pos = jobs.filter((j) => j.status === "queued").findIndex((j) => j.id === job.id) + 1;
		uiButton.text = pos > 1 || jobs.some((j) => j.status === "active") ? `Queued #${pos}` : `Download ${total} tracks`;
	}
	notify();
	void ensureProcessing();
	return job;
}

/** Toggle pour les Tracks likés : queue si absent, retire/annule si présent. */
export async function toggleFavorites(): Promise<"queued" | "removed" | "cancelled" | "empty"> {
	const existing = jobs.find((j) => j.kind === "favorites" && (j.status === "queued" || j.status === "active"));
	if (existing) {
		if (existing.status === "queued") {
			removeJob(existing.id);
			return "removed";
		}
		cancelJob(existing.id);
		return "cancelled";
	}
	const job = await enqueueCollection(new FavoriteTracks(), undefined, "favorites");
	return job ? "queued" : "empty";
}

export function cancelJob(id: number) {
	const job = jobs.find((j) => j.id === id);
	if (!job) return;
	if (job.status === "queued") {
		jobs = jobs.filter((j) => j.id !== id);
		notify();
		return;
	}
	if (job.status === "active") {
		downloadState.cancel = true;
		setBannerStatus(`Stopping after current tracks... (${job.title})`);
	}
}

export function removeJob(id: number) {
	const job = jobs.find((j) => j.id === id);
	if (!job || job.status === "active") return;
	jobs = jobs.filter((j) => j.id !== id);
	notify();
}

/** Dossier de destination spécifique au job (s'applique aux tracks restantes). */
export function setJobFolder(id: number, folder: string | undefined) {
	const job = jobs.find((j) => j.id === id);
	if (!job || (job.status !== "queued" && job.status !== "active")) return;
	job.folderOverride = folder;
	notify();
}

export function cancelAll() {
	jobs = jobs.filter((j) => j.status === "active" || j.status === "done" || j.status === "stopped");
	if (jobs.some((j) => j.status === "active")) {
		downloadState.cancel = true;
		setBannerStatus("Stopping after current tracks...");
	}
	notify();
}

export function clearFinished() {
	const before = jobs.length;
	jobs = jobs.filter((j) => j.status === "queued" || j.status === "active");
	if (jobs.length !== before) notify();
}

/** Reordonne les jobs "queued" : l'actif reste en place, les terminés ne bougent pas. */
export function moveJob(id: number, toQueuedIndex: number) {
	const queuedIds = jobs.filter((j) => j.status === "queued").map((j) => j.id);
	const from = queuedIds.findIndex((qid) => qid === id);
	if (from === -1) return;
	queuedIds.splice(from, 1);
	const to = Math.max(0, Math.min(queuedIds.length, toQueuedIndex));
	queuedIds.splice(to, 0, id);
	const byId = new Map(jobs.map((j) => [j.id, j] as const));
	let k = 0;
	jobs = jobs.map((j) => (j.status === "queued" ? byId.get(queuedIds[k++])! : j));
	notify();
}

async function ensureProcessing() {
	if (processing) return;
	processing = true;
	try {
		while (true) {
			const job = jobs.find((j) => j.status === "queued");
			if (!job) break;
			await runJob(job);
		}
	} finally {
		processing = false;
		if (!isQueueBusy()) {
			downloadState.active = false;
			downloadState.cancel = false;
		}
	}
}

async function runJob(job: QueueJob) {
	const { collection, uiButton } = job;
	const trackCount = job.total;
	const defaultText = uiButton ? (uiButton.text = `Download ${trackCount} tracks`) : undefined;
	const downloadFolder = settings.defaultPath ?? (trackCount > 1 ? await getDownloadFolder() : undefined);

	if (trackCount > 1 && settings.defaultPath === undefined && downloadFolder === undefined) {
		if (uiButton && defaultText !== undefined) uiButton.text = defaultText;
		job.status = "stopped";
		notify();
		return;
	}

	job.status = "active";
	downloadState.active = true;
	downloadState.cancel = false;
	uiButton?.elem?.classList.add("download-button");
	setBannerTotal(trackCount);
	notify();

	try {
		// Résolution résiliente : chaque track est résolue avec retry, un échec
		// persistant devient une entrée {failed} comptée (plus jamais de queue
		// amputée en silence à cause d'un seul TIMEOUT).
		const refs = await rawRefs(collection);
		const entries: AsyncGenerator<QueueEntry, unknown, unknown> = refs !== null ? resolveEntries(refs) : legacyEntries(await collection.mediaItems());
		const width = Math.min(MAX_CONCURRENT, trackCount);

		// Prédiction suivante : pendant que les workers téléchargent, un pump
		// résout en avance les N prochains items (store + qualité), pour que
		// les workers n'attendent jamais la résolution.
		const LOOKAHEAD = 10;
		const ready: QueueEntry[] = [];
		let genDone = false;

		const prefetch = (async () => {
			try {
				while (true) {
					if (downloadState.cancel) break;
					if (ready.length >= LOOKAHEAD) {
						await sleep(25);
						continue;
					}
					let next: IteratorResult<QueueEntry, unknown>;
					try {
						next = await entries.next();
					} catch (err) {
						trace.msg.warn.withContext("Prefetch failed to pull next media item")(err);
						break;
					}
					if (next.done || next.value === undefined) break;
					ready.push(next.value);
				}
			} finally {
				genDone = true;
			}
		})();

		const takeNext = async (): Promise<QueueEntry | null> => {
			while (true) {
				if (downloadState.cancel) return null;
				const entry = ready.shift();
				if (entry !== undefined) return entry;
				if (genDone) return null;
				await sleep(10);
			}
		};

		const worker = async () => {
			while (true) {
				if (downloadState.cancel) break;
				const pulled = await takeNext();
				if (pulled === null) break;
				// Track impossible à résoudre (TIMEOUT persistant, track retirée...)
				// -> échec compté, la queue CONTINUE au lieu de mourir.
				if ("failed" in pulled) {
					job.failed++;
					job.done++;
					setBannerCurrent(job.done - 1, trackCount, `${job.title} — failed to resolve (${pulled.label})`);
					notify();
					paint(job);
					continue;
				}
				let mediaItem = pulled.item;
				const originalId = mediaItem.id;

				// Déjà téléchargée (historique) -> skip sans re-télécharger
				if (isDownloaded(originalId)) {
					job.skipped++;
					job.done++;
					setBannerCurrent(job.done - 1, trackCount, `${job.title} — skipped (already downloaded)`);
					notify();
					continue;
				}

				const fallbackLabel = `#${job.done + 1} (id ${mediaItem.id})`;
				setBannerCurrent(job.done, trackCount, `${job.title} — ${fallbackLabel}`);

				if (settings.useRealMAX) {
					if (uiButton) uiButton.text = `Checking RealMax...`;
					setBannerStatus(`Checking RealMax...`);
					mediaItem = (await mediaItem.max()) ?? mediaItem;
				}

				if (uiButton) uiButton.text = `Loading tags...`;
				setBannerStatus(`Loading tags...`);
				const { tags } = await mediaItem.flacTags();
				const label = tags.artist && tags.title ? `${tags.artist} – ${tags.title}` : (tags.title ?? fallbackLabel);
				const trackKey = `${mediaItem.id}:${trackToken++}`;
				let cover: string | undefined;
				try {
					cover = await mediaItem.coverUrl();
				} catch {
					cover = undefined;
				}
				job.current.set(trackKey, { key: trackKey, label, cover });
				setBannerCurrent(job.done, trackCount, `${job.title} — ${label}`);

				if (uiButton) uiButton.text = `Fetching filename...`;
				setBannerStatus(`Fetching filename... ${label}`);
				const fileName = await getFileName(mediaItem, settings.downloadQuality);

				if (uiButton) uiButton.text = `Fetching download path...`;
				const baseFolder = job.folderOverride ?? downloadFolder;
				const path = baseFolder !== undefined ? [baseFolder, fileName] : await getDownloadPath(fileName);
				if (path === undefined) break;

				// Double sécurité : le fichier existe déjà sur disque -> skip + synchro historique
				if (await fileExists(path)) {
					markDownloaded(originalId, mediaItem.id);
					job.skipped++;
					job.done++;
					setBannerCurrent(job.done - 1, trackCount, `${job.title} — skipped (file exists)`);
					notify();
					continue;
				}

				if (uiButton) uiButton.text = `Downloading...`;
				setBannerStatus(`Downloading... ${label}`);
				setBannerFileProgress(0);
				const clearInterval = safeInterval(
					unloads,
					async () => {
						const progress = await mediaItem.downloadProgress();
						if (progress === undefined) return;
						const { total, downloaded } = progress;
						const entry = job.current.get(trackKey);
						if (entry && total !== undefined && downloaded !== undefined) {
							entry.downloaded = downloaded;
							entry.total = total;
						}
						if (total === undefined || downloaded === undefined) return;
						const percent = total > 0 ? (downloaded / total) * 100 : 0;
						uiButton?.elem?.style.setProperty("--progress", `${percent}%`);
						const downloadedMB = (downloaded / 1048576).toFixed(0);
						const totalMB = (total / 1048576).toFixed(0);
						if (uiButton) uiButton.text = `Downloading... ${downloadedMB}/${totalMB}MB ${percent.toFixed(0)}%`;
						setBannerFileProgress(percent, downloadedMB, totalMB);
						paint(job);
					},
					50,
				);
				try {
					await mediaItem.download(path, settings.downloadQuality);
					job.succeeded++;
					markDownloaded(originalId, mediaItem.id);
					await saveLyricsForTrack(mediaItem, path, label, tags.title);
					await saveMetaForTrack(mediaItem, path, label, tags.title);
				} catch (err) {
					job.failed++;
					trace.msg.err.withContext(`Failed to download ${tags.title}`)(err);
					setBannerStatus(`Failed: ${label}`);
				} finally {
					clearInterval();
				}
				job.current.delete(trackKey);
				job.done++;
				setBannerCurrent(job.done - 1, trackCount, `${job.title} — ${label}`);
				notify();
			}
		};

		await Promise.all([prefetch, ...Array.from({ length: width }, () => worker())]);
		// Filet de sécurité : si le générateur est mort en route (cas legacy),
		// les tracks manquantes sont comptées en échec au lieu de fausser done/total.
		if (!downloadState.cancel && job.done < trackCount) {
			const missing = trackCount - job.done;
			job.failed += missing;
			job.done += missing;
			notify();
		}
		if (downloadState.cancel) {
			job.status = "stopped";
			setBannerStatus(`Stopped – ${job.succeeded}/${trackCount} downloaded (${job.title})`);
		} else {
			job.status = "done";
			setBannerDone(job.succeeded, job.failed, trackCount, job.skipped);
		}
	} finally {
		if (uiButton && defaultText !== undefined) uiButton.text = defaultText;
		uiButton?.elem?.classList.remove("download-button");
		uiButton?.elem?.style.removeProperty("--progress");
		notify();
	}
}
