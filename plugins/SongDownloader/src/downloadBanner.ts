/**
 * État partagé des downloads (manuel + queue + auto).
 * L'ancienne bannière ET le toast ont été supprimés : le suivi live est
 * dans la fenêtre Win10 et le résumé dans la taskbar. Ces fonctions gardent
 * la même signature (no-ops) pour ne rien casser chez les appelants.
 */
export const downloadState = { active: false, cancel: false };

export function showBanner() {}
export function hideBanner() {}
export function hideToast() {}
export function setBannerTotal(_total: number) {}
export function setBannerCurrent(_index: number, _total: number, _label: string) {}
export function setBannerStatus(_text: string) {}
export function setBannerFileProgress(_percent: number, _downloadedMB?: string, _totalMB?: string) {}
export function setBannerDone(_succeeded: number, _failed: number, _total: number, _skipped = 0) {}
export function setBannerIdle(_text = "Idle") {}
