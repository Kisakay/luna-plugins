import { safeInterval } from "@luna/lib";
import { MediaItem, Quality, type redux } from "@luna/lib";

import { clearDownloaded, countDownloaded } from "./downloadHistory";
import {
	cancelAll,
	cancelJob,
	clearFinished,
	getJobs,
	moveJob,
	onQueueChange,
	removeJob,
	setJobFolder,
	setQueueProgressPainter,
	type ActiveTrack,
	type QueueJob,
} from "./downloadQueue";
import { getDownloadFolder } from "./helpers";
import { unloads } from "./index.safe";
import { settings } from "./Settings";

const TASKBAR_ID = "luna-songdownloader-taskbar";
const WIN_ID = "luna-songdownloader-win";
const CAL_ID = "luna-songdownloader-cal";
const JOBMENU_ID = "luna-songdownloader-jobmenu";

// Vrais glyphes façon Segoe MDL2 Assets (Windows 10), en SVG pour un rendu
// identique partout (la police MDL2 n'existe pas sous Linux).
const WIN10_LOGO = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.549L10.546 4.484V11.504H3V5.549Zm8.546-1.204L21 3v8.504H11.546V4.345ZM3 12.504h7.546v7.014L3 18.453v-5.949Zm8.546 0H21V21l-9.454-1.343v-7.153Z"/></svg>`;
const GLYPH_MIN = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1"/></svg>`;
const GLYPH_MAX = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor"/></svg>`;
const GLYPH_RESTORE = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" y="1" width="5" height="5" fill="none" stroke="currentColor"/><rect x="1" y="4" width="5" height="5" fill="none" stroke="currentColor"/></svg>`;
const GLYPH_CLOSE = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1"/></svg>`;

type Section = "downloads" | "history" | "settings";

let taskbarEl: HTMLDivElement | null = null;
let appBtn: HTMLButtonElement | null = null;
let statusEl: HTMLSpanElement | null = null;
let timeEl: HTMLSpanElement | null = null;
let dateEl: HTMLSpanElement | null = null;
let winEl: HTMLDivElement | null = null;
let winBody: HTMLDivElement | null = null;
let expanded = false;
let minimized = false;
let maximized = false;
let forceOpen = false;
let section: Section = "downloads";
let builtSection: Section | null = null;
let search = "";
let dragId: number | null = null;

const statusLabel = (job: QueueJob): string => {
	switch (job.status) {
		case "active":
			return "Downloading";
		case "queued":
			return "Queued";
		case "done":
			return job.failed > 0 ? `Done · ${job.failed} failed` : "Done";
		case "stopped":
			return "Stopped";
	}
};

function summaryText(): string {
	const jobs = getJobs();
	const active = jobs.find((j) => j.status === "active");
	const queued = jobs.filter((j) => j.status === "queued").length;
	if (active) return `${active.done}/${active.total}${queued > 0 ? ` · ${queued} queued` : ""}`;
	if (queued > 0) return `${queued} queued`;
	const done = jobs.filter((j) => j.status === "done").length;
	return done > 0 ? `${done} finished` : "Queue is empty";
}

function isWinShown(): boolean {
	const jobs = getJobs();
	return (jobs.length > 0 || forceOpen) && expanded && !minimized;
}

function applyTheme() {
	winEl?.classList.toggle("sd-win-dark", settings.winTheme === "dark");
}

// #region Fenêtre : position / taille / drag / resize / chrome
function clampWin(win: HTMLDivElement) {
	const w = win.offsetWidth || 520;
	const rect = win.getBoundingClientRect();
	let x = win.style.left === "" ? window.innerWidth / 2 - rect.width / 2 : rect.left;
	let y = win.style.top === "" ? 80 : rect.top;
	x = Math.max(-w + 120, Math.min(window.innerWidth - 120, x));
	y = Math.max(0, Math.min(window.innerHeight - 60, y));
	win.style.left = `${x}px`;
	win.style.top = `${y}px`;
	win.style.transform = "none";
}

function applySavedGeom(win: HTMLDivElement) {
	const pos = settings.winPos;
	if (pos !== null && pos !== undefined) {
		win.style.left = `${pos.x}px`;
		win.style.top = `${pos.y}px`;
		win.style.transform = "none";
	}
	const size = settings.winSize;
	if (size !== null && size !== undefined) {
		win.style.width = `${size.w}px`;
		win.style.height = `${size.h}px`;
	}
}

function makeWinDraggable(win: HTMLDivElement, titlebar: HTMLDivElement) {
	let drag: { dx: number; dy: number } | null = null;
	titlebar.onpointerdown = (e) => {
		if ((e.target as HTMLElement).closest("button") || maximized) return;
		const rect = win.getBoundingClientRect();
		win.style.left = `${rect.left}px`;
		win.style.top = `${rect.top}px`;
		win.style.transform = "none";
		drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
		try {
			titlebar.setPointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		e.preventDefault();
	};
	titlebar.onpointermove = (e) => {
		if (drag === null) return;
		const w = win.offsetWidth || 520;
		const x = Math.max(-w + 120, Math.min(window.innerWidth - 120, e.clientX - drag.dx));
		const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.dy));
		win.style.left = `${x}px`;
		win.style.top = `${y}px`;
	};
	const endDrag = () => {
		if (drag === null) return;
		drag = null;
		settings.winPos = {
			x: Number.parseFloat(win.style.left) || 0,
			y: Number.parseFloat(win.style.top) || 0,
		};
	};
	titlebar.onpointerup = endDrag;
	titlebar.onpointercancel = endDrag;
	titlebar.ondblclick = (e) => {
		if ((e.target as HTMLElement).closest("button")) return;
		toggleMaximize();
	};
}

function makeWinResizable(win: HTMLDivElement, grip: HTMLDivElement) {
	let resize: { startW: number; startH: number; startX: number; startY: number } | null = null;
	grip.onpointerdown = (e) => {
		if (maximized) return;
		const rect = win.getBoundingClientRect();
		win.style.width = `${rect.width}px`;
		win.style.height = `${rect.height}px`;
		resize = { startW: rect.width, startH: rect.height, startX: e.clientX, startY: e.clientY };
		try {
			grip.setPointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		e.preventDefault();
		e.stopPropagation();
	};
	grip.onpointermove = (e) => {
		if (resize === null) return;
		const w = Math.max(380, Math.min(window.innerWidth - 16, resize.startW + e.clientX - resize.startX));
		const h = Math.max(420, Math.min(window.innerHeight - 16, resize.startH + e.clientY - resize.startY));
		win.style.width = `${w}px`;
		win.style.height = `${h}px`;
	};
	const endResize = () => {
		if (resize === null) return;
		resize = null;
		settings.winSize = {
			w: Math.round(Number.parseFloat(win.style.width) || 520),
			h: Math.round(Number.parseFloat(win.style.height) || 560),
		};
	};
	grip.onpointerup = endResize;
	grip.onpointercancel = endResize;
}

function toggleMaximize() {
	if (!winEl) return;
	maximized = !maximized;
	winEl.classList.toggle("sd-win-max", maximized);
	const maxBtn = winEl.querySelector(".sd-win-capbtn.sd-win-maxbtn") as HTMLButtonElement | null;
	if (maxBtn) {
		maxBtn.innerHTML = maximized ? GLYPH_RESTORE : GLYPH_MAX;
		maxBtn.title = maximized ? "Restore" : "Maximize";
		maxBtn.setAttribute("aria-label", maximized ? "Restore" : "Maximize");
	}
	if (!maximized) clampWin(winEl);
}
// #endregion

// #region Rendu
function paintJob(job: QueueJob) {
	const row = document.querySelector(`#${WIN_ID} [data-job-id="${job.id}"]`);
	if (row) {
		const fill = row.querySelector(".sd-island-bar-fill") as HTMLDivElement | null;
		const count = row.querySelector(".sd-island-count") as HTMLSpanElement | null;
		if (fill) fill.style.width = job.total > 0 ? `${(job.done / job.total) * 100}%` : "0%";
		if (count) count.textContent = `${job.done}/${job.total}`;
		// Synchro de la liste dépliée (ajout / progression / retrait)
		const wrap = row.closest(".sd-island-jobwrap");
		const tracks = wrap?.querySelector(".sd-island-tracks");
		if (wrap && tracks && job.tracksOpen) {
			tracks.querySelectorAll(".sd-island-track").forEach((el) => {
				const k = (el as HTMLElement).dataset.trackKey!;
				const entry = job.current.get(k);
				if (!entry) el.remove();
				else setTrackProgress(el, entry);
			});
			tracks.querySelector(".sd-island-wait")?.remove();
			for (const entry of job.current.values()) {
				if (!tracks.querySelector(`[data-track-key="${CSS.escape(entry.key)}"]`)) tracks.appendChild(buildTrackEl(entry));
			}
			if (job.current.size === 0) {
				const wait = document.createElement("div");
				wait.className = "sd-island-wait";
				wait.textContent = job.status === "active" ? "Waiting for next tracks…" : "No track in progress.";
				tracks.appendChild(wait);
			}
		}
	}
	paintTaskbar();
}

function paintTaskbar() {
	if (!appBtn) return;
	const jobs = getJobs();
	const running = jobs.length > 0;
	const open = isWinShown();
	appBtn.classList.toggle("sd-taskbar-running", running);
	appBtn.classList.toggle("sd-taskbar-open", open && !minimized);
	appBtn.title = running ? `SongDownloaderV2 — ${summaryText()}` : "SongDownloaderV2";
	if (statusEl) {
		const active = jobs.find((j) => j.status === "active");
		const queued = jobs.filter((j) => j.status === "queued").length;
		let html: string | null = null;
		if (active) {
			const current = [...active.current.values()][0]?.label;
			html = `<span class="sd-taskbar-status-icon">⬇</span><span>${active.done}/${active.total}${current ? ` · ${escapeHtml(current)}` : ""}${queued > 0 ? ` · ${queued} queued` : ""}</span>`;
		} else if (queued > 0) {
			html = `<span class="sd-taskbar-status-icon">⬇</span><span>${queued} queued</span>`;
		} else if (jobs.length > 0) {
			html = `<span>✓ finished</span>`;
		}
		if (html === null) {
			statusEl.style.display = "none";
		} else {
			statusEl.style.display = "";
			// Throttle : les ticks de progression appellent très souvent
			if (statusEl.dataset.html !== html) {
				statusEl.dataset.html = html;
				statusEl.innerHTML = html;
			}
		}
	}
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tickClock() {
	if (!timeEl || !dateEl) return;
	const now = new Date();
	timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	dateEl.textContent = now.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

// #region Calendrier façon Win10 (clic sur l'horloge)
let calYear = -1;
let calMonth = -1;

function closeCalendar() {
	document.getElementById(CAL_ID)?.remove();
}

function openCalendar() {
	closeCalendar();
	const today = new Date();
	if (calYear < 0) {
		calYear = today.getFullYear();
		calMonth = today.getMonth();
	}
	const cal = document.createElement("div");
	cal.id = CAL_ID;
	cal.className = "sd-cal";
	if (settings.winTheme === "dark") cal.classList.add("sd-cal-dark");

	const head = document.createElement("div");
	head.className = "sd-cal-head";
	const title = document.createElement("span");
	title.className = "sd-cal-title";
	head.appendChild(title);
	const nav = document.createElement("div");
	nav.className = "sd-cal-nav";
	const prev = document.createElement("button");
	prev.type = "button";
	prev.className = "sd-cal-navbtn";
	prev.textContent = "‹";
	prev.title = "Previous month";
	prev.onclick = (e) => {
		e.stopPropagation();
		calMonth--;
		if (calMonth < 0) {
			calMonth = 11;
			calYear--;
		}
		paintCalendar(cal, title, grid);
	};
	const next = document.createElement("button");
	next.type = "button";
	next.className = "sd-cal-navbtn";
	next.textContent = "›";
	next.title = "Next month";
	next.onclick = (e) => {
		e.stopPropagation();
		calMonth++;
		if (calMonth > 11) {
			calMonth = 0;
			calYear++;
		}
		paintCalendar(cal, title, grid);
	};
	nav.appendChild(prev);
	nav.appendChild(next);
	head.appendChild(nav);
	cal.appendChild(head);

	const grid = document.createElement("div");
	grid.className = "sd-cal-grid";
	cal.appendChild(grid);

	const foot = document.createElement("div");
	foot.className = "sd-cal-foot";
	foot.textContent = `Today: ${today.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" })}`;
	foot.style.cursor = "pointer";
	foot.onclick = () => {
		calYear = today.getFullYear();
		calMonth = today.getMonth();
		paintCalendar(cal, title, grid);
	};
	cal.appendChild(foot);

	document.body.appendChild(cal);
	paintCalendar(cal, title, grid);

	const onPointerDown = (ev: PointerEvent) => {
		if (!cal.contains(ev.target as Node)) closeCalendar();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") closeCalendar();
	};
	document.addEventListener("pointerdown", onPointerDown, { once: true });
	document.addEventListener("keydown", onKey, { once: true });
	unloads.add(() => {
		closeCalendar();
		document.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("keydown", onKey);
	});
}

function paintCalendar(cal: HTMLDivElement, title: HTMLSpanElement, grid: HTMLDivElement) {
	const today = new Date();
	title.textContent = new Date(calYear, calMonth, 1).toLocaleDateString([], { month: "long", year: "numeric" });
	grid.innerHTML = "";
	// En-têtes jours (lundi en premier), libellés FR courts
	for (let i = 0; i < 7; i++) {
		const d = new Date(2024, 0, 1 + i);
		const dow = document.createElement("div");
		dow.className = "sd-cal-dow";
		dow.textContent = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
		grid.appendChild(dow);
	}
	// 1er janvier 2024 = lundi -> décalage mois
	const first = new Date(calYear, calMonth, 1);
	const lead = (first.getDay() + 6) % 7;
	const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
	const daysPrev = new Date(calYear, calMonth, 0).getDate();
	for (let i = lead - 1; i >= 0; i--) {
		grid.appendChild(calDay(cal, daysPrev - i, true, false));
	}
	for (let d = 1; d <= daysInMonth; d++) {
		const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
		grid.appendChild(calDay(cal, d, false, isToday));
	}
	const total = lead + daysInMonth;
	for (let d = 1; d <= (7 - (total % 7)) % 7; d++) {
		grid.appendChild(calDay(cal, d, true, false));
	}
	cal.classList.toggle("sd-cal-dark", settings.winTheme === "dark");
}

function calDay(_cal: HTMLDivElement, day: number, other: boolean, today: boolean): HTMLButtonElement {
	const b = document.createElement("button");
	b.type = "button";
	b.className = "sd-cal-day";
	if (other) b.classList.add("sd-cal-other");
	if (today) b.classList.add("sd-cal-today");
	b.textContent = String(day);
	return b;
}
// #endregion

function render() {
	const jobs = getJobs();
	const hasJobs = jobs.length > 0;
	const showWin = (hasJobs || forceOpen) && expanded && !minimized;
	if (winEl) {
		const wasHidden = winEl.style.display === "none";
		winEl.style.display = showWin ? "" : "none";
		if (showWin && !maximized) clampWin(winEl);
		// Rebuild frais à chaque ouverture (settings toujours à jour)
		if (showWin && wasHidden) builtSection = null;
	}
	if (!hasJobs && !forceOpen) {
		paintTaskbar();
		return;
	}

	applyTheme();
	paintTaskbar();
	renderNav();
	if (builtSection !== section) {
		buildBody();
		builtSection = section;
	}
	if (section === "downloads") renderList();
	else if (section === "history") renderHistory();
}

function renderNav() {
	if (!winEl) return;
	winEl.querySelectorAll(".sd-win-navitem").forEach((el) => {
		el.classList.toggle("sd-win-navitem-active", (el as HTMLElement).dataset.section === section);
	});
}
function shortFolder(folder: string): string {
	const parts = folder.split(/[/\\]/).filter(Boolean);
	return parts.length > 0 ? parts[parts.length - 1] : folder;
}

function closeJobMenu() {
	document.getElementById(JOBMENU_ID)?.remove();
}

/** Clic droit sur un job : menu contextuel Win10 avec tracks en cours + actions. */
function showJobMenu(job: QueueJob, x: number, y: number) {
	closeJobMenu();
	const menu = document.createElement("div");
	menu.id = JOBMENU_ID;
	menu.className = "sd-quickmenu";
	if (settings.winTheme === "dark") menu.classList.add("sd-qm-dark");

	const header = document.createElement("div");
	header.className = "sd-qm-item sd-qm-disabled";
	header.innerHTML = `<span>${job.title}</span><span class="sd-qm-sub">${job.done}/${job.total} · ${statusLabel(job)}</span>`;
	menu.appendChild(header);
	menu.appendChild(sep());

	if (job.status === "active") {
		const now = [...job.current.values()];
		const nowTitle = document.createElement("div");
		nowTitle.className = "sd-qm-item sd-qm-disabled";
		nowTitle.innerHTML = `<span>Downloading now (${now.length})</span>`;
		menu.appendChild(nowTitle);
		if (now.length === 0) {
			const none = document.createElement("div");
			none.className = "sd-qm-item sd-qm-disabled";
			none.innerHTML = `<span class="sd-qm-sub">starting…</span>`;
			menu.appendChild(none);
		}
		for (const track of now.slice(0, 5)) {
			const t = document.createElement("div");
			t.className = "sd-qm-item sd-qm-disabled sd-qm-track";
			t.title = track.label;
			t.textContent = `♫ ${track.label}`;
			menu.appendChild(t);
		}
		menu.appendChild(sep());
	}

	const folderItem = document.createElement("div");
	folderItem.className = "sd-qm-item sd-qm-disabled";
	folderItem.innerHTML = `<span class="sd-qm-sub">Folder: ${job.folderOverride ? shortFolder(job.folderOverride) : "default"}</span>`;
	menu.appendChild(folderItem);

	if (job.status === "queued" || job.status === "active") {
		const folderBtn = document.createElement("button");
		folderBtn.type = "button";
		folderBtn.className = "sd-qm-item";
		folderBtn.textContent = "Save to another folder…";
		folderBtn.onclick = async (e) => {
			e.stopPropagation();
			closeJobMenu();
			const folder = await getDownloadFolder();
			if (folder === undefined) return;
			setJobFolder(job.id, folder);
		};
		menu.appendChild(folderBtn);
	}

	const actBtn = document.createElement("button");
	actBtn.type = "button";
	actBtn.className = "sd-qm-item";
	if (job.status === "active") {
		actBtn.textContent = "Stop this download";
		actBtn.onclick = (e) => {
			e.stopPropagation();
			closeJobMenu();
			cancelJob(job.id);
		};
	} else if (job.status === "queued") {
		actBtn.textContent = "Remove from queue";
		actBtn.onclick = (e) => {
			e.stopPropagation();
			closeJobMenu();
			cancelJob(job.id);
		};
	} else {
		actBtn.textContent = "Dismiss";
		actBtn.onclick = (e) => {
			e.stopPropagation();
			closeJobMenu();
			removeJob(job.id);
		};
	}
	menu.appendChild(actBtn);

	document.body.appendChild(menu);
	const w = menu.offsetWidth || 260;
	const h = menu.offsetHeight || 120;
	menu.style.left = `${Math.max(0, Math.min(window.innerWidth - w, x))}px`;
	menu.style.top = `${Math.max(0, Math.min(window.innerHeight - h, y))}px`;

	const onPointerDown = (ev: PointerEvent) => {
		if (!menu.contains(ev.target as Node)) closeJobMenu();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") closeJobMenu();
	};
	document.addEventListener("pointerdown", onPointerDown, { once: true });
	document.addEventListener("keydown", onKey, { once: true });
	unloads.add(() => {
		closeJobMenu();
		document.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("keydown", onKey);
	});

	function sep(): HTMLDivElement {
		const d = document.createElement("div");
		d.className = "sd-qm-sep";
		return d;
	}
}

// #endregion

// #region Section Downloads
function renderList() {
	if (!winEl) return;
	const list = winEl.querySelector(".sd-island-list") as HTMLDivElement | null;
	if (!list) return;
	// Ne pas reconstruire pendant un drag & drop (casserait le geste)
	if (dragId !== null) return;
	const jobs = getJobs();
	list.innerHTML = "";
	if (jobs.length === 0) {
		const empty = document.createElement("div");
		empty.className = "sd-win-empty";
		empty.textContent = "Queue is empty. Right-click tracks, albums or playlists and hit Download.";
		list.appendChild(empty);
		return;
	}
	let qindex = 0;
	for (const job of jobs) {
		const wrap = document.createElement("div");
		wrap.className = "sd-island-jobwrap";
		const row = document.createElement("div");
		row.className = `sd-island-row sd-island-${job.status}`;
		row.dataset.jobId = String(job.id);
		row.title = "Click to expand tracks";
		const isQueued = job.status === "queued";
		if (isQueued) {
			row.dataset.qindex = String(qindex++);
			row.draggable = true;
		}

		const handle = document.createElement("span");
		handle.className = "sd-island-handle";
		handle.textContent = isQueued ? "⋮⋮" : "";
		handle.title = isQueued ? "Drag to reorder" : "";
		row.appendChild(handle);

		const dot = document.createElement("span");
		dot.className = "sd-island-dot";
		row.appendChild(dot);

		const exp = document.createElement("span");
		exp.className = "sd-island-exp";
		exp.textContent = job.tracksOpen ? "▾" : "▸";
		exp.title = "Show tracks";
		row.appendChild(exp);

		const main = document.createElement("div");
		main.className = "sd-island-main";
		const title = document.createElement("div");
		title.className = "sd-island-title";
		title.textContent = job.title;
		title.title = job.title;
		const sub = document.createElement("div");
		sub.className = "sd-island-sub";
		const skippedTxt = job.skipped > 0 ? ` · ${job.skipped} skipped` : "";
		sub.innerHTML = `<span class="sd-island-count">${job.done}/${job.total}</span> · ${statusLabel(job)}${skippedTxt}`;
		main.appendChild(title);
		main.appendChild(sub);
		if (job.status === "active" || job.status === "queued") {
			const bar = document.createElement("div");
			bar.className = "sd-island-bar";
			const fill = document.createElement("div");
			fill.className = "sd-island-bar-fill";
			fill.style.width = job.total > 0 ? `${(job.done / job.total) * 100}%` : "0%";
			bar.appendChild(fill);
			main.appendChild(bar);
		}
		row.appendChild(main);

		const action = document.createElement("button");
		action.type = "button";
		action.className = "sd-island-action";
		if (job.status === "active") {
			action.textContent = "■";
			action.title = "Stop this download";
			action.onclick = (e) => {
				e.stopPropagation();
				cancelJob(job.id);
			};
		} else {
			action.textContent = "✕";
			action.title = job.status === "queued" ? "Remove from queue" : "Dismiss";
			action.onclick = (e) => {
				e.stopPropagation();
				if (job.status === "queued") cancelJob(job.id);
				else removeJob(job.id);
			};
		}
		row.appendChild(action);

		// Clic droit : menu contextuel Win10 (tracks en cours + actions)
		row.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			showJobMenu(job, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
		});

		if (isQueued) {
			row.addEventListener("dragstart", (e) => {
				dragId = job.id;
				row.classList.add("sd-island-dragging");
				e.dataTransfer!.effectAllowed = "move";
				try {
					e.dataTransfer!.setData("text/plain", String(job.id));
				} catch {
					// ignore
				}
			});
			row.addEventListener("dragend", () => {
				dragId = null;
				document.querySelectorAll(`#${WIN_ID} .sd-island-dragover`).forEach((el) => el.classList.remove("sd-island-dragover"));
				row.classList.remove("sd-island-dragging");
			});
		}
		row.addEventListener("dragover", (e) => {
			if (dragId === null) return;
			const target = (e.target as HTMLElement).closest("[data-qindex]") as HTMLElement | null;
			if (!target || Number(target.dataset.jobId) === dragId) return;
			e.preventDefault();
			e.dataTransfer!.dropEffect = "move";
			target.classList.add("sd-island-dragover");
		});
		row.addEventListener("dragleave", (e) => {
			(e.currentTarget as HTMLElement).classList.remove("sd-island-dragover");
		});
		row.addEventListener("drop", (e) => {
			e.preventDefault();
			if (dragId === null) return;
			const target = (e.target as HTMLElement).closest("[data-qindex]") as HTMLElement | null;
			const id = dragId;
			dragId = null;
			if (target) moveJob(id, Number(target.dataset.qindex));
			else renderList();
		});

		// Clic : déplie les tracks en cours de download
		row.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest("button, .sd-island-handle")) return;
			job.tracksOpen = !job.tracksOpen;
			renderList();
		});

		wrap.appendChild(row);
		if (job.tracksOpen) {
			const tracks = document.createElement("div");
			tracks.className = "sd-island-tracks";
			if (job.current.size === 0) {
				const wait = document.createElement("div");
				wait.className = "sd-island-wait";
				wait.textContent = job.status === "active" ? "Waiting for next tracks…" : "No track in progress.";
				tracks.appendChild(wait);
			}
			for (const entry of job.current.values()) tracks.appendChild(buildTrackEl(entry));
			wrap.appendChild(tracks);
		}
		list.appendChild(wrap);
	}
}

function formatMB(bytes?: number): string {
	if (bytes === undefined) return "?";
	return `${(bytes / 1048576).toFixed(1)}MB`;
}

function setTrackProgress(t: Element, entry: ActiveTrack) {
	const pct = entry.total ? ((entry.downloaded ?? 0) / entry.total) * 100 : 0;
	const fill = t.querySelector(".sd-island-trackfill") as HTMLDivElement | null;
	const sub = t.querySelector(".sd-island-trackpct") as HTMLSpanElement | null;
	if (fill) fill.style.width = `${pct}%`;
	if (sub) sub.textContent = entry.total ? `${formatMB(entry.downloaded)}/${formatMB(entry.total)} · ${pct.toFixed(0)}%` : "starting…";
}

function buildTrackEl(entry: ActiveTrack): HTMLDivElement {
	const t = document.createElement("div");
	t.className = "sd-island-track";
	t.dataset.trackKey = entry.key;
	if (entry.cover) {
		const img = document.createElement("img");
		img.className = "sd-island-thumb";
		img.src = entry.cover;
		img.alt = "";
		img.draggable = false;
		img.onerror = () => img.remove();
		t.appendChild(img);
	}
	const main = document.createElement("div");
	main.className = "sd-island-trackmain";
	const title = document.createElement("div");
	title.className = "sd-island-tracktitle";
	title.textContent = entry.label;
	title.title = entry.label;
	const sub = document.createElement("div");
	sub.className = "sd-island-tracksub";
	sub.innerHTML = `<span class="sd-island-trackpct"></span>`;
	main.appendChild(title);
	main.appendChild(sub);
	const bar = document.createElement("div");
	bar.className = "sd-island-trackbar";
	const fill = document.createElement("div");
	fill.className = "sd-island-trackfill";
	bar.appendChild(fill);
	main.appendChild(bar);
	t.appendChild(main);
	setTrackProgress(t, entry);
	return t;
}
// #endregion

// #region Section History
function renderHistory() {
	if (!winEl) return;
	const count = winEl.querySelector(".sd-win-hist-count") as HTMLElement | null;
	if (count) count.textContent = String(countDownloaded());
}
// #endregion

// #region Controles Win10
function makeToggle(label: string, desc: string, get: () => boolean, set: (v: boolean) => void): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "sd-win-setting";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const box = document.createElement("button");
	box.type = "button";
	box.className = "sd-win-checkbox";
	box.setAttribute("role", "checkbox");
	const sync = () => {
		const on = get();
		box.classList.toggle("sd-win-checkbox-on", on);
		box.setAttribute("aria-checked", String(on));
	};
	box.onclick = () => {
		set(!get());
		sync();
	};
	sync();
	const texts = document.createElement("div");
	texts.className = "sd-win-setting-texts";
	const title = document.createElement("div");
	title.className = "sd-win-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "sd-win-setting-desc";
	sub.textContent = desc;
	texts.appendChild(title);
	texts.appendChild(sub);
	row.appendChild(box);
	row.appendChild(texts);
	row.onclick = (e) => {
		// Clic sur le label = toggle aussi (comme Win10)
		if ((e.target as HTMLElement).closest("button")) return;
		set(!get());
		sync();
	};
	return row;
}

function makeTextRow(label: string, desc: string, get: () => string, set: (v: string) => void): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "sd-win-setting sd-win-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "sd-win-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "sd-win-setting-desc";
	sub.textContent = desc;
	const input = document.createElement("input");
	input.type = "text";
	input.className = "sd-win-textbox";
	input.value = get();
	input.onchange = () => set(input.value);
	row.appendChild(title);
	row.appendChild(sub);
	row.appendChild(input);
	return row;
}

function makeTextareaRow(label: string, desc: string, get: () => string, set: (v: string) => void): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "sd-win-setting sd-win-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "sd-win-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "sd-win-setting-desc";
	sub.textContent = desc;
	const input = document.createElement("textarea");
	input.className = "sd-win-textbox sd-win-textarea";
	input.rows = 6;
	input.spellcheck = false;
	input.value = get();
	input.onchange = () => set(input.value);
	row.appendChild(title);
	row.appendChild(sub);
	row.appendChild(input);
	return row;
}

function buildSettingsPage(body: HTMLDivElement) {
	body.innerHTML = "";

	const searchRow = document.createElement("div");
	searchRow.className = "sd-win-searchrow";
	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.className = "sd-win-textbox sd-win-search";
	searchInput.placeholder = "Find a setting";
	searchInput.value = search;
	searchInput.oninput = () => {
		search = searchInput.value.toLowerCase();
		body.querySelectorAll(".sd-win-setting").forEach((el) => {
			const hay = (el as HTMLElement).dataset.search ?? "";
			(el as HTMLElement).style.display = hay.includes(search) ? "" : "none";
		});
	};
	searchRow.appendChild(searchInput);
	body.appendChild(searchRow);

	const h = (text: string) => {
		const el = document.createElement("div");
		el.className = "sd-win-grouptitle";
		el.textContent = text;
		body.appendChild(el);
	};

	h("Appearance");
	body.appendChild(
		makeToggle("Dark theme", "Dark mode for this window (light by default, like Windows 10)", () => settings.winTheme === "dark", (v) => {
			settings.winTheme = v ? "dark" : "light";
			applyTheme();
		}),
	);

	h("Quality");
	const qualRow = document.createElement("div");
	qualRow.className = "sd-win-setting sd-win-setting-col";
	qualRow.dataset.search = "download quality flac max";
	const qualTitle = document.createElement("div");
	qualTitle.className = "sd-win-setting-title";
	qualTitle.textContent = "Download quality";
	const qualSelect = document.createElement("select");
	qualSelect.className = "sd-win-combo";
	for (const quality of Object.values(Quality.lookups.audioQuality)) {
		if (typeof quality === "string" || quality.audioQuality === Quality.MQA.audioQuality) continue;
		const opt = document.createElement("option");
		opt.value = quality.audioQuality;
		opt.textContent = quality.name;
		qualSelect.appendChild(opt);
	}
	qualSelect.value = settings.downloadQuality;
	qualSelect.onchange = () => {
		const v = qualSelect.value as redux.AudioQuality;
		if (Quality.fromAudioQuality(v) !== undefined) settings.downloadQuality = v;
	};
	qualRow.appendChild(qualTitle);
	qualRow.appendChild(qualSelect);
	body.appendChild(qualRow);

	const folderRow = document.createElement("div");
	folderRow.className = "sd-win-setting";
	folderRow.dataset.search = "default save folder path directory";
	const folderTexts = document.createElement("div");
	folderTexts.className = "sd-win-setting-texts";
	const folderTitle = document.createElement("div");
	folderTitle.className = "sd-win-setting-title";
	folderTitle.textContent = "Default save folder";
	const folderSub = document.createElement("div");
	folderSub.className = "sd-win-setting-desc";
	folderSub.textContent = settings.defaultPath ?? "Not set (you will be asked each time)";
	folderTexts.appendChild(folderTitle);
	folderTexts.appendChild(folderSub);
	const folderBtn = document.createElement("button");
	folderBtn.type = "button";
	folderBtn.className = "sd-win-btn";
	folderBtn.textContent = settings.defaultPath ? "Clear" : "Browse";
	folderBtn.onclick = async () => {
		if (settings.defaultPath !== undefined) {
			settings.defaultPath = undefined;
		} else {
			settings.defaultPath = await getDownloadFolder();
		}
		folderSub.textContent = settings.defaultPath ?? "Not set (you will be asked each time)";
		folderBtn.textContent = settings.defaultPath ? "Clear" : "Browse";
	};
	folderRow.appendChild(folderTexts);
	folderRow.appendChild(folderBtn);
	body.appendChild(folderRow);

	body.appendChild(
		makeTextRow("Path format", "Subfolders with /. Example: {artist}/{album}/{title}", () => settings.pathFormat, (v) => (settings.pathFormat = v)),
	);

	h("Content");
	body.appendChild(
		makeToggle("Use RealMAX", "Find the highest available quality per track", () => settings.useRealMAX, (v) => (settings.useRealMAX = v)),
	);
	body.appendChild(
		makeToggle("Download lyrics", "Save a .lyrics text file next to each track", () => settings.downloadLyrics, (v) => (settings.downloadLyrics = v)),
	);
	body.appendChild(makeTextRow("Lyrics suffix", "Appended to the audio filename", () => settings.lyricsSuffix, (v) => (settings.lyricsSuffix = v)));
	body.appendChild(
		makeToggle("Download metadata file", "Save a customizable text file next to each track", () => settings.downloadMeta, (v) => (settings.downloadMeta = v)),
	);
	body.appendChild(makeTextRow("Metadata suffix", "Appended to the audio filename", () => settings.metaSuffix, (v) => (settings.metaSuffix = v)));
	body.appendChild(
		makeTextareaRow(
			"Metadata template",
			"One {tag} per line is replaced by its value. Available: {title} {trackNumber} {discNumber} {bpm} {year} {date} {copyright} {comment} {isrc} {upc} {artist} {album} {albumArtist} {genres}",
			() => settings.metaTemplate,
			(v) => (settings.metaTemplate = v),
		),
	);
	body.appendChild(
		makeToggle(
			"Auto-download played tracks",
			"Requires a default save folder. Already downloaded files are skipped.",
			() => settings.autoDownloadPlayed,
			(v) => (settings.autoDownloadPlayed = v),
		),
	);

	h("Tags");
	const tagsRow = document.createElement("div");
	tagsRow.className = "sd-win-setting sd-win-setting-col";
	tagsRow.dataset.search = "tags filename format artist album title";
	const tagsTitle = document.createElement("div");
	tagsTitle.className = "sd-win-setting-title";
	tagsTitle.textContent = "Available filename tags";
	const tagsList = document.createElement("div");
	tagsList.className = "sd-win-setting-desc";
	tagsList.textContent = MediaItem.availableTags.map((t) => `{${t}}`).join(" ");
	tagsRow.appendChild(tagsTitle);
	tagsRow.appendChild(tagsList);
	body.appendChild(tagsRow);
}

function buildHistoryPage(body: HTMLDivElement) {
	body.innerHTML = "";
	const hero = document.createElement("div");
	hero.className = "sd-win-hero";
	hero.innerHTML = `<div class="sd-win-hero-num sd-win-hist-count">${countDownloaded()}</div><div class="sd-win-hero-label">tracks remembered</div>`;
	body.appendChild(hero);
	const desc = document.createElement("div");
	desc.className = "sd-win-setting-desc";
	desc.textContent = "Remembered tracks are skipped automatically (manual, queue and auto-download). Forgetting them will download them again.";
	body.appendChild(desc);
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "sd-win-btn";
	btn.textContent = "Forget all";
	btn.onclick = () => {
		clearDownloaded();
		renderHistory();
	};
	body.appendChild(btn);
}

function buildDownloadsPage(body: HTMLDivElement) {
	body.innerHTML = "";
	const toolbar = document.createElement("div");
	toolbar.className = "sd-win-toolbar";
	const stopAllBtn = document.createElement("button");
	stopAllBtn.type = "button";
	stopAllBtn.className = "sd-win-btn";
	stopAllBtn.textContent = "Stop all";
	stopAllBtn.onclick = () => cancelAll();
	const clearBtn = document.createElement("button");
	clearBtn.type = "button";
	clearBtn.className = "sd-win-btn";
	clearBtn.textContent = "Clear finished";
	clearBtn.onclick = () => clearFinished();
	toolbar.appendChild(stopAllBtn);
	toolbar.appendChild(clearBtn);
	body.appendChild(toolbar);

	// Dossier de sortie + path picker (appliqué aux nouveaux downloads)
	const folderRow = document.createElement("div");
	folderRow.className = "sd-win-outrow";
	const folderVal = document.createElement("span");
	folderVal.className = "sd-win-folderval";
	const paintFolder = () => {
		const full = settings.defaultPath;
		folderVal.textContent = full ? `Output: ${shortFolder(full)}` : "Output: (asked each time)";
		folderVal.title = full ?? "No default folder";
		folderBtn.textContent = full ? "Change…" : "Choose…";
	};
	const folderBtn = document.createElement("button");
	folderBtn.type = "button";
	folderBtn.className = "sd-win-btn sd-win-btn-small";
	folderBtn.onclick = async () => {
		const folder = await getDownloadFolder();
		if (folder === undefined) return;
		settings.defaultPath = folder;
		paintFolder();
	};
	paintFolder();
	folderRow.appendChild(folderVal);
	folderRow.appendChild(folderBtn);
	body.appendChild(folderRow);

	const list = document.createElement("div");
	list.className = "sd-island-list";
	body.appendChild(list);
	renderList();
}
// #endregion

// #region Montage
const NAV: { id: Section; label: string; glyph: string }[] = [
	{ id: "downloads", label: "Downloads", glyph: "⬇" },
	{ id: "history", label: "History", glyph: "✓" },
	{ id: "settings", label: "Settings", glyph: "⚙" },
];

export function mountIsland() {
	if (document.getElementById(TASKBAR_ID)) return;

	// Taskbar Win10 (toujours visible, lance la fenêtre)
	const taskbar = document.createElement("div");
	taskbar.id = TASKBAR_ID;
	taskbar.className = "sd-taskbar";
	appBtn = document.createElement("button");
	appBtn.type = "button";
	appBtn.className = "sd-taskbar-app";
	appBtn.title = "SongDownloaderV2";
	appBtn.innerHTML = `<span class="sd-taskbar-app-icon">${WIN10_LOGO}</span>`;
	appBtn.onclick = () => {
		if (isWinShown()) {
			minimized = true;
		} else {
			expanded = true;
			minimized = false;
			if (getJobs().length === 0) forceOpen = true;
		}
		render();
	};
	taskbar.appendChild(appBtn);
	const spacer = document.createElement("div");
	spacer.className = "sd-taskbar-spacer";
	taskbar.appendChild(spacer);
	statusEl = document.createElement("span");
	statusEl.className = "sd-taskbar-status";
	statusEl.style.display = "none";
	taskbar.appendChild(statusEl);
	const clock = document.createElement("div");
	clock.className = "sd-taskbar-clock";
	clock.title = "Open calendar";
	clock.style.cursor = "pointer";
	clock.onclick = () => {
		if (document.getElementById(CAL_ID)) closeCalendar();
		else openCalendar();
	};
	timeEl = document.createElement("span");
	timeEl.className = "sd-taskbar-time";
	dateEl = document.createElement("span");
	dateEl.className = "sd-taskbar-date";
	clock.appendChild(timeEl);
	clock.appendChild(dateEl);
	taskbar.appendChild(clock);
	document.body.appendChild(taskbar);
	taskbarEl = taskbar;
	tickClock();
	safeInterval(unloads, tickClock, 10000);

	// Fenêtre Win10
	winEl = document.createElement("div");
	winEl.id = WIN_ID;
	winEl.className = "sd-win";
	winEl.style.display = "none";

	const titlebar = document.createElement("div");
	titlebar.className = "sd-win-titlebar";
	const left = document.createElement("div");
	left.className = "sd-win-titleleft";
	const avatar = document.createElement("img");
	avatar.className = "sd-win-avatar";
	avatar.src = "https://github.com/Kisakay.png";
	avatar.alt = "";
	avatar.onerror = () => avatar.remove();
	left.appendChild(avatar);
	const titleWrap = document.createElement("span");
	titleWrap.className = "sd-win-titletxt";
	titleWrap.innerHTML = `SongDownloaderV2 <span class="sd-win-credit">by Kisakay</span>`;
	left.appendChild(titleWrap);
	const capBtns = document.createElement("div");
	capBtns.className = "sd-win-caption";
	const minBtn = document.createElement("button");
	minBtn.type = "button";
	minBtn.className = "sd-win-capbtn";
	minBtn.innerHTML = GLYPH_MIN;
	minBtn.title = "Minimize";
	minBtn.setAttribute("aria-label", "Minimize");
	minBtn.onclick = () => {
		minimized = true;
		render();
	};
	const maxBtn = document.createElement("button");
	maxBtn.type = "button";
	maxBtn.className = "sd-win-capbtn sd-win-maxbtn";
	maxBtn.innerHTML = GLYPH_MAX;
	maxBtn.title = "Maximize";
	maxBtn.setAttribute("aria-label", "Maximize");
	maxBtn.onclick = () => toggleMaximize();
	const closeBtn = document.createElement("button");
	closeBtn.type = "button";
	closeBtn.className = "sd-win-capbtn sd-win-close";
	closeBtn.innerHTML = GLYPH_CLOSE;
	closeBtn.title = "Close";
	closeBtn.setAttribute("aria-label", "Close");
	closeBtn.onclick = () => {
		expanded = false;
		minimized = false;
		forceOpen = false;
		render();
	};
	capBtns.appendChild(minBtn);
	capBtns.appendChild(maxBtn);
	capBtns.appendChild(closeBtn);
	titlebar.appendChild(left);
	titlebar.appendChild(capBtns);
	winEl.appendChild(titlebar);
	makeWinDraggable(winEl, titlebar);

	const content = document.createElement("div");
	content.className = "sd-win-content";
	const nav = document.createElement("div");
	nav.className = "sd-win-nav";
	for (const item of NAV) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "sd-win-navitem";
		btn.dataset.section = item.id;
		btn.innerHTML = `<span class="sd-win-navglyph">${item.glyph}</span><span>${item.label}</span>`;
		btn.onclick = () => {
			section = item.id;
			render();
		};
		nav.appendChild(btn);
	}
	content.appendChild(nav);
	winBody = document.createElement("div");
	winBody.className = "sd-win-body";
	content.appendChild(winBody);
	winEl.appendChild(content);

	const grip = document.createElement("div");
	grip.className = "sd-win-resize";
	grip.title = "Resize";
	winEl.appendChild(grip);
	makeWinResizable(winEl, grip);

	document.body.appendChild(winEl);
	applySavedGeom(winEl);

	unloads.add(() => {
		taskbarEl?.remove();
		winEl?.remove();
		closeCalendar();
		taskbarEl = appBtn = statusEl = timeEl = dateEl = null;
		winEl = winBody = null;
	});

	onQueueChange(render);
	setQueueProgressPainter(paintJob);
	render();
}

function buildBody() {
	if (!winBody) return;
	if (section === "downloads") buildDownloadsPage(winBody);
	else if (section === "history") buildHistoryPage(winBody);
	else buildSettingsPage(winBody);
}
// #endregion
