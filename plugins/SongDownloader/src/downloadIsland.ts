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
import { DEFAULT_ACCENT, isValidAccent, settings } from "./Settings";
import { ABOUT_ID, isAboutOpen, mountAboutWindow, onAboutChange, refreshAboutTheme, toggleAbout } from "./aboutWindow";
import { dateLocaleTag, LOCALES, LOCALE_NAMES, onLanguageChange, setLocaleOverride, t, type LangSetting } from "./i18n";
import {
	DOWNLOAD_ICON,
	GLOBE_ICON,
	INFO_ICON,
	WIN10_LOGO,
	Win10Taskbar,
	Win10Window,
	confirmWin10,
	showWin10Menu,
	w10Button,
	w10ComboRow,
	w10Desc,
	w10GroupTitle,
	w10Hero,
	w10MenuHeader,
	w10MenuItem,
	w10Separator,
	w10TextRow,
	w10TextareaRow,
	w10Toggle,
} from "win10ml";

const TASKBAR_ID = "luna-songdownloader-taskbar";
const WIN_ID = "luna-songdownloader-win";
const CAL_ID = "luna-songdownloader-cal";
const JOBMENU_ID = "luna-songdownloader-jobmenu";
const APP_ID = "downloader";

type Section = "downloads" | "history" | "settings" | "theme" | "languages";

// Palette officielle Windows 10 (Paramètres > Personnalisation > Couleurs)
const THEME_ACCENTS = [
	"#0078d7",
	"#00b7c3",
	"#00b294",
	"#009e49",
	"#10893e",
	"#bad80a",
	"#ffb900",
	"#ff8c00",
	"#ca5010",
	"#e81123",
	"#ba141a",
	"#ec008c",
	"#b4009e",
	"#68217a",
	"#00188f",
	"#003788",
	"#004b8d",
	"#4c4c4c",
];

function currentAccent(): string {
	return isValidAccent(settings.accent) ? settings.accent : DEFAULT_ACCENT;
}

function applyAccent() {
	const accent = currentAccent();
	// Variable héritée par les fenêtres, la taskbar, le calendrier et les menus
	document.documentElement.style.setProperty("--w10-accent", accent);
	managerWin?.setAccent(accent);
	taskbar?.setAccent(accent);
	refreshAboutTheme();
	document.getElementById(CAL_ID)?.style.setProperty("--w10-accent", accent);
	document.getElementById(JOBMENU_ID)?.style.setProperty("--w10-accent", accent);
}

let taskbar: Win10Taskbar | null = null;
let managerWin: Win10Window | null = null;
let navSync: ((id: Section) => void) | null = null;
let expanded = false;
let minimized = false;
let forceOpen = false;
let section: Section = "downloads";
let builtSection: Section | null = null;
let search = "";
let dragId: number | null = null;
/** Garde anti double-confirm (Close spammé pendant le dialog). */
let msgOpen = false;
/** Statut taskbar de l'auto-download (visible quand aucun job manuel). */
let autoStatus: string | null = null;

/** Thème courant pour les dialogs framework. */
export function msgTheme(): { theme: "light" | "dark"; accent: string } {
	return { theme: settings.winTheme, accent: currentAccent() };
}

function closeManager(): void {
	expanded = false;
	minimized = false;
	forceOpen = false;
	render();
}

/** Statut taskbar piloté par l'auto-download (autoDownload.ts). */
export function setAutoTaskbarStatus(html: string | null): void {
	autoStatus = html;
	repaintTaskbar();
}

export function repaintTaskbar(): void {
	paintTaskbar();
}

const statusLabel = (job: QueueJob): string => {
	switch (job.status) {
		case "active":
			return t("st.downloading");
		case "queued":
			return t("st.queued");
		case "done":
			return job.failed > 0 ? t("st.doneFailed", { n: job.failed }) : t("st.done");
		case "stopped":
			return t("st.stopped");
	}
};

function summaryText(): string {
	const jobs = getJobs();
	const active = jobs.find((j) => j.status === "active");
	const queued = jobs.filter((j) => j.status === "queued").length;
	if (active) {
		const base = t("sum.active", { done: active.done, total: active.total });
		return queued > 0 ? t("sum.activeQ", { done: active.done, total: active.total, n: queued }) : base;
	}
	if (queued > 0) return t("sum.queued", { n: queued });
	const done = jobs.filter((j) => j.status === "done").length;
	return done > 0 ? t("sum.finished", { n: done }) : t("sum.empty");
}

function isWinShown(): boolean {
	const jobs = getJobs();
	return (jobs.length > 0 || forceOpen) && expanded && !minimized;
}

function applyTheme() {
	managerWin?.setTheme(settings.winTheme);
	applyAccent();
}

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
				wait.textContent = job.status === "active" ? t("trk.waiting") : t("trk.none");
				tracks.appendChild(wait);
			}
		}
	}
	paintTaskbar();
}

// #region ETA restant (débit observé + taille moyenne des tracks)
const etaState = {
	speed: 0, // octets/s, moyenne mobile exponentielle
	lastT: 0,
	lastBytes: 0,
	avgTrackBytes: 0, // taille moyenne apprise des tracks observées
	avgTrackCount: 0,
	seenTotals: new Set<string>(),
	extra: "", // " · 4.2 MB/s · ~3 min left" (recalculé 1×/s max)
	extraAt: 0,
};

function resetEta() {
	etaState.speed = 0;
	etaState.lastT = 0;
	etaState.lastBytes = 0;
	etaState.extra = "";
	etaState.extraAt = 0;
}

function formatSpeed(bps: number): string {
	if (!isFinite(bps) || bps <= 0) return "";
	const mb = bps / 1048576;
	if (mb >= 10) return `${mb.toFixed(0)} MB/s`;
	if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
	return `${Math.max(1, Math.round(bps / 1024))} KB/s`;
}

function formatEta(sec: number): string {
	if (!isFinite(sec) || sec < 0) return "";
	const s = Math.round(sec);
	if (s < 60) return t("eta.s", { n: Math.max(1, s) });
	const m = Math.floor(s / 60);
	if (m < 60) return t("eta.m", { n: m });
	return t("eta.hm", { h: Math.floor(m / 60), m: m % 60 });
}

/**
 * Estime le débit et le temps restant à partir des octets réellement reçus
 * (pollés toutes les 50ms par les workers) et de la taille moyenne des tracks.
 * Recalculé au plus 1×/seconde (paintTaskbar est appelée ~100×/s en download).
 */
function statusEtaExtra(jobs: QueueJob[]): string {
	const now = performance.now();
	if (etaState.extraAt > 0 && now - etaState.extraAt < 1000) return etaState.extra;
	etaState.extraAt = now;

	let inFlightBytes = 0;
	let knownLeft = 0;
	let notStarted = 0;
	for (const job of jobs) {
		if (job.status === "queued") {
			notStarted += job.total;
			continue;
		}
		if (job.status !== "active") continue;
		for (const entry of job.current.values()) {
			inFlightBytes += entry.downloaded ?? 0;
			if (entry.total !== undefined && entry.total > 0) {
				knownLeft += Math.max(0, entry.total - (entry.downloaded ?? 0));
				const key = `${job.id}:${entry.key}`;
				if (!etaState.seenTotals.has(key)) {
					etaState.seenTotals.add(key);
					etaState.avgTrackCount++;
					etaState.avgTrackBytes += (entry.total - etaState.avgTrackBytes) / Math.min(etaState.avgTrackCount, 50);
				}
			}
		}
		notStarted += Math.max(0, job.total - job.done - job.current.size);
	}

	// Débit : delta d'octets reçus sur ~1s, lissé (inclut les phases fixes
	// RealMAX/tags/lyrics où rien ne bouge, donc l'ETA reste honnête).
	if (etaState.lastT > 0) {
		const dt = (now - etaState.lastT) / 1000;
		if (dt > 0) {
			const delta = inFlightBytes - etaState.lastBytes;
			if (delta >= 0) {
				const inst = delta / dt;
				etaState.speed = etaState.speed === 0 ? inst : etaState.speed * 0.7 + inst * 0.3;
			}
		}
	}
	etaState.lastT = now;
	etaState.lastBytes = inFlightBytes;

	const speedTxt = formatSpeed(etaState.speed);
	let remaining = knownLeft;
	if (etaState.avgTrackBytes > 0) remaining += notStarted * etaState.avgTrackBytes;
	const etaTxt = etaState.speed > 0 && remaining > 0 ? formatEta(remaining / etaState.speed) : "";

	if (!speedTxt && !etaTxt) {
		etaState.extra = "";
		return "";
	}
	etaState.extra = `${speedTxt ? ` · ${speedTxt}` : ""}${etaTxt ? ` · ${etaTxt}` : ""}`;
	return etaState.extra;
}
// #endregion

function paintTaskbar() {
	if (!taskbar) return;
	const jobs = getJobs();
	const open = isWinShown();
	// Comme le vrai Win10 : la barre accent est là dès que l'app est
	// ouverte (fenêtre visible), pas seulement pendant un download.
	const running = jobs.length > 0 || open || autoStatus !== null;
	taskbar.setAppState(APP_ID, { running, open });
	// L'app About suit sa fenêtre (ouverte = soulignée + surlignée)
	const aboutOpen = isAboutOpen();
	taskbar.setAppState(ABOUT_ID, { running: aboutOpen, open: aboutOpen });
	taskbar.setAppTitle(APP_ID, jobs.length > 0 ? `Downloader Manager — ${summaryText()}` : "Downloader Manager");
	const active = jobs.find((j) => j.status === "active");
	const queued = jobs.filter((j) => j.status === "queued").length;
	if (!active) resetEta();
	let html: string | null = null;
	if (active) {
		const current = [...active.current.values()][0]?.label;
		const extra = statusEtaExtra(jobs);
		html = `<span class="w10-status-icon">⬇</span><span>${active.done}/${active.total}${current ? ` · ${escapeHtml(current)}` : ""}${queued > 0 ? ` · ${t("sum.queued", { n: queued })}` : ""}${extra}</span>`;
	} else if (queued > 0) {
		html = `<span class="w10-status-icon">⬇</span><span>${t("sum.queued", { n: queued })}</span>`;
	} else if (jobs.length > 0) {
		html = `<span>${t("task.finished")}</span>`;
	} else if (autoStatus !== null) {
		html = autoStatus;
	}
	taskbar.setStatus(html);
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toggleManager() {
	if (isWinShown()) {
		minimized = true;
	} else {
		expanded = true;
		minimized = false;
		if (getJobs().length === 0) forceOpen = true;
	}
	render();
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
	cal.style.setProperty("--w10-accent", currentAccent());

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
	prev.title = t("cal.prev");
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
	next.title = t("cal.next");
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
	foot.textContent = t("cal.today", { date: today.toLocaleDateString(dateLocaleTag(), { day: "2-digit", month: "2-digit", year: "numeric" }) });
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
		dow.textContent = d.toLocaleDateString(dateLocaleTag(), { weekday: "short" }).replace(".", "");
		grid.appendChild(dow);
	}
	// 1er janvier 2024 = lundi -> décalage mois
	const first = new Date(calYear, calMonth, 1);
	const lead = (first.getDay() + 6) % 7;
	const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
	const daysPrev = new Date(calYear, calMonth, 0).getDate();
	for (let i = lead - 1; i >= 0; i--) {
		grid.appendChild(calDay(daysPrev - i, true, false));
	}
	for (let d = 1; d <= daysInMonth; d++) {
		const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
		grid.appendChild(calDay(d, false, isToday));
	}
	const total = lead + daysInMonth;
	for (let d = 1; d <= (7 - (total % 7)) % 7; d++) {
		grid.appendChild(calDay(d, true, false));
	}
	cal.classList.toggle("sd-cal-dark", settings.winTheme === "dark");
}

function calDay(day: number, other: boolean, today: boolean): HTMLButtonElement {
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
	if (managerWin) {
		const wasHidden = !managerWin.shown;
		if (showWin) managerWin.show();
		else managerWin.hide();
		// Rebuild frais à chaque ouverture (settings toujours à jour)
		if (showWin && wasHidden) builtSection = null;
	}
	if (!hasJobs && !forceOpen) {
		applyAccent();
		paintTaskbar();
		return;
	}

	applyTheme();
	paintTaskbar();
	navSync?.(section);
	// Libellés nav retraduits à chaque rendu (changement de langue instantané)
	managerWin?.el.querySelectorAll(".w10-navitem").forEach((el) => {
		const id = (el as HTMLElement).dataset.section as Section | undefined;
		const span = el.querySelector("span:last-child");
		if (id && span) span.textContent = navLabel(id);
	});
	if (builtSection !== section) {
		buildBody();
		builtSection = section;
	}
	if (section === "downloads") renderList();
	else if (section === "history") renderHistory();
}

function shortFolder(folder: string): string {
	const parts = folder.split(/[/\\]/).filter(Boolean);
	return parts.length > 0 ? parts[parts.length - 1] : folder;
}

/** Clic droit sur un job : menu contextuel Win10 avec tracks en cours + actions (via le framework). */
function showJobMenu(job: QueueJob, x: number, y: number) {
	showWin10Menu({
		id: JOBMENU_ID,
		x,
		y,
		dark: settings.winTheme === "dark",
		accent: currentAccent(),
		build: (menu) => {
			menu.appendChild(w10MenuHeader(job.title, `${job.done}/${job.total} · ${statusLabel(job)}`));
			menu.appendChild(w10Separator());

			if (job.status === "active") {
				const now = [...job.current.values()];
				menu.appendChild(w10MenuHeader(t("jm.now", { n: now.length })));
				if (now.length === 0) {
					const none = document.createElement("div");
					none.className = "w10-menu-item w10-disabled";
					none.innerHTML = `<span class="w10-menu-sub">${t("trk.starting")}</span>`;
					menu.appendChild(none);
				}
				for (const track of now.slice(0, 5)) {
					const trackEl = document.createElement("div");
					trackEl.className = "w10-menu-item w10-disabled w10-menu-track";
					trackEl.title = track.label;
					trackEl.textContent = `♫ ${track.label}`;
					menu.appendChild(trackEl);
				}
				menu.appendChild(w10Separator());
			}

			const folderItem = document.createElement("div");
			folderItem.className = "w10-menu-item w10-disabled";
			folderItem.innerHTML = `<span class="w10-menu-sub">${t("jm.folder", { name: job.folderOverride ? shortFolder(job.folderOverride) : t("jm.folderDefault") })}</span>`;
			menu.appendChild(folderItem);

			if (job.status === "queued" || job.status === "active") {
				const folderBtn = w10MenuItem(t("jm.saveOther"));
				folderBtn.onclick = async (e) => {
					e.stopPropagation();
					document.getElementById(JOBMENU_ID)?.remove();
					const folder = await getDownloadFolder();
					if (folder === undefined) return;
					setJobFolder(job.id, folder);
				};
				menu.appendChild(folderBtn);
			}

			const actBtn = w10MenuItem(
				job.status === "active" ? t("jm.stop") : job.status === "queued" ? t("jm.remove") : t("jm.dismiss"),
			);
			actBtn.onclick = (e) => {
				e.stopPropagation();
				document.getElementById(JOBMENU_ID)?.remove();
				if (job.status === "done" || job.status === "stopped") removeJob(job.id);
				else cancelJob(job.id);
			};
			menu.appendChild(actBtn);
		},
	});
}

// #endregion

// #region Section Downloads
function renderList() {
	if (!managerWin) return;
	const list = managerWin.body.querySelector(".sd-island-list") as HTMLDivElement | null;
	if (!list) return;
	// Ne pas reconstruire pendant un drag & drop (casserait le geste)
	if (dragId !== null) return;
	const jobs = getJobs();
	list.innerHTML = "";
	if (jobs.length === 0) {
		const empty = document.createElement("div");
		empty.className = "sd-win-empty";
		empty.textContent = t("dl.empty");
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
		row.title = t("dl.expand");
		const isQueued = job.status === "queued";
		if (isQueued) {
			row.dataset.qindex = String(qindex++);
			row.draggable = true;
		}

		const handle = document.createElement("span");
		handle.className = "sd-island-handle";
		handle.textContent = isQueued ? "⋮⋮" : "";
		handle.title = isQueued ? t("dl.reorder") : "";
		row.appendChild(handle);

		const dot = document.createElement("span");
		dot.className = "sd-island-dot";
		row.appendChild(dot);

		const exp = document.createElement("span");
		exp.className = "sd-island-exp";
		exp.textContent = job.tracksOpen ? "▾" : "▸";
		exp.title = t("dl.tracks");
		row.appendChild(exp);

		const main = document.createElement("div");
		main.className = "sd-island-main";
		const title = document.createElement("div");
		title.className = "sd-island-title";
		title.textContent = job.title;
		title.title = job.title;
		const sub = document.createElement("div");
		sub.className = "sd-island-sub";
		const skippedTxt = job.skipped > 0 ? t("job.skipped", { n: job.skipped }) : "";
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
			action.title = t("jm.stop");
			action.onclick = (e) => {
				e.stopPropagation();
				cancelJob(job.id);
			};
		} else {
			action.textContent = "✕";
			action.title = job.status === "queued" ? t("jm.remove") : t("jm.dismiss");
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
				wait.textContent = job.status === "active" ? t("trk.waiting") : t("trk.none");
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

function setTrackProgress(el: Element, entry: ActiveTrack) {
	const pct = entry.total ? ((entry.downloaded ?? 0) / entry.total) * 100 : 0;
	const fill = el.querySelector(".sd-island-trackfill") as HTMLDivElement | null;
	const sub = el.querySelector(".sd-island-trackpct") as HTMLSpanElement | null;
	if (fill) fill.style.width = `${pct}%`;
	if (sub) sub.textContent = entry.total ? `${formatMB(entry.downloaded)}/${formatMB(entry.total)} · ${pct.toFixed(0)}%` : t("trk.starting");
}

function buildTrackEl(entry: ActiveTrack): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "sd-island-track";
	el.dataset.trackKey = entry.key;
	if (entry.cover) {
		const img = document.createElement("img");
		img.className = "sd-island-thumb";
		img.src = entry.cover;
		img.alt = "";
		img.draggable = false;
		img.onerror = () => img.remove();
		el.appendChild(img);
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
	el.appendChild(main);
	setTrackProgress(el, entry);
	return el;
}
// #endregion

// #region Section History
function renderHistory() {
	if (!managerWin) return;
	const count = managerWin.body.querySelector(".sd-win-hist-count") as HTMLElement | null;
	if (count) count.textContent = String(countDownloaded());
}
// #endregion

// #region Pages (contrôles du mini-framework Win10)
function buildSettingsPage(body: HTMLDivElement) {
	body.innerHTML = "";

	const searchRow = document.createElement("div");
	searchRow.className = "sd-win-searchrow";
	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.className = "w10-textbox sd-win-search";
	searchInput.placeholder = t("se.search");
	searchInput.value = search;
	searchInput.oninput = () => {
		search = searchInput.value.toLowerCase();
		body.querySelectorAll(".w10-setting").forEach((el) => {
			const hay = (el as HTMLElement).dataset.search ?? "";
			(el as HTMLElement).style.display = hay.includes(search) ? "" : "none";
		});
	};
	searchRow.appendChild(searchInput);
	body.appendChild(searchRow);
	body.appendChild(w10GroupTitle(t("se.appearance")));

	body.appendChild(
		w10Toggle(t("se.dark"), t("se.darkD"), () => settings.winTheme === "dark", (v) => {
			settings.winTheme = v ? "dark" : "light";
			applyTheme();
		}),
	);

	body.appendChild(w10GroupTitle(t("se.quality")));
	const qualities: { value: string; label: string }[] = [];
	for (const quality of Object.values(Quality.lookups.audioQuality)) {
		if (typeof quality === "string" || quality.audioQuality === Quality.MQA.audioQuality) continue;
		qualities.push({ value: quality.audioQuality, label: quality.name });
	}
	body.appendChild(
		w10ComboRow(t("se.dlQuality"), "", qualities, () => settings.downloadQuality, (v) => {
			const q = v as redux.AudioQuality;
			if (Quality.fromAudioQuality(q) !== undefined) settings.downloadQuality = q;
		}),
	);

	const folderRow = document.createElement("div");
	folderRow.className = "w10-setting";
	folderRow.dataset.search = `${t("se.defFolder")} folder path directory`.toLowerCase();
	const folderTexts = document.createElement("div");
	folderTexts.className = "w10-setting-texts";
	const folderTitle = document.createElement("div");
	folderTitle.className = "w10-setting-title";
	folderTitle.textContent = t("se.defFolder");
	const folderSub = document.createElement("div");
	folderSub.className = "w10-desc";
	folderSub.textContent = settings.defaultPath ?? t("se.noFolder");
	folderTexts.appendChild(folderTitle);
	folderTexts.appendChild(folderSub);
	const folderBtn = w10Button(settings.defaultPath ? t("se.clear") : t("se.browse"), async () => {
		if (settings.defaultPath !== undefined) {
			settings.defaultPath = undefined;
		} else {
			settings.defaultPath = await getDownloadFolder();
		}
		folderSub.textContent = settings.defaultPath ?? t("se.noFolder");
		folderBtn.textContent = settings.defaultPath ? t("se.clear") : t("se.browse");
	});
	folderRow.appendChild(folderTexts);
	folderRow.appendChild(folderBtn);
	body.appendChild(folderRow);

	body.appendChild(
		w10TextRow(t("se.pathFmt"), t("se.pathFmtD"), () => settings.pathFormat, (v) => (settings.pathFormat = v)),
	);

	body.appendChild(w10GroupTitle(t("se.content")));
	body.appendChild(
		w10Toggle(t("se.realmax"), t("se.realmaxD"), () => settings.useRealMAX, (v) => (settings.useRealMAX = v)),
	);
	body.appendChild(
		w10Toggle(t("se.lyrics"), t("se.lyricsD"), () => settings.downloadLyrics, (v) => (settings.downloadLyrics = v)),
	);
	body.appendChild(w10TextRow(t("se.lyricsSfx"), t("se.sfxD"), () => settings.lyricsSuffix, (v) => (settings.lyricsSuffix = v)));
	body.appendChild(
		w10Toggle(t("se.meta"), t("se.metaD"), () => settings.downloadMeta, (v) => (settings.downloadMeta = v)),
	);
	body.appendChild(w10TextRow(t("se.metaSfx"), t("se.sfxD"), () => settings.metaSuffix, (v) => (settings.metaSuffix = v)));
	body.appendChild(
		w10TextareaRow(
			t("se.metaTpl"),
			t("se.metaTplD"),
			() => settings.metaTemplate,
			(v) => (settings.metaTemplate = v),
		),
	);
	body.appendChild(
		w10Toggle(
			t("se.auto"),
			t("se.autoD"),
			() => settings.autoDownloadPlayed,
			(v) => (settings.autoDownloadPlayed = v),
		),
	);

	body.appendChild(w10GroupTitle(t("se.tags")));
	const tagsRow = document.createElement("div");
	tagsRow.className = "w10-setting w10-setting-col";
	tagsRow.dataset.search = `${t("se.availTags")} tags filename`.toLowerCase();
	const tagsTitle = document.createElement("div");
	tagsTitle.className = "w10-setting-title";
	tagsTitle.textContent = t("se.availTags");
	const tagsList = document.createElement("div");
	tagsList.className = "w10-desc";
	tagsList.textContent = MediaItem.availableTags.map((t) => `{${t}}`).join(" ");
	tagsRow.appendChild(tagsTitle);
	tagsRow.appendChild(tagsList);
	body.appendChild(tagsRow);
}

// #region Section Theme (mode + couleur d'accent façon Win10)
function buildThemePage(body: HTMLDivElement) {
	body.innerHTML = "";
	const accent = currentAccent();

	body.appendChild(w10GroupTitle(t("th.mode")));
	const modes = document.createElement("div");
	modes.className = "sd-win-modes";
	const lightBtn = document.createElement("button");
	lightBtn.type = "button";
	lightBtn.className = "sd-win-modebtn" + (settings.winTheme === "light" ? " sd-win-modebtn-active" : "");
	lightBtn.innerHTML = `<span class="sd-win-modeswatch sd-win-modeswatch-light"></span><span>${t("th.light")}</span>`;
	lightBtn.onclick = () => {
		settings.winTheme = "light";
		applyTheme();
		buildThemePage(body);
	};
	const darkBtn = document.createElement("button");
	darkBtn.type = "button";
	darkBtn.className = "sd-win-modebtn" + (settings.winTheme === "dark" ? " sd-win-modebtn-active" : "");
	darkBtn.innerHTML = `<span class="sd-win-modeswatch sd-win-modeswatch-dark"></span><span>${t("th.dark")}</span>`;
	darkBtn.onclick = () => {
		settings.winTheme = "dark";
		applyTheme();
		buildThemePage(body);
	};
	modes.appendChild(lightBtn);
	modes.appendChild(darkBtn);
	body.appendChild(modes);

	body.appendChild(w10GroupTitle(t("th.accent")));
	body.appendChild(w10Desc(t("th.accentD")));

	const grid = document.createElement("div");
	grid.className = "sd-win-swatches";
	const paintSwatches = () => {
		grid.querySelectorAll(".sd-win-swatch").forEach((el) => {
			el.classList.toggle("sd-win-swatch-active", (el as HTMLElement).dataset.color === currentAccent().toLowerCase());
		});
	};
	for (const color of THEME_ACCENTS) {
		const sw = document.createElement("button");
		sw.type = "button";
		sw.className = "sd-win-swatch";
		sw.dataset.color = color;
		sw.style.background = color;
		sw.title = color;
		sw.setAttribute("aria-label", `Accent ${color}`);
		sw.onclick = () => {
			settings.accent = color;
			applyAccent();
			paintSwatches();
			customColor.value = color;
			hexInput.value = color;
		};
		grid.appendChild(sw);
	}
	body.appendChild(grid);
	paintSwatches();

	const customRow = document.createElement("div");
	customRow.className = "w10-setting";
	const customTexts = document.createElement("div");
	customTexts.className = "w10-setting-texts";
	const customTitle = document.createElement("div");
	customTitle.className = "w10-setting-title";
	customTitle.textContent = t("th.custom");
	const customColor = document.createElement("input");
	customColor.type = "color";
	customColor.className = "w10-color";
	customColor.value = accent;
	customColor.title = t("th.pick");
	customColor.oninput = () => {
		settings.accent = customColor.value;
		applyAccent();
		hexInput.value = customColor.value;
		paintSwatches();
	};
	customTexts.appendChild(customTitle);
	customTexts.appendChild(customColor);
	customRow.appendChild(customTexts);
	body.appendChild(customRow);

	const hexRow = document.createElement("div");
	hexRow.className = "w10-setting w10-setting-col";
	const hexTitle = document.createElement("div");
	hexTitle.className = "w10-setting-title";
	hexTitle.textContent = t("th.hex");
	const hexInput = document.createElement("input");
	hexInput.type = "text";
	hexInput.className = "w10-textbox w10-hex";
	hexInput.value = accent;
	hexInput.spellcheck = false;
	hexInput.placeholder = "#0078d7";
	hexInput.onchange = () => {
		const v = hexInput.value.trim().toLowerCase();
		if (isValidAccent(v)) {
			settings.accent = v;
			applyAccent();
			customColor.value = v;
		} else {
			hexInput.value = currentAccent();
		}
		paintSwatches();
	};
	hexRow.appendChild(hexTitle);
	hexRow.appendChild(hexInput);
	body.appendChild(hexRow);

	body.appendChild(
		w10Button(t("th.reset"), () => {
			settings.accent = DEFAULT_ACCENT;
			applyAccent();
			buildThemePage(body);
		}),
	);
}
// #endregion

function buildHistoryPage(body: HTMLDivElement) {
	body.innerHTML = "";
	body.appendChild(w10Hero(String(countDownloaded()), t("hi.tracks"), "sd-win-hist-count"));
	body.appendChild(w10Desc(t("hi.desc")));
	body.appendChild(
		w10Button(t("hi.forget"), () => {
			clearDownloaded();
			renderHistory();
		}),
	);
}

function buildDownloadsPage(body: HTMLDivElement) {
	body.innerHTML = "";
	const toolbar = document.createElement("div");
	toolbar.className = "w10-toolbar";
	toolbar.appendChild(w10Button(t("dl.stopAll"), () => cancelAll()));
	toolbar.appendChild(w10Button(t("dl.clearFinished"), () => clearFinished()));
	body.appendChild(toolbar);

	// Dossier de sortie + path picker (appliqué aux nouveaux downloads)
	const folderRow = document.createElement("div");
	folderRow.className = "sd-win-outrow";
	const folderVal = document.createElement("span");
	folderVal.className = "sd-win-folderval";
	const folderBtn = w10Button("", async () => {
		const folder = await getDownloadFolder();
		if (folder === undefined) return;
		settings.defaultPath = folder;
		paintFolder();
	}, true);
	const paintFolder = () => {
		const full = settings.defaultPath;
		folderVal.textContent = full ? t("dl.output", { name: shortFolder(full) }) : t("dl.outputNone");
		folderVal.title = full ?? t("dl.noFolder");
		folderBtn.textContent = full ? t("dl.change") : t("dl.choose");
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
const NAV: { id: Section; glyph: string }[] = [
	{ id: "downloads", glyph: "⬇" },
	{ id: "history", glyph: "✓" },
	{ id: "settings", glyph: "⚙" },
	{ id: "theme", glyph: "◐" },
	{ id: "languages", glyph: GLOBE_ICON },
];

function navLabel(id: Section): string {
	return t(`nav.${id}`);
}

export function mountIsland() {
	if (document.getElementById(TASKBAR_ID)) return;

	// Taskbar Win10 : [Démarrer] [Downloader Manager] ……… status horloge
	taskbar = new Win10Taskbar(TASKBAR_ID);
	taskbar.addStartButton({
		iconHTML: WIN10_LOGO,
		title: "About — SongDownloaderV2",
		onClick: () => toggleAbout(),
	});
	taskbar.addApp({
		id: APP_ID,
		iconHTML: DOWNLOAD_ICON,
		label: "Downloader Manager",
		title: "Downloader Manager",
		onClick: () => toggleManager(),
	});
	// About épinglé aussi dans la taskbar (icône info officielle)
	taskbar.addApp({
		id: ABOUT_ID,
		iconHTML: INFO_ICON,
		label: "About",
		title: "About — SongDownloaderV2",
		onClick: () => toggleAbout(),
	});
	taskbar.onClockClick(() => {
		if (document.getElementById(CAL_ID)) closeCalendar();
		else openCalendar();
	});
	taskbar.mount();
	taskbar.startClock();
	taskbar.setAccent(currentAccent());

	// Fenêtre manager via le mini-framework (même DA qu'avant)
	managerWin = new Win10Window({
		id: WIN_ID,
		titleHTML: `Downloader Manager <span class="w10-credit">by Kisakay</span>`,
		avatarUrl: "https://github.com/Kisakay.png",
		width: 520,
		height: 560,
		chrome: {
			minimize: t("cap.min"),
			maximize: t("cap.max"),
			restore: t("cap.restore"),
			close: t("cap.close"),
			resize: t("cap.resize"),
		},
		onClose: () => {
			// Download en cours -> confirm façon VBS avant de fermer.
			// Oui = stoppe tout puis ferme, Non = ferme et laisse tourner en fond.
			const hasActive = getJobs().some((j) => j.status === "active");
			if (hasActive && !msgOpen) {
				msgOpen = true;
				void confirmWin10(t("mb.stopTitle"), t("mb.stopText"), { yes: t("mb.yes"), no: t("mb.no") }, msgTheme()).then((yes) => {
					msgOpen = false;
					if (yes) cancelAll();
					closeManager();
				});
				return;
			}
			closeManager();
		},
		onMinimize: () => {
			minimized = true;
			render();
		},
		onGeometry: (geom) => {
			settings.winPos = { x: geom.x, y: geom.y };
			settings.winSize = { w: Math.max(380, geom.w), h: Math.max(420, geom.h) };
		},
	});
	const pos = settings.winPos;
	const size = settings.winSize;
	managerWin.applyGeometry(pos?.x ?? null, pos?.y ?? null, size?.w ?? 520, size?.h ?? 560);
	const nav = managerWin.addNav(
		NAV.map((n) => ({ ...n, label: navLabel(n.id) })),
		section,
		(id) => {
			section = id;
			render();
		},
	);
	navSync = nav.sync;
	document.body.appendChild(managerWin.el);

	// Mini-fenêtre About (logo Windows), même DA via le framework
	mountAboutWindow();

	unloads.add(() => {
		taskbar?.destroy();
		managerWin?.destroy();
		closeCalendar();
		taskbar = managerWin = null;
		navSync = null;
	});

	onQueueChange(render);
	onAboutChange(() => paintTaskbar());
	setQueueProgressPainter(paintJob);
	// Changement de langue : rebuild complet (pages + nav + taskbar)
	unloads.add(
		onLanguageChange(() => {
			builtSection = null;
			render();
		}),
	);
	render();
}

/** Section custom "Languages" : centrum de sélection de la langue d'interface. */
function buildLanguagesPage(body: HTMLDivElement) {
	body.innerHTML = "";
	body.appendChild(w10GroupTitle(t("lg.group")));
	body.appendChild(w10Desc(t("lg.desc")));

	const list = document.createElement("div");
	list.style.display = "flex";
	list.style.flexDirection = "column";
	list.style.gap = "8px";
	list.style.marginTop = "12px";

	const options: { value: LangSetting; label: string }[] = [
		{ value: "auto", label: `${t("lg.auto")}` },
		...LOCALES.map((l) => ({ value: l as LangSetting, label: LOCALE_NAMES[l] })),
	];
	for (const opt of options) {
		const active = settings.language === opt.value;
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "sd-win-modebtn" + (active ? " sd-win-modebtn-active" : "");
		btn.style.flexDirection = "row";
		btn.style.justifyContent = "flex-start";
		btn.style.padding = "10px 12px";
		const mark = document.createElement("span");
		mark.textContent = active ? "●" : "○";
		mark.style.color = "var(--w10-accent, #0078d7)";
		mark.style.width = "18px";
		const label = document.createElement("span");
		label.textContent = opt.label;
		btn.appendChild(mark);
		btn.appendChild(label);
		btn.onclick = () => {
			settings.language = opt.value;
			setLocaleOverride(opt.value);
			// notifyLanguageChanged() repeint tout (dont cette page) via l'abonnement
		};
		list.appendChild(btn);
	}
	body.appendChild(list);
}

function buildBody() {
	if (!managerWin) return;
	if (section === "downloads") buildDownloadsPage(managerWin.body);
	else if (section === "history") buildHistoryPage(managerWin.body);
	else if (section === "theme") buildThemePage(managerWin.body);
	else if (section === "languages") buildLanguagesPage(managerWin.body);
	else buildSettingsPage(managerWin.body);
}
// #endregion
