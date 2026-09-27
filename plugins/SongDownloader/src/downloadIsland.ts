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
	setQueueProgressPainter,
	type QueueJob,
} from "./downloadQueue";
import { getDownloadFolder } from "./helpers";
import { unloads } from "./index.safe";
import { settings } from "./Settings";

const ISLAND_ID = "luna-songdownloader-island";
const WIN_ID = "luna-songdownloader-win";
const BUBBLE_ID = "luna-songdownloader-bubble";

type Section = "downloads" | "history" | "settings";

let pillRoot: HTMLDivElement | null = null;
let pillEl: HTMLDivElement | null = null;
let winEl: HTMLDivElement | null = null;
let winBody: HTMLDivElement | null = null;
let bubbleEl: HTMLDivElement | null = null;
let expanded = true;
let minimized = false;
let maximized = false;
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
	return done > 0 ? `${done} finished` : "";
}

// #region Fenêtre : position / drag / chrome
function clampWin(win: HTMLDivElement) {
	const w = win.offsetWidth || 480;
	const rect = win.getBoundingClientRect();
	let x = win.style.left === "" ? window.innerWidth / 2 - rect.width / 2 : rect.left;
	let y = win.style.top === "" ? 80 : rect.top;
	x = Math.max(-w + 120, Math.min(window.innerWidth - 120, x));
	y = Math.max(0, Math.min(window.innerHeight - 60, y));
	win.style.left = `${x}px`;
	win.style.top = `${y}px`;
	win.style.transform = "none";
}

function applySavedWinPos(win: HTMLDivElement) {
	const pos = settings.winPos;
	if (pos === null || pos === undefined) return;
	win.style.left = `${pos.x}px`;
	win.style.top = `${pos.y}px`;
	win.style.transform = "none";
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
		const w = win.offsetWidth || 480;
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

function toggleMaximize() {
	if (!winEl) return;
	maximized = !maximized;
	winEl.classList.toggle("sd-win-max", maximized);
	winEl.querySelector(".sd-win-capbtn.sd-win-maxbtn")!.textContent = maximized ? "❐" : "▢";
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
	}
	paintPill();
	paintBubble();
}

function paintPill() {
	if (!pillEl) return;
	const jobs = getJobs();
	const active = jobs.find((j) => j.status === "active");
	pillEl.querySelector(".sd-island-pill-text")!.textContent = summaryText();
	const fill = pillEl.querySelector(".sd-island-pill-fill") as HTMLDivElement | null;
	if (fill && active) fill.style.width = active.total > 0 ? `${(active.done / active.total) * 100}%` : "0%";
	if (fill && !active) fill.style.width = jobs.length > 0 ? "100%" : "0%";
}

function paintBubble() {
	if (!bubbleEl) return;
	const jobs = getJobs();
	const active = jobs.find((j) => j.status === "active");
	const queued = jobs.filter((j) => j.status === "queued").length;
	bubbleEl.querySelector(".sd-bubble-text")!.textContent = active
		? `${active.done}/${active.total}${queued > 0 ? ` · ${queued} queued` : ""}`
		: `${queued} queued`;
	const fill = bubbleEl.querySelector(".sd-bubble-fill") as HTMLDivElement | null;
	if (fill && active) fill.style.width = active.total > 0 ? `${(active.done / active.total) * 100}%` : "0%";
}

function render() {
	const jobs = getJobs();
	const hasJobs = jobs.length > 0;
	if (pillRoot) pillRoot.style.display = hasJobs ? "" : "none";
	if (winEl) {
		winEl.style.display = hasJobs && expanded && !minimized ? "" : "none";
		if (hasJobs && expanded && !minimized && !maximized) clampWin(winEl);
	}
	if (bubbleEl) bubbleEl.style.display = hasJobs && expanded && minimized ? "" : "none";
	if (!hasJobs) return;

	paintPill();
	paintBubble();
	if (pillEl) pillEl.querySelector(".sd-island-chevron")!.textContent = expanded && !minimized ? "▾" : "▸";
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
// #endregion

// #region Section Downloads
function renderList() {
	if (!winEl) return;
	const list = winEl.querySelector(".sd-island-list") as HTMLDivElement | null;
	if (!list) return;
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
		const row = document.createElement("div");
		row.className = `sd-island-row sd-island-${job.status}`;
		row.dataset.jobId = String(job.id);
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
			if (target) moveJob(dragId, Number(target.dataset.qindex));
			dragId = null;
		});

		list.appendChild(row);
	}
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
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "sd-win-toggle";
	btn.setAttribute("role", "switch");
	const sync = () => {
		const on = get();
		btn.classList.toggle("sd-win-toggle-on", on);
		btn.setAttribute("aria-checked", String(on));
	};
	btn.onclick = () => {
		set(!get());
		sync();
	};
	sync();
	row.appendChild(texts);
	row.appendChild(btn);
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
	if (document.getElementById(ISLAND_ID)) return;

	// Pilule (launcher)
	pillRoot = document.createElement("div");
	pillRoot.id = ISLAND_ID;
	pillRoot.className = "sd-island";
	pillRoot.style.display = "none";

	pillEl = document.createElement("div");
	pillEl.className = "sd-island-pill";
	pillEl.innerHTML = `<span class="sd-island-pill-icon">⬇</span><span class="sd-island-pill-text"></span><span class="sd-island-chevron">▾</span><div class="sd-island-pill-bar"><div class="sd-island-pill-fill"></div></div>`;
	pillEl.onclick = () => {
		expanded = true;
		minimized = false;
		render();
	};
	pillRoot.appendChild(pillEl);
	document.body.appendChild(pillRoot);

	// Fenêtre Win10
	winEl = document.createElement("div");
	winEl.id = WIN_ID;
	winEl.className = "sd-win";
	winEl.style.display = "none";

	const titlebar = document.createElement("div");
	titlebar.className = "sd-win-titlebar";
	const left = document.createElement("div");
	left.className = "sd-win-titleleft";
	left.innerHTML = `<span class="sd-win-icon">⬇</span><span class="sd-win-title">SongDownloaderV2</span>`;
	const capBtns = document.createElement("div");
	capBtns.className = "sd-win-caption";
	const minBtn = document.createElement("button");
	minBtn.type = "button";
	minBtn.className = "sd-win-capbtn";
	minBtn.textContent = "–";
	minBtn.title = "Minimize";
	minBtn.setAttribute("aria-label", "Minimize");
	minBtn.onclick = () => {
		minimized = true;
		render();
	};
	const maxBtn = document.createElement("button");
	maxBtn.type = "button";
	maxBtn.className = "sd-win-capbtn sd-win-maxbtn";
	maxBtn.textContent = "▢";
	maxBtn.title = "Maximize";
	maxBtn.setAttribute("aria-label", "Maximize");
	maxBtn.onclick = () => toggleMaximize();
	const closeBtn = document.createElement("button");
	closeBtn.type = "button";
	closeBtn.className = "sd-win-capbtn sd-win-close";
	closeBtn.textContent = "✕";
	closeBtn.title = "Close";
	closeBtn.setAttribute("aria-label", "Close");
	closeBtn.onclick = () => {
		expanded = false;
		minimized = false;
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
	document.body.appendChild(winEl);
	applySavedWinPos(winEl);

	// Bulle bas-gauche (restaure la fenêtre)
	bubbleEl = document.createElement("div");
	bubbleEl.id = BUBBLE_ID;
	bubbleEl.className = "sd-bubble";
	bubbleEl.style.display = "none";
	bubbleEl.title = "Restore downloads window";
	bubbleEl.innerHTML = `<span class="sd-bubble-icon">⬇</span><span class="sd-bubble-text"></span><div class="sd-bubble-bar"><div class="sd-bubble-fill"></div></div>`;
	bubbleEl.onclick = () => {
		minimized = false;
		render();
	};
	document.body.appendChild(bubbleEl);

	unloads.add(() => {
		pillRoot?.remove();
		winEl?.remove();
		bubbleEl?.remove();
		pillRoot = pillEl = winEl = winBody = bubbleEl = null;
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
