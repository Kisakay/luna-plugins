import { MediaItem, type redux } from "@luna/lib";
import { showOpenDialog, showSaveDialog } from "@luna/lib.native";
import { settings } from "./Settings";

import sanitize from "sanitize-filename";

export const getDownloadFolder = async () => {
	const { canceled, filePaths } = await showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
	if (!canceled) return filePaths[0];
};
export const getDownloadPath = async (defaultPath: string) => {
	const { canceled, filePath } = await showSaveDialog({
		defaultPath,
		filters: [{ name: "", extensions: [defaultPath ?? "*"] }],
	});
	if (!canceled) return filePath;
};
export const getFileName = async (mediaItem: MediaItem, audioQuality?: redux.AudioQuality) => {
	const fileName = `${settings.pathFormat}.${await mediaItem.fileExtension(audioQuality)}`;
	const { tags } = await mediaItem.flacTags();
	return renderTagTemplate(fileName, tags, true);
};

/** Remplace les {tags} par leurs valeurs (sanitize ou brut selon le contexte). */
export const renderTagTemplate = (template: string, tags: Record<string, unknown>, sanitizeValues: boolean) => {
	let out = template;
	for (const tag of MediaItem.availableTags) {
		let tagValue: unknown = tags[tag];
		if (Array.isArray(tagValue)) tagValue = tagValue[0];
		if (tagValue === undefined || tagValue === null) continue;
		const rendered = sanitizeValues ? sanitize(String(tagValue)) : String(tagValue);
		out = out.split(`{${tag}}`).join(rendered);
	}
	return out;
};
