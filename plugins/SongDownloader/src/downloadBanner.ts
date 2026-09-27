import { settings } from "./Settings";

/**
 * Bannière de statut des téléchargements (haut-droite par défaut).
 * Survit à la fermeture du context-menu (contrairement au bouton du menu).
 * Déplaçable à la souris (par le header) avec position sauvegardée.
 */

export const downloadState = { active: false, cancel: false };

type BannerRefs = {
	root: HTMLDivElement;
	header: HTMLDivElement;
	title: HTMLSpanElement;
	track: HTMLDivElement;
	status: HTMLDivElement;
	count: HTMLDivElement;
	fileFill: HTMLDivElement;
	overallFill: HTMLDivElement;
	filePct: HTMLSpanElement;
	cancelBtn: HTMLButtonElement;
	closeBtn: HTMLButtonElement;
};

let refs: BannerRefs | undefined;
let hideTimeout: ReturnType<typeof setTimeout> | undefined;

const BANNER_ID = "luna-songdownloader-banner";

function clampToViewport(root: HTMLDivElement) {
	const w = root.offsetWidth || 320;
	const h = root.offsetHeight || 150;
	const rect = root.getBoundingClientRect();
	let x = rect.left;
	let y = rect.top;
	// Si ancrée à droite (pas de left inline), on la convertit en left/top
	if (root.style.left === "") {
		x = window.innerWidth - rect.width - 16;
		y = 16;
	}
	x = Math.max(0, Math.min(window.innerWidth - w, x));
	y = Math.max(0, Math.min(window.innerHeight - h, y));
	root.style.left = `${x}px`;
	root.style.top = `${y}px`;
	root.style.right = "auto";
}

function applySavedPosition(root: HTMLDivElement) {
	const pos = settings.bannerPos;
	if (pos === null || pos === undefined) return;
	const w = 320;
	const h = 150;
	const x = Math.max(0, Math.min(window.innerWidth - w, pos.x));
	const y = Math.max(0, Math.min(window.innerHeight - h, pos.y));
	root.style.left = `${x}px`;
	root.style.top = `${y}px`;
	root.style.right = "auto";
}

function makeDraggable(root: HTMLDivElement, header: HTMLDivElement) {
	let drag: { dx: number; dy: number } | null = null;
	header.onpointerdown = (e) => {
		// Laisser le bouton close fonctionner normalement
		if ((e.target as HTMLElement).closest("button")) return;
		const rect = root.getBoundingClientRect();
		root.style.left = `${rect.left}px`;
		root.style.top = `${rect.top}px`;
		root.style.right = "auto";
		drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
		root.classList.add("sd-dragging");
		try {
			header.setPointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		e.preventDefault();
	};
	header.onpointermove = (e) => {
		if (drag === null) return;
		const w = root.offsetWidth || 320;
		const h = root.offsetHeight || 150;
		const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - drag.dx));
		const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - drag.dy));
		root.style.left = `${x}px`;
		root.style.top = `${y}px`;
	};
	const endDrag = () => {
		if (drag === null) return;
		drag = null;
		root.classList.remove("sd-dragging");
		settings.bannerPos = {
			x: Number.parseFloat(root.style.left) || 0,
			y: Number.parseFloat(root.style.top) || 0,
		};
	};
	header.onpointerup = endDrag;
	header.onpointercancel = endDrag;
}

function buildBanner(): BannerRefs {
	const root = document.createElement("div");
	root.id = BANNER_ID;
	root.className = "sd-banner sd-hidden";

	const header = document.createElement("div");
	header.className = "sd-header";
	header.title = "Drag to move";

	const title = document.createElement("span");
	title.className = "sd-title";
	title.textContent = "SongDownloader";

	const closeBtn = document.createElement("button");
	closeBtn.className = "sd-close";
	closeBtn.type = "button";
	closeBtn.title = "Hide";
	closeBtn.textContent = "✕";
	closeBtn.onclick = (e) => {
		e.preventDefault();
		hideBanner();
	};

	header.appendChild(title);
	header.appendChild(closeBtn);

	const track = document.createElement("div");
	track.className = "sd-track";
	track.textContent = "Idle";

	const status = document.createElement("div");
	status.className = "sd-status";
	status.textContent = "—";

	const fileRow = document.createElement("div");
	fileRow.className = "sd-row";
	const filePct = document.createElement("span");
	filePct.className = "sd-filepct";
	filePct.textContent = "";
	fileRow.appendChild(filePct);

	const fileBar = document.createElement("div");
	fileBar.className = "sd-progress";
	const fileFill = document.createElement("div");
	fileFill.className = "sd-progress-fill";
	fileBar.appendChild(fileFill);

	const overallRow = document.createElement("div");
	overallRow.className = "sd-row sd-overall-row";
	const count = document.createElement("div");
	count.className = "sd-count";
	count.textContent = "";
	overallRow.appendChild(count);

	const overallBar = document.createElement("div");
	overallBar.className = "sd-progress sd-overall";
	const overallFill = document.createElement("div");
	overallFill.className = "sd-progress-fill sd-overall-fill";
	overallBar.appendChild(overallFill);

	const cancelBtn = document.createElement("button");
	cancelBtn.className = "sd-cancel";
	cancelBtn.type = "button";
	cancelBtn.textContent = "Cancel";
	cancelBtn.onclick = (e) => {
		e.preventDefault();
		if (downloadState.active) {
			downloadState.cancel = true;
			cancelBtn.textContent = "Stopping...";
		} else {
			hideBanner();
		}
	};

	root.appendChild(header);
	root.appendChild(track);
	root.appendChild(status);
	root.appendChild(fileRow);
	root.appendChild(fileBar);
	root.appendChild(overallRow);
	root.appendChild(overallBar);
	root.appendChild(cancelBtn);

	document.body.appendChild(root);
	makeDraggable(root, header);
	applySavedPosition(root);

	return { root, header, title, track, status, count, fileFill, overallFill, filePct, cancelBtn, closeBtn };
}

function ensure(): BannerRefs {
	if (refs === undefined || !document.body.contains(refs.root)) {
		refs = buildBanner();
	}
	if (hideTimeout !== undefined) {
		clearTimeout(hideTimeout);
		hideTimeout = undefined;
	}
	return refs!;
}

export function showBanner() {
	const b = ensure();
	clampToViewport(b.root);
	b.root.classList.remove("sd-hidden");
}

export function hideBanner() {
	refs?.root.classList.add("sd-hidden");
}

export function setBannerTotal(total: number) {
	const b = ensure();
	b.count.textContent = total > 0 ? `0 / ${total}` : "";
	b.overallFill.style.width = "0%";
	b.cancelBtn.textContent = "Cancel";
	showBanner();
}

export function setBannerCurrent(index: number, total: number, label: string) {
	const b = ensure();
	b.track.textContent = total > 1 ? `${index + 1}/${total} – ${label}` : label;
	b.count.textContent = total > 1 ? `${index + 1} / ${total}` : label;
	b.overallFill.style.width = total > 0 ? `${((index + 1) / total) * 100}%` : "0%";
	showBanner();
}

export function setBannerStatus(text: string) {
	ensure().status.textContent = text;
	showBanner();
}

export function setBannerFileProgress(percent: number, downloadedMB?: string, totalMB?: string) {
	const b = ensure();
	const clamped = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
	b.fileFill.style.width = `${clamped}%`;
	b.filePct.textContent =
		downloadedMB !== undefined && totalMB !== undefined ? `${downloadedMB}/${totalMB}MB ${clamped.toFixed(0)}%` : `${clamped.toFixed(0)}%`;
	showBanner();
}

export function setBannerDone(succeeded: number, failed: number, total: number) {
	const b = ensure();
	b.status.textContent = failed > 0 ? `Done – ${succeeded}/${total} ok, ${failed} failed` : `Done – ${succeeded}/${total} downloaded`;
	b.fileFill.style.width = "100%";
	b.overallFill.style.width = "100%";
	b.filePct.textContent = "100%";
	b.cancelBtn.textContent = "Close";
	showBanner();
	if (hideTimeout !== undefined) clearTimeout(hideTimeout);
	hideTimeout = setTimeout(hideBanner, 8000);
}

export function setBannerIdle(text = "Idle") {
	const b = ensure();
	b.track.textContent = text;
	b.status.textContent = "—";
	b.fileFill.style.width = "0%";
	b.filePct.textContent = "";
}
