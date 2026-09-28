// Windows 10 style taskbar: Start button + wide pinned apps + status + clock.
// Pure DOM, zero dependencies.

export interface TaskbarAppState {
	/** The app is running -> accent underline visible. */
	running: boolean;
	/** The window is visible and not minimized -> highlighted background. */
	open: boolean;
}

export class Win10Taskbar {
	readonly el: HTMLDivElement;
	private apps = new Map<string, HTMLButtonElement>();
	private statusEl: HTMLSpanElement;
	private clockEl: HTMLDivElement;
	private timeEl: HTMLSpanElement;
	private dateEl: HTMLSpanElement;
	private tickId: ReturnType<typeof setInterval> | null = null;
	private accent = "#0078d7";

	constructor(id = "w10-taskbar") {
		const bar = document.createElement("div");
		bar.id = id;
		bar.className = "w10-taskbar";
		this.el = bar;

		const spacer = document.createElement("div");
		spacer.className = "w10-spacer";
		spacer.dataset.role = "spacer";
		bar.appendChild(spacer);

		this.statusEl = document.createElement("span");
		this.statusEl.className = "w10-status";
		this.statusEl.style.display = "none";
		bar.appendChild(this.statusEl);

		this.clockEl = document.createElement("div");
		this.clockEl.className = "w10-clock";
		this.clockEl.title = "Open calendar";
		this.clockEl.style.cursor = "pointer";
		this.timeEl = document.createElement("span");
		this.timeEl.className = "w10-time";
		this.dateEl = document.createElement("span");
		this.dateEl.className = "w10-date";
		this.clockEl.appendChild(this.timeEl);
		this.clockEl.appendChild(this.dateEl);
		bar.appendChild(this.clockEl);

		this.setAccent(this.accent);
	}

	/** Start button (Windows logo) at the far left. */
	addStartButton(opts: { iconHTML: string; title: string; onClick: () => void }): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "w10-app w10-start";
		btn.title = opts.title;
		btn.innerHTML = `<span class="w10-app-icon"></span>`;
		(btn.querySelector(".w10-app-icon") as HTMLSpanElement).innerHTML = opts.iconHTML;
		btn.onclick = opts.onClick;
		this.el.prepend(btn);
		this.apps.set("__start__", btn);
		return btn;
	}

	/** Real Win10 app: icon + label, wide, with accent bar while running. */
	addApp(opts: { id: string; iconHTML: string; label: string; title?: string; onClick: () => void }): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "w10-app w10-app-wide";
		btn.title = opts.title ?? opts.label;
		btn.innerHTML = `<span class="w10-app-icon"></span><span class="w10-app-label"></span>`;
		(btn.querySelector(".w10-app-icon") as HTMLSpanElement).innerHTML = opts.iconHTML;
		(btn.querySelector(".w10-app-label") as HTMLSpanElement).textContent = opts.label;
		btn.onclick = opts.onClick;
		// Insert right before the spacer (after existing apps).
		const spacer = this.el.querySelector('[data-role="spacer"]');
		this.el.insertBefore(btn, spacer);
		this.apps.set(opts.id, btn);
		return btn;
	}

	removeApp(id: string): void {
		this.apps.get(id)?.remove();
		this.apps.delete(id);
	}

	setStartOpen(open: boolean): void {
		this.apps.get("__start__")?.classList.toggle("w10-open", open);
	}

	setAppState(id: string, state: TaskbarAppState): void {
		const btn = this.apps.get(id);
		if (!btn) return;
		btn.classList.toggle("w10-running", state.running);
		btn.classList.toggle("w10-open", state.open);
	}

	setAppTitle(id: string, title: string): void {
		const btn = this.apps.get(id);
		if (btn) btn.title = title;
	}

	setStatus(html: string | null): void {
		if (html === null) {
			this.statusEl.style.display = "none";
			return;
		}
		this.statusEl.style.display = "";
		if (this.statusEl.dataset.html !== html) {
			this.statusEl.dataset.html = html;
			this.statusEl.innerHTML = html;
		}
	}

	onClockClick(fn: () => void): void {
		this.clockEl.onclick = fn;
	}

	startClock(tick?: () => void, intervalMs = 10000): void {
		this.stopClock();
		const paint = () => {
			const now = new Date();
			this.timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			this.dateEl.textContent = now.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
			tick?.();
		};
		paint();
		this.tickId = setInterval(paint, intervalMs);
	}

	stopClock(): void {
		if (this.tickId) clearInterval(this.tickId);
		this.tickId = null;
	}

	setAccent(accent: string): void {
		this.accent = accent;
		this.el.style.setProperty("--w10-accent", accent);
	}

	mount(target: HTMLElement = document.body): HTMLDivElement {
		target.appendChild(this.el);
		return this.el;
	}

	destroy(): void {
		this.stopClock();
		this.el.remove();
		this.apps.clear();
	}
}
