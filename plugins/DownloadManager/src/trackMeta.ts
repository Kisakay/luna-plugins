import { Tracer } from "@luna/core";
import type { MediaItem } from "@luna/lib";

import { setBannerStatus } from "./downloadBanner";
import { saveTextFile } from "./fs.native";
import { renderTagTemplate } from "./helpers";
import { settings } from "./Settings";

const { trace } = Tracer("[DownloadManager]");

/**
 * Sauvegarde le fichier metadata custom à côté du fichier audio.
 * Ex: Title.flac -> Title.flac.meta, contenu = template custom avec {tags}.
 */
export async function saveMetaForTrack(
	mediaItem: MediaItem,
	audioPath: string | string[],
	label: string,
	titleForLog?: string,
): Promise<void> {
	if (!settings.downloadMeta) return;
	try {
		const suffix = (settings.metaSuffix ?? ".meta").replace(/[/\\]/g, "");
		if (suffix === "") {
			trace.msg.warn.withContext("Skipping meta file, suffix is empty (would overwrite audio file)");
			return;
		}
		setBannerStatus(`Writing metadata... ${label}`);
		const { tags } = await mediaItem.flacTags();
		const text = renderTagTemplate(settings.metaTemplate, tags, false).trim();
		if (!text) return;
		const metaPath = Array.isArray(audioPath) ? [...audioPath.slice(0, -1), `${audioPath[audioPath.length - 1]}${suffix}`] : `${audioPath}${suffix}`;
		await saveTextFile(metaPath, `${text}\n`);
	} catch (err) {
		trace.msg.warn.withContext(`Failed to download metadata for ${titleForLog ?? label}`)(err);
	}
}
