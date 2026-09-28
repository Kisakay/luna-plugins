// Mini-framework Win10 — fenêtre draggable / resizable / min-max-close.
// Pur DOM, indépendant de Tidal. Reprend exactement la DA sd-win existante.

import { GLYPH_CLOSE, GLYPH_MAX, GLYPH_MIN, GLYPH_RESTORE } from "./icons";

export type Win10Theme = "light" | "dark";

export interface Win10WindowOptions {
	id: string;
	/** HTML du titre (ex: `Downloader Manager <span class="sd-win-credit">…</span>`) */
	titleHTML: string;
	/** URL d'avatar affiché à gauche du titre (optionnel) */
	avatarUrl?: string;
	avatarFallback?: () => void;
	width?: number;
	height?: number;
	/** Position initiale (sinon centrée). */
	x?: number | null;
	y?: number | null;
	onClose?: () => void;
	onMinimize?: () => void;
	onGeometry?: (geom: { x: number; y: number; w: number; h: number }) => void;
}

export class Win10Window {
	readonly id: string;
	readonly el: HTMLDivElement;
	readonly body: HTMLDivElement;
	readonly titlebar: HTMLDivElement;
	private maxBtn: HTMLButtonElement;
	private maximized = false;
	private opts: Win10WindowOptions;

	constructor(opts: Win10WindowOptions) {
		this.opts = opts;
		this.id = opts.id;

		const win = document.createElement("div");
		win.id = opts.id;
		win.className = "sd-win";
		win.style.display = "none";
		if (opts.width) win.style.width = `${opts.width}px`;
		if (opts.height) win.style.height = `${opts.height}px`;

		const titlebar = document.createElement("div");
		titlebar.className = "sd-win-titlebar";
		const left = document.createElement("div");
		left.className = "sd-win-titleleft";
		if (opts.avatarUrl) {
			const avatar = document.createElement("img");
			avatar.className = "sd-win-avatar";
			avatar.src = opts.avatarUrl;
			avatar.alt = "";
			avatar.draggable = false;
			avatar.onerror = () => {
				avatar.remove();
				opts.avatarFallback?.();
			};
			left.appendChild(avatar);
		}
		const titleWrap = document.createElement("span");
		titleWrap.className = "sd-win-titletxt";
		titleWrap.innerHTML = opts.titleHTML;
		left.appendChild(titleWrap);

		const capBtns = document.createElement("div");
		capBtns.className = "sd-win-caption";
		const minBtn = document.createElement("button");
		minBtn.type = "button";
		minBtn.className = "sd-win-capbtn";
		minBtn.innerHTML = GLYPH_MIN;
		minBtn.title = "Minimize";
		minBtn.setAttribute("aria-label", "Minimize");
		minBtn.onclick = () => opts.onMinimize?.();
		const maxBtn = document.createElement("button");
		maxBtn.type = "button";
		maxBtn.className = "sd-win-capbtn sd-win-maxbtn";
		maxBtn.innerHTML = GLYPH_MAX;
		maxBtn.title = "Maximize";
		maxBtn.setAttribute("aria-label", "Maximize");
		maxBtn.onclick = () => this.toggleMaximize();
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className = "sd-win-capbtn sd-win-close";
		closeBtn.innerHTML = GLYPH_CLOSE;
		closeBtn.title = "Close";
		closeBtn.setAttribute("aria-label", "Close");
		closeBtn.onclick = () => opts.onClose?.();
		capBtns.appendChild(minBtn);
		capBtns.appendChild(maxBtn);
		capBtns.appendChild(closeBtn);
		titlebar.appendChild(left);
		titlebar.appendChild(capBtns);

		const content = document.createElement("div");
		content.className = "sd-win-content sd-win-content-nonav";
		const body = document.createElement("div");
		body.className = "sd-win-body";
		content.appendChild(body);

		const grip = document.createElement("div");
		grip.className = "sd-win-resize";
		grip.title = "Resize";

		win.appendChild(titlebar);
		win.appendChild(content);
		win.appendChild(grip);

		this.el = win;
		this.body = body;
		this.titlebar = titlebar;
		this.maxBtn = maxBtn;
		this.makeDraggable(win, titlebar);
		this.makeResizable(win, grip);
	}

	get isMaximized(): boolean {
		return this.maximized;
	}

	setTitleHTML(html: string) {
		const t = this.el.querySelector(".sd-win-titletxt");
		if (t) t.innerHTML = html;
	}

	setTheme(theme: Win10Theme) {
		this.el.classList.toggle("sd-win-dark", theme === "dark");
	}

	setAccent(accent: string) {
		this.el.style.setProperty("--sd-accent", accent);
	}

	show() {
		this.el.style.display = "";
		if (!this.maximized) this.clamp();
	}

	hide() {
		this.el.style.display = "none";
	}

	get shown(): boolean {
		return this.el.style.display !== "none";
	}

	toggleMaximize() {
		this.maximized = !this.maximized;
		this.el.classList.toggle("sd-win-max", this.maximized);
		this.maxBtn.innerHTML = this.maximized ? GLYPH_RESTORE : GLYPH_MAX;
		this.maxBtn.title = this.maximized ? "Restore" : "Maximize";
		this.maxBtn.setAttribute("aria-label", this.maximized ? "Restore" : "Maximize");
		if (!this.maximized) this.clamp();
	}

	/** Ajoute une nav verticale Win10 à gauche du body, retourne le conteneur nav. */
	addNav<T extends string>(
		items: { id: T; label: string; glyph: string }[],
		active: T,
		onSelect: (id: T) => void,
	): { nav: HTMLDivElement; sync: (id: T) => void } {
		const content = this.el.querySelector(".sd-win-content") as HTMLDivElement;
		content.classList.remove("sd-win-content-nonav");
		let nav = content.querySelector(".sd-win-nav") as HTMLDivElement | null;
		if (!nav) {
			nav = document.createElement("div");
			nav.className = "sd-win-nav";
			content.prepend(nav);
		}
		nav.innerHTML = "";
		for (const item of items) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "sd-win-navitem" + (item.id === active ? " sd-win-navitem-active" : "");
			btn.dataset.section = item.id;
			btn.innerHTML = `<span class="sd-win-navglyph">${item.glyph}</span><span>${item.label}</span>`;
			btn.onclick = () => onSelect(item.id);
			nav.appendChild(btn);
		}
		return {
			nav,
			sync: (id: T) => {
				nav!.querySelectorAll(".sd-win-navitem").forEach((el) => {
					el.classList.toggle("sd-win-navitem-active", (el as HTMLElement).dataset.section === id);
				});
			},
		};
	}

	applyGeometry(x: number | null | undefined, y: number | null | undefined, w?: number | null, h?: number | null) {
		if (x !== null && x !== undefined && y !== null && y !== undefined) {
			this.el.style.left = `${x}px`;
			this.el.style.top = `${y}px`;
			this.el.style.transform = "none";
		}
		if (w) this.el.style.width = `${w}px`;
		if (h) this.el.style.height = `${h}px`;
	}

	clamp() {
		const win = this.el;
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

	destroy() {
		this.el.remove();
	}

	private emitGeometry() {
		const r = this.el.getBoundingClientRect();
		this.opts.onGeometry?.({
			x: Math.round(r.left),
			y: Math.round(r.top),
			w: Math.round(r.width),
			h: Math.round(r.height),
		});
	}

	private makeDraggable(win: HTMLDivElement, titlebar: HTMLDivElement) {
		let drag: { dx: number; dy: number } | null = null;
		titlebar.onpointerdown = (e) => {
			if ((e.target as HTMLElement).closest("button") || this.maximized) return;
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
			this.emitGeometry();
		};
		titlebar.onpointerup = endDrag;
		titlebar.onpointercancel = endDrag;
		titlebar.ondblclick = (e) => {
			if ((e.target as HTMLElement).closest("button")) return;
			this.toggleMaximize();
		};
	}

	private makeResizable(win: HTMLDivElement, grip: HTMLDivElement) {
		let resize: { startW: number; startH: number; startX: number; startY: number } | null = null;
		grip.onpointerdown = (e) => {
			if (this.maximized) return;
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
			this.emitGeometry();
		};
		grip.onpointerup = endResize;
		grip.onpointercancel = endResize;
	}
}
