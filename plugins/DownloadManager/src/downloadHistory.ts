import { setBannerStatus, showBanner } from "./downloadBanner";
import { settings } from "./Settings";

/**
 * Historique persisté des tracks déjà téléchargées.
 * Les ids sont sauvegardés dans les settings du plugin (survit au redémarrage)
 * et les tracks connues sont skippées automatiquement.
 * Initialisation lazy pour éviter tout souci d'ordre d'imports.
 */

let seen: Set<number | string> | null = null;

function store(): Set<number | string> {
	if (seen === null) seen = new Set<number | string>(settings.downloadedIds ?? []);
	return seen;
}

export function isDownloaded(id: number | string): boolean {
	return store().has(id);
}

export function markDownloaded(...ids: (number | string)[]): void {
	const s = store();
	let changed = false;
	for (const id of ids) {
		if (!s.has(id)) {
			s.add(id);
			changed = true;
		}
	}
	if (changed) settings.downloadedIds = [...s];
}

export function countDownloaded(): number {
	return store().size;
}

export function clearDownloaded(): number {
	const s = store();
	const n = s.size;
	s.clear();
	settings.downloadedIds = [];
	setBannerStatus(n > 0 ? `Download history cleared (${n} tracks)` : "Download history already empty");
	showBanner();
	return n;
}
