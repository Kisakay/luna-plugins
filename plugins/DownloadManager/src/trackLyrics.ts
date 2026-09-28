import { Tracer } from "@luna/core";
import type { MediaItem } from "@luna/lib";

import { setBannerStatus } from "./downloadBanner";
import { saveTextFile } from "./fs.native";
import { settings } from "./Settings";

const { trace } = Tracer("[DownloadManager]");

/**
 * Sauvegarde le fichier lyrics (texte) à côté du fichier audio.
 * Ex: Title.flac -> Title.flac.lyrics (suffixe configurable).
 * Ne fait rien si l'option est désactivée, si pas de lyrics, ou si le suffixe est vide.
 */
export async function saveLyricsForTrack(
	mediaItem: MediaItem,
	audioPath: string | string[],
	label: string,
	titleForLog?: string,
): Promise<void> {
	if (!settings.downloadLyrics) return;
	try {
		const suffix = (settings.lyricsSuffix ?? ".lyrics").replace(/[/\\]/g, "");
		if (suffix === "") {
			trace.msg.warn.withContext("Skipping lyrics, suffix is empty (would overwrite audio file)");
			return;
		}
		setBannerStatus(`Fetching lyrics... ${label}`);
		const lyrics = await mediaItem.lyrics();
		const text = lyrics?.lyrics?.trim();
		if (!text) return;
		const lyricsPath = Array.isArray(audioPath) ? [...audioPath.slice(0, -1), `${audioPath[audioPath.length - 1]}${suffix}`] : `${audioPath}${suffix}`;
		await saveTextFile(lyricsPath, text);
	} catch (err) {
		trace.msg.warn.withContext(`Failed to download lyrics for ${titleForLog ?? label}`)(err);
	}
}
