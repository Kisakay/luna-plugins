import { hideToast, showToast, showToastForce } from "./toast";

/**
 * État partagé des downloads (manuel + queue + auto).
 * L'ancienne bannière a été supprimée : le suivi live est dans la fenêtre
 * Win10, les messages ponctuels partent en toast. Ces fonctions gardent
 * la même signature pour ne rien casser chez les appelants.
 */
export const downloadState = { active: false, cancel: false };

export function showBanner() {}
export function hideBanner() {
	hideToast();
}
export function setBannerTotal(_total: number) {}
export function setBannerCurrent(_index: number, _total: number, _label: string) {}
export function setBannerStatus(text: string) {
	showToast(text);
}
export function setBannerFileProgress(_percent: number, _downloadedMB?: string, _totalMB?: string) {}
export function setBannerDone(succeeded: number, failed: number, total: number, skipped = 0) {
	const skippedTxt = skipped > 0 ? ` · ${skipped} skipped` : "";
	showToastForce(
		failed > 0 ? `Done – ${succeeded}/${total} ok, ${failed} failed${skippedTxt}` : `Done – ${succeeded}/${total} downloaded${skippedTxt}`,
	);
}
export function setBannerIdle(_text = "Idle") {}
