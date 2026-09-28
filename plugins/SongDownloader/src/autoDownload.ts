import { Tracer } from "@luna/core";
import { MediaItem, safeInterval, safeTimeout } from "@luna/lib";

import { downloadState } from "./downloadBanner";
import { isDownloaded, markDownloaded } from "./downloadHistory";
import { fileExists } from "./fs.native";
import { isQueueBusy } from "./downloadQueue";
import { getFileName } from "./helpers";
import { unloads } from "./index.safe";
import { settings } from "./Settings";
import { saveLyricsForTrack } from "./trackLyrics";
import { saveMetaForTrack } from "./trackMeta";
import { msgTheme, repaintTaskbar, setAutoTaskbarStatus } from "./downloadIsland";
import { showWin10MsgBox } from "win10ml";
import { t } from "./i18n";

const { trace } = Tracer("[SongDownloader][Auto]");

let autoBusy = false;
let pending: MediaItem | null = null;
/** Vrai si c'est l'auto-download (et pas un job manuel) qui a levé downloadState.active. */
let ownedActive = false;
let lastNoFolderWarn = 0;

function esc(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function autoHtml(text: string): string {
	return `<span class="w10-status-icon">⬇</span><span>${esc(text)}</span>`;
}

/** Petit flash dans la taskbar (4s), sans écraser un download auto en cours. */
function flashAuto(text: string): void {
	setAutoTaskbarStatus(autoHtml(text));
	safeTimeout(unloads, () => {
		setAutoTaskbarStatus(null);
		repaintTaskbar();
	}, 4000);
}

function claimActive(): void {
	if (!downloadState.active) {
		downloadState.active = true;
		ownedActive = true;
	}
}

function releaseActive(): void {
	if (!ownedActive) return;
	ownedActive = false;
	if (!isQueueBusy()) downloadState.active = false;
}

/**
 * Watcher : à chaque transition de lecture (nouveau son joué),
 * sauvegarde automatiquement la track dans le dossier par défaut.
 * - Sans prompt (le dossier par défaut est obligatoire).
 * - Les fichiers déjà présents sont skippés (côté natif).
 * - Si l'utilisateur zappe vite, seule la dernière track en attente est gardée.
 * - Pause pendant un download manuel (downloadState.active levé par la queue).
 */
export function watchPlayedTracks() {
	MediaItem.onMediaTransition(unloads, (mediaItem) => {
		if (!settings.autoDownloadPlayed) return;
		if (mediaItem.contentType !== "track") return;
		// Un download manuel est prioritaire : la queue a du travail -> on ignore
		if (isQueueBusy()) return;
		if (downloadState.active && !ownedActive) return;
		pending = mediaItem;
		void pumpAutoQueue();
	});
}

async function pumpAutoQueue() {
	if (autoBusy) return;
	autoBusy = true;
	try {
		while (pending !== null) {
			// Annulation queue manuelle -> on rend la main (le pending restant sera repris)
			if (downloadState.cancel) break;
			// Un download manuel a démarré entre-temps -> on lui laisse la main
			if (isQueueBusy() || (downloadState.active && !ownedActive)) {
				pending = null;
				break;
			}
			const item = pending;
			pending = null;
			await autoDownloadOne(item);
		}
	} finally {
		autoBusy = false;
		// Un pending a survécu au break (cancel) -> on repompe au lieu de le perdre
		if (pending !== null) void pumpAutoQueue();
	}
}

function warnNoFolder(): void {
	// Throttle : une fois toutes les 30s max (vrai dialog Win10, la bannière est morte)
	if (Date.now() - lastNoFolderWarn < 30000) return;
	lastNoFolderWarn = Date.now();
	void showWin10MsgBox({
		title: t("auto.noFolderT"),
		text: t("auto.noFolder"),
		icon: "warning",
		buttons: [{ id: "ok", label: t("mb.ok"), isDefault: true }],
		...msgTheme(),
	});
}

async function autoDownloadOne(mediaItem: MediaItem) {
	// Déjà dans l'historique -> skip visible (avant c'était totalement silencieux)
	if (isDownloaded(mediaItem.id)) {
		flashAuto(t("auto.skipped"));
		return;
	}
	const folder = settings.defaultPath;
	if (folder === undefined) {
		warnNoFolder();
		return;
	}

	claimActive();
	try {
		const originalId = mediaItem.id;
		let item = mediaItem;
		if (settings.useRealMAX) {
			item = (await item.max()) ?? item;
		}

		const { tags } = await item.flacTags();
		const label = tags.artist && tags.title ? `${tags.artist} – ${tags.title}` : (tags.title ?? `id ${item.id}`);
		const fileName = await getFileName(item, settings.downloadQuality);
		const path = [folder, fileName];

		// Double sécurité : fichier déjà sur disque -> skip + synchro historique
		if (await fileExists(path)) {
			markDownloaded(originalId, item.id);
			flashAuto(t("auto.skipped"));
			return;
		}

		setAutoTaskbarStatus(autoHtml(t("auto.saving", { label })));
		repaintTaskbar();
		const clearInterval = safeInterval(
			unloads,
			async () => {
				const progress = await item.downloadProgress();
				if (progress === undefined) return;
				const { total, downloaded } = progress;
				if (total === undefined || downloaded === undefined || total === 0) return;
				const pct = ((downloaded / total) * 100).toFixed(0);
				setAutoTaskbarStatus(autoHtml(`${t("auto.saving", { label })} · ${pct}%`));
				repaintTaskbar();
			},
			500,
		);
		try {
			await item.download(path, settings.downloadQuality);
			markDownloaded(originalId, item.id);
			await saveLyricsForTrack(item, path, label, tags.title);
			await saveMetaForTrack(item, path, label, tags.title);
		} catch (err) {
			trace.msg.warn.withContext(`Auto-download failed for ${label}`)(err);
		} finally {
			clearInterval();
		}
	} catch (err) {
		trace.msg.warn.withContext(`Auto-download failed for id ${mediaItem.id}`)(err);
	} finally {
		releaseActive();
		setAutoTaskbarStatus(null);
		repaintTaskbar();
	}
}
