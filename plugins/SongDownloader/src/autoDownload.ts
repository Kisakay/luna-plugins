import { Tracer } from "@luna/core";
import { MediaItem, safeInterval } from "@luna/lib";

import { downloadState, setBannerFileProgress, setBannerStatus, showBanner } from "./downloadBanner";
import { isDownloaded, markDownloaded } from "./downloadHistory";
import { isQueueBusy } from "./downloadQueue";
import { getFileName } from "./helpers";
import { unloads } from "./index.safe";
import { settings } from "./Settings";
import { saveLyricsForTrack } from "./trackLyrics";

const { trace } = Tracer("[SongDownloader][Auto]");

let autoBusy = false;
let pending: MediaItem | null = null;
let lastNoFolderWarn = 0;

/**
 * Watcher : à chaque transition de lecture (nouveau son joué),
 * sauvegarde automatiquement la track dans le dossier par défaut.
 * - Sans prompt (le dossier par défaut est obligatoire).
 * - Les fichiers déjà présents sont skippés (côté natif).
 * - Si l'utilisateur zappe vite, seule la dernière track en attente est gardée.
 * - Pause pendant un download manuel (downloadState.active).
 */
export function watchPlayedTracks() {
	MediaItem.onMediaTransition(unloads, (mediaItem) => {
		if (!settings.autoDownloadPlayed) return;
		if (mediaItem.contentType !== "track") return;
		// Un download manuel est prioritaire
		if (downloadState.active && !autoBusy) return;
		pending = mediaItem;
		void pumpAutoQueue();
	});
}

async function pumpAutoQueue() {
	if (autoBusy) return;
	autoBusy = true;
	try {
		while (pending !== null) {
			if (downloadState.cancel) break;
			// Un download manuel a démarré entre-temps -> on lui laisse la main
			if (downloadState.active) {
				pending = null;
				break;
			}
			const item = pending;
			pending = null;
			await autoDownloadOne(item);
		}
	} finally {
		autoBusy = false;
		if (pending === null && !isQueueBusy()) downloadState.active = false;
		downloadState.cancel = false;
	}
}

async function autoDownloadOne(mediaItem: MediaItem) {
	// Déjà dans l'historique -> skip direct
	if (isDownloaded(mediaItem.id)) return;
	const folder = settings.defaultPath;
	if (folder === undefined) {
		// Throttle le warning : une fois toutes les 30s max
		if (Date.now() - lastNoFolderWarn > 30000) {
			lastNoFolderWarn = Date.now();
			setBannerStatus("Auto-download: set a default save folder in settings first");
			showBanner();
		}
		return;
	}

	downloadState.active = true;
	try {
		const originalId = mediaItem.id;
		let item = mediaItem;
		if (settings.useRealMAX) {
			setBannerStatus("Auto: checking RealMax...");
			item = (await item.max()) ?? item;
		}

		const { tags } = await item.flacTags();
		const label = tags.artist && tags.title ? `${tags.artist} – ${tags.title}` : (tags.title ?? `id ${item.id}`);
		const fileName = await getFileName(item, settings.downloadQuality);
		const path = [folder, fileName];

		setBannerStatus(`Auto-saving... ${label}`);
		setBannerFileProgress(0);
		const clearInterval = safeInterval(
			unloads,
			async () => {
				const progress = await item.downloadProgress();
				if (progress === undefined) return;
				const { total, downloaded } = progress;
				if (total === undefined || downloaded === undefined || total === 0) return;
				setBannerFileProgress((downloaded / total) * 100, (downloaded / 1048576).toFixed(0), (total / 1048576).toFixed(0));
			},
			200,
		);
		try {
			await item.download(path, settings.downloadQuality);
			markDownloaded(originalId, item.id);
			await saveLyricsForTrack(item, path, label, tags.title);
			setBannerStatus(`Auto-saved: ${label}`);
		} catch (err) {
			trace.msg.warn.withContext(`Auto-download failed for ${label}`)(err);
			setBannerStatus(`Auto-download failed: ${label}`);
		} finally {
			clearInterval();
		}
	} catch (err) {
		trace.msg.warn.withContext(`Auto-download failed for id ${mediaItem.id}`)(err);
	} finally {
		if (pending === null && !isQueueBusy()) downloadState.active = false;
	}
}
