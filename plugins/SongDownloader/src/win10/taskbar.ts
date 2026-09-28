// Mini-framework Win10 — taskbar (bouton Démarrer + apps larges + horloge).
// Pur DOM, indépendant de Tidal. Reprend la DA sd-taskbar existante.

export interface TaskbarAppState {
	/** L'app tourne (jobs, fenêtre About ouverte...) -> barre accent visible. */
	running: boolean;
	/** La fenêtre est visible et non minimisée -> fond actif Win10. */
	open: boolean;
}

export class Win10Taskbar {
	readonly el: HTMLDivElement;
	private apps = new Map<string, HTMLButtonElement>();
	private statusEl: HTMLSpanElement;
	private clockEl: HTMLDivElement;
	private timeEl: HTMLSpanElement;
	private dateEl: HTMLSpanElement;
	private onTick: (() => void) | null = null;
	private tickId: ReturnType<typeof setInterval> | null = null;

	constructor(id: string) {
		const bar = document.createElement("div");
		bar.id = id;
		bar.className = "sd-taskbar";
		this.el = bar;

		const spacer = document.createElement("div");
		spacer.className = "sd-taskbar-spacer";
		spacer.dataset.role = "spacer";
		bar.appendChild(spacer);

		this.statusEl = document.createElement("span");
		this.statusEl.className = "sd-taskbar-status";
		this.statusEl.style.display = "none";
		bar.appendChild(this.statusEl);

		this.clockEl = document.createElement("div");
		this.clockEl.className = "sd-taskbar-clock";
		this.clockEl.title = "Open calendar";
		this.clockEl.style.cursor = "pointer";
		this.timeEl = document.createElement("span");
		this.timeEl.className = "sd-taskbar-time";
		this.dateEl = document.createElement("span");
		this.dateEl.className = "sd-taskbar-date";
		this.clockEl.appendChild(this.timeEl);
		this.clockEl.appendChild(this.dateEl);
		bar.appendChild(this.clockEl);
	}

	/** Bouton Démarrer (logo Windows) tout à gauche. */
	addStartButton(opts: { iconHTML: string; title: string; onClick: () => void }): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "sd-taskbar-app sd-taskbar-start";
		btn.title = opts.title;
		btn.innerHTML = `<span class="sd-taskbar-app-icon">${opts.iconHTML}</span>`;
		btn.onclick = opts.onClick;
		// Insère avant tout (le spacer est déjà là, on prepend avant lui les apps dans l'ordre)
		this.el.prepend(btn);
		this.apps.set("__start__", btn);
		return btn;
	}

	/** Vraie app Win10 : icône + titre, large, avec barre accent quand elle tourne. */
	addApp(opts: { id: string; iconHTML: string; label: string; title?: string; onClick: () => void }): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "sd-taskbar-app sd-taskbar-wide";
		btn.title = opts.title ?? opts.label;
		btn.innerHTML = `<span class="sd-taskbar-app-icon">${opts.iconHTML}</span><span class="sd-taskbar-app-label">${opts.label}</span>`;
		btn.onclick = opts.onClick;
		// Insère juste avant le spacer (après les apps existantes)
		const spacer = this.el.querySelector('[data-role="spacer"]');
		this.el.insertBefore(btn, spacer);
		this.apps.set(opts.id, btn);
		return btn;
	}

	setStartOpen(open: boolean) {
		this.apps.get("__start__")?.classList.toggle("sd-taskbar-open", open);
	}

	setAppState(id: string, state: TaskbarAppState) {
		const btn = this.apps.get(id);
		if (!btn) return;
		btn.classList.toggle("sd-taskbar-running", state.running);
		btn.classList.toggle("sd-taskbar-open", state.open);
	}

	setAppTitle(id: string, title: string) {
		const btn = this.apps.get(id);
		if (btn) btn.title = title;
	}

	setStatus(html: string | null) {
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

	onClockClick(fn: () => void) {
		this.clockEl.onclick = fn;
	}

	startClock(tick?: () => void) {
		const paint = () => {
			const now = new Date();
			this.timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			this.dateEl.textContent = now.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
			tick?.();
		};
		this.onTick = tick ?? null;
		paint();
		this.tickId = setInterval(paint, 10000);
	}

	setAccent(accent: string) {
		this.el.style.setProperty("--sd-accent", accent);
	}

	mount(): HTMLDivElement {
		document.body.appendChild(this.el);
		return this.el;
	}

	destroy() {
		if (this.tickId) clearInterval(this.tickId);
		this.el.remove();
		this.apps.clear();
	}
}
