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
import { unloads } from "./index.safe";

const ISLAND_ID = "luna-songdownloader-island";

let root: HTMLDivElement | null = null;
let pillEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let listEl: HTMLDivElement | null = null;
let expanded = true;
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

function paintJob(job: QueueJob) {
	if (!root) return;
	const row = root.querySelector(`[data-job-id="${job.id}"]`);
	if (!row) return;
	const fill = row.querySelector(".sd-island-bar-fill") as HTMLDivElement | null;
	const count = row.querySelector(".sd-island-count") as HTMLSpanElement | null;
	if (fill) fill.style.width = job.total > 0 ? `${(job.done / job.total) * 100}%` : "0%";
	if (count) count.textContent = `${job.done}/${job.total}`;
	paintPill();
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

function render() {
	if (!root || !listEl || !panelEl || !pillEl) return;
	const jobs = getJobs();
	root.style.display = jobs.length === 0 ? "none" : "";
	panelEl.style.display = expanded ? "" : "none";
	pillEl.querySelector(".sd-island-chevron")!.textContent = expanded ? "▾" : "▸";
	paintPill();

	listEl.innerHTML = "";
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
		sub.innerHTML = `<span class="sd-island-count">${job.done}/${job.total}</span> · ${statusLabel(job)}`;
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

		// Drag & drop reorder (queued rows only)
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
				root?.querySelectorAll(".sd-island-dragover").forEach((el) => el.classList.remove("sd-island-dragover"));
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

		listEl.appendChild(row);
	}
}

export function mountIsland() {
	if (document.getElementById(ISLAND_ID)) return;

	root = document.createElement("div");
	root.id = ISLAND_ID;
	root.className = "sd-island";
	root.style.display = "none";

	pillEl = document.createElement("div");
	pillEl.className = "sd-island-pill";
	pillEl.innerHTML = `<span class="sd-island-pill-icon">⬇</span><span class="sd-island-pill-text"></span><span class="sd-island-chevron">▾</span><div class="sd-island-pill-bar"><div class="sd-island-pill-fill"></div></div>`;
	pillEl.onclick = () => {
		expanded = !expanded;
		render();
	};
	root.appendChild(pillEl);

	panelEl = document.createElement("div");
	panelEl.className = "sd-island-panel";

	const header = document.createElement("div");
	header.className = "sd-island-header";
	const title = document.createElement("span");
	title.className = "sd-island-panel-title";
	title.textContent = "Downloads";
	header.appendChild(title);

	const clearBtn = document.createElement("button");
	clearBtn.type = "button";
	clearBtn.className = "sd-island-btn";
	clearBtn.textContent = "Clear";
	clearBtn.title = "Dismiss finished downloads";
	clearBtn.onclick = () => clearFinished();
	header.appendChild(clearBtn);

	const stopAllBtn = document.createElement("button");
	stopAllBtn.type = "button";
	stopAllBtn.className = "sd-island-btn sd-island-danger";
	stopAllBtn.textContent = "Stop all";
	stopAllBtn.title = "Stop current and clear queue";
	stopAllBtn.onclick = () => cancelAll();
	header.appendChild(stopAllBtn);
	panelEl.appendChild(header);

	listEl = document.createElement("div");
	listEl.className = "sd-island-list";
	panelEl.appendChild(listEl);
	root.appendChild(panelEl);

	document.body.appendChild(root);
	unloads.add(() => {
		root?.remove();
		root = pillEl = panelEl = listEl = null;
	});

	onQueueChange(render);
	setQueueProgressPainter(paintJob);
	render();
}
