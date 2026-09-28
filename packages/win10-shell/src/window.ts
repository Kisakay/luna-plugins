// Windows 10 style window: draggable / resizable / min-max-close.
// Pure DOM, zero dependencies. Styled by win10-shell.css (`w10-*` classes).

import { GLYPH_CLOSE, GLYPH_MAX, GLYPH_MIN, GLYPH_RESTORE } from "./icons.js";

export type Win10Theme = "light" | "dark";

export interface Win10Geometry {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Win10WindowOptions {
	id: string;
	/** Title HTML (e.g. `Downloader <span class="w10-credit">by me</span>`). */
	titleHTML: string;
	/** Avatar URL shown left of the title (optional). */
	avatarUrl?: string;
	avatarFallback?: () => void;
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	resizable?: boolean;
	/** Initial position (otherwise centered). */
	x?: number | null;
	y?: number | null;
	onClose?: () => void;
	onMinimize?: () => void;
	onGeometry?: (geom: Win10Geometry) => void;
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
		win.className = "w10-win";
		win.style.display = "none";
		win.style.width = `${opts.width ?? 520}px`;
		win.style.height = `${opts.height ?? 560}px`;

		const titlebar = document.createElement("div");
		titlebar.className = "w10-titlebar";
		const left = document.createElement("div");
		left.className = "w10-title-left";
		if (opts.avatarUrl) {
			const avatar = document.createElement("img");
			avatar.className = "w10-avatar";
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
		titleWrap.className = "w10-title-text";
		titleWrap.innerHTML = opts.titleHTML;
		left.appendChild(titleWrap);

		const capBtns = document.createElement("div");
		capBtns.className = "w10-caption";
		const minBtn = document.createElement("button");
		minBtn.type = "button";
		minBtn.className = "w10-capbtn";
		minBtn.innerHTML = GLYPH_MIN;
		minBtn.title = "Minimize";
		minBtn.setAttribute("aria-label", "Minimize");
		minBtn.onclick = () => opts.onMinimize?.();
		const maxBtn = document.createElement("button");
		maxBtn.type = "button";
		maxBtn.className = "w10-capbtn";
		maxBtn.innerHTML = GLYPH_MAX;
		maxBtn.title = "Maximize";
		maxBtn.setAttribute("aria-label", "Maximize");
		maxBtn.onclick = () => this.toggleMaximize();
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className = "w10-capbtn w10-capbtn-close";
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
		content.className = "w10-content w10-content-single";
		const body = document.createElement("div");
		body.className = "w10-body";
		content.appendChild(body);

		win.appendChild(titlebar);
		win.appendChild(content);

		if (opts.resizable ?? true) {
			const grip = document.createElement("div");
			grip.className = "w10-resize";
			grip.title = "Resize";
			win.appendChild(grip);
			this.makeResizable(win, grip);
		}

		this.el = win;
		this.body = body;
		this.titlebar = titlebar;
		this.maxBtn = maxBtn;
		this.makeDraggable(win, titlebar);
	}

	get isMaximized(): boolean {
		return this.maximized;
	}

	setTitleHTML(html: string): void {
		const t = this.el.querySelector(".w10-title-text");
		if (t) t.innerHTML = html;
	}

	setTheme(theme: Win10Theme): void {
		this.el.classList.toggle("w10-dark", theme === "dark");
	}

	setAccent(accent: string): void {
		this.el.style.setProperty("--w10-accent", accent);
	}

	setZIndex(z: number): void {
		this.el.style.zIndex = String(z);
	}

	show(): void {
		this.el.style.display = "";
		if (!this.maximized) this.clamp();
	}

	hide(): void {
		this.el.style.display = "none";
	}

	get shown(): boolean {
		return this.el.style.display !== "none";
	}

	toggleMaximize(): void {
		this.maximized = !this.maximized;
		this.el.classList.toggle("w10-win-max", this.maximized);
		this.maxBtn.innerHTML = this.maximized ? GLYPH_RESTORE : GLYPH_MAX;
		this.maxBtn.title = this.maximized ? "Restore" : "Maximize";
		this.maxBtn.setAttribute("aria-label", this.maximized ? "Restore" : "Maximize");
		if (!this.maximized) this.clamp();
	}

	/** Add a vertical Win10 nav left of the body, returns nav container + sync. */
	addNav<T extends string>(
		items: { id: T; label: string; glyph: string }[],
		active: T,
		onSelect: (id: T) => void,
	): { nav: HTMLDivElement; sync: (id: T) => void } {
		const content = this.el.querySelector(".w10-content") as HTMLDivElement;
		content.classList.remove("w10-content-single");
		let nav = content.querySelector(".w10-nav") as HTMLDivElement | null;
		if (!nav) {
			nav = document.createElement("div");
			nav.className = "w10-nav";
			content.prepend(nav);
		}
		nav.innerHTML = "";
		for (const item of items) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "w10-navitem" + (item.id === active ? " w10-navitem-active" : "");
			btn.dataset.section = item.id;
			const glyph = document.createElement("span");
			glyph.className = "w10-navglyph";
			glyph.textContent = item.glyph;
			const label = document.createElement("span");
			label.textContent = item.label;
			btn.appendChild(glyph);
			btn.appendChild(label);
			btn.onclick = () => onSelect(item.id);
			nav.appendChild(btn);
		}
		return {
			nav,
			sync: (id: T) => {
				nav!.querySelectorAll(".w10-navitem").forEach((el) => {
					el.classList.toggle("w10-navitem-active", (el as HTMLElement).dataset.section === id);
				});
			},
		};
	}

	applyGeometry(x: number | null | undefined, y: number | null | undefined, w?: number | null, h?: number | null): void {
		if (x !== null && x !== undefined && y !== null && y !== undefined) {
			this.el.style.left = `${x}px`;
			this.el.style.top = `${y}px`;
			this.el.style.transform = "none";
		}
		if (w) this.el.style.width = `${w}px`;
		if (h) this.el.style.height = `${h}px`;
	}

	clamp(): void {
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

	destroy(): void {
		this.el.remove();
	}

	private emitGeometry(): void {
		const r = this.el.getBoundingClientRect();
		this.opts.onGeometry?.({
			x: Math.round(r.left),
			y: Math.round(r.top),
			w: Math.round(r.width),
			h: Math.round(r.height),
		});
	}

	private makeDraggable(win: HTMLDivElement, titlebar: HTMLDivElement): void {
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

	private makeResizable(win: HTMLDivElement, grip: HTMLDivElement): void {
		const minW = this.opts.minWidth ?? 380;
		const minH = this.opts.minHeight ?? 420;
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
			const w = Math.max(minW, Math.min(window.innerWidth - 16, resize.startW + e.clientX - resize.startX));
			const h = Math.max(minH, Math.min(window.innerHeight - 16, resize.startH + e.clientY - resize.startY));
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
