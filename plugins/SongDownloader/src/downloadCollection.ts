import { Tracer } from "@luna/core";
import { ContextMenu, safeInterval } from "@luna/lib";
import type { MediaCollection, MediaItem } from "@luna/lib";

import { unloads } from "./index.safe";
import { settings } from "./Settings";
import { saveLyricsForTrack } from "./trackLyrics";
import { getDownloadFolder, getDownloadPath, getFileName } from "./helpers";
import {
	downloadState,
	setBannerCurrent,
	setBannerDone,
	setBannerFileProgress,
	setBannerStatus,
	setBannerTotal,
} from "./downloadBanner";

type CtxButton = ReturnType<typeof ContextMenu.addButton>;

const { trace } = Tracer("[SongDownloader]");

// Workers concurrents pour le bulk. Note : le core Luna sérialise le fetch
// des flux audio côté natif (Semaphore 1), donc le gain vient de la
// parallélisation de tout le reste : RealMAX, tags/MusicBrainz, playbackInfo,
// filenames et lyrics. Sur des milliers de tracks, c'est là qu'est le temps.
const MAX_CONCURRENT = 5;

/**
 * Télécharge toute une collection (playlist, album, multi-tracks, favoris...).
 * Met à jour à la fois le bouton du context-menu (si fourni) et la bannière top-right.
 * Cliquer pendant un download demande l'arrêt après la track en cours.
 */
export async function downloadMediaCollection(mediaCollection: MediaCollection, uiButton?: CtxButton): Promise<void> {
	const trackCount = await mediaCollection.count();
	if (trackCount === 0) return;

	// Click pendant un download = demande d'arrêt
	if (downloadState.active) {
		downloadState.cancel = true;
		if (uiButton) uiButton.text = `Stopping...`;
		setBannerStatus("Stopping after current track...");
		return;
	}

	const defaultText = uiButton ? (uiButton.text = `Download ${trackCount} tracks`) : undefined;
	const downloadFolder = settings.defaultPath ?? (trackCount > 1 ? await getDownloadFolder() : undefined);

	// Si multi-tracks sans dossier (dialogue annulé), on abort avant de toucher la bannière
	if (trackCount > 1 && settings.defaultPath === undefined && downloadFolder === undefined) {
		if (uiButton && defaultText !== undefined) uiButton.text = defaultText;
		return;
	}

	downloadState.active = true;
	downloadState.cancel = false;
	uiButton?.elem?.classList.add("download-button");
	setBannerTotal(trackCount);

	let succeeded = 0;
	let failed = 0;
	let done = 0;

	try {
		// Le générateur est partagé entre les workers : les appels .next()
		// concurrents sont sérialisés par la sémantique des async generators,
		// donc chaque track est distribuée à un seul worker.
		const items = await mediaCollection.mediaItems();
		const width = Math.min(MAX_CONCURRENT, trackCount);

		const worker = async () => {
			while (true) {
				if (downloadState.cancel) break;
				let next: IteratorResult<MediaItem, unknown>;
				try {
					next = await items.next();
				} catch (err) {
					trace.msg.warn.withContext("Failed to pull next media item")(err);
					break;
				}
				if (next.done || next.value === undefined) break;
				let mediaItem = next.value;

				const fallbackLabel = `#${done + 1} (id ${mediaItem.id})`;
				setBannerCurrent(done, trackCount, fallbackLabel);

				if (settings.useRealMAX) {
					if (uiButton) uiButton.text = `Checking RealMax...`;
					setBannerStatus(`Checking RealMax...`);
					mediaItem = (await mediaItem.max()) ?? mediaItem;
				}

				if (uiButton) uiButton.text = `Loading tags...`;
				setBannerStatus(`Loading tags...`);
				const { tags } = await mediaItem.flacTags();
				const label = tags.artist && tags.title ? `${tags.artist} – ${tags.title}` : (tags.title ?? fallbackLabel);
				setBannerCurrent(done, trackCount, label);

				if (uiButton) uiButton.text = `Fetching filename...`;
				setBannerStatus(`Fetching filename... ${label}`);
				const fileName = await getFileName(mediaItem, settings.downloadQuality);

				if (uiButton) uiButton.text = `Fetching download path...`;
				const path = downloadFolder !== undefined ? [downloadFolder, fileName] : await getDownloadPath(fileName);
				if (path === undefined) break;

				if (uiButton) uiButton.text = `Downloading...`;
				setBannerStatus(`Downloading... ${label}`);
				setBannerFileProgress(0);
				const clearInterval = safeInterval(
					unloads,
					async () => {
						const progress = await mediaItem.downloadProgress();
						if (progress === undefined) return;
						const { total, downloaded } = progress;
						if (total === undefined || downloaded === undefined) return;
						const percent = total > 0 ? (downloaded / total) * 100 : 0;
						uiButton?.elem?.style.setProperty("--progress", `${percent}%`);
						const downloadedMB = (downloaded / 1048576).toFixed(0);
						const totalMB = (total / 1048576).toFixed(0);
						if (uiButton) uiButton.text = `Downloading... ${downloadedMB}/${totalMB}MB ${percent.toFixed(0)}%`;
						setBannerFileProgress(percent, downloadedMB, totalMB);
					},
					50,
				);
				try {
					await mediaItem.download(path, settings.downloadQuality);
					succeeded++;
					// Lyrics : fichier texte à côté de la track (ex: Title.flac -> Title.flac.lyrics)
					await saveLyricsForTrack(mediaItem, path, label, tags.title);
				} catch (err) {
					failed++;
					trace.msg.err.withContext(`Failed to download ${tags.title}`)(err);
					setBannerStatus(`Failed: ${label}`);
				} finally {
					clearInterval();
				}
				done++;
				setBannerCurrent(done - 1, trackCount, label);
			}
		};

		await Promise.all(Array.from({ length: width }, () => worker()));
		if (downloadState.cancel) {
			setBannerStatus(`Stopped – ${succeeded}/${trackCount} downloaded`);
		} else {
			setBannerDone(succeeded, failed, trackCount);
		}
	} finally {
		downloadState.active = false;
		downloadState.cancel = false;
		if (uiButton && defaultText !== undefined) uiButton.text = defaultText;
		uiButton?.elem?.classList.remove("download-button");
		uiButton?.elem?.style.removeProperty("--progress");
	}
}
