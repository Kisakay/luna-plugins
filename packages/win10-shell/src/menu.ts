// Windows 10 style context menu (pure DOM).

export interface Win10MenuOptions {
	id: string;
	x: number;
	y: number;
	dark?: boolean;
	accent?: string;
	build: (menu: HTMLDivElement) => void;
}

const openMenus = new Map<string, () => void>();

export function closeWin10Menu(id: string): void {
	openMenus.get(id)?.();
}

export function closeAllWin10Menus(): void {
	for (const close of openMenus.values()) close();
}

export function w10Separator(): HTMLDivElement {
	const d = document.createElement("div");
	d.className = "w10-sep";
	return d;
}

export function w10MenuItem(label: string, sub?: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "w10-menu-item";
	if (sub) btn.innerHTML = `<span></span><span class="w10-menu-sub"></span>`;
	else btn.textContent = label;
	if (sub) {
		(btn.querySelector("span:first-child") as HTMLSpanElement).textContent = label;
		(btn.querySelector(".w10-menu-sub") as HTMLSpanElement).textContent = sub;
	}
	return btn;
}

export function w10MenuHeader(title: string, sub?: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "w10-menu-item w10-disabled";
	const main = document.createElement("span");
	main.textContent = title;
	el.appendChild(main);
	if (sub) {
		const s = document.createElement("span");
		s.className = "w10-menu-sub";
		s.textContent = sub;
		el.appendChild(s);
	}
	return el;
}

export function showWin10Menu(opts: Win10MenuOptions): HTMLDivElement {
	closeWin10Menu(opts.id);
	const menu = document.createElement("div");
	menu.id = opts.id;
	menu.className = "w10-menu";
	if (opts.dark) menu.classList.add("w10-dark");
	if (opts.accent) menu.style.setProperty("--w10-accent", opts.accent);

	opts.build(menu);
	(document.activeElement as HTMLElement | null)?.blur?.();
	document.body.appendChild(menu);

	// Position at cursor, clamped on screen.
	const w = menu.offsetWidth || 260;
	const h = menu.offsetHeight || 120;
	menu.style.left = `${Math.max(0, Math.min(window.innerWidth - w, opts.x))}px`;
	menu.style.top = `${Math.max(0, Math.min(window.innerHeight - h, opts.y))}px`;

	const cleanup = () => {
		menu.remove();
		openMenus.delete(opts.id);
		document.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("keydown", onKey);
	};
	const onPointerDown = (ev: PointerEvent) => {
		if (!menu.contains(ev.target as Node)) cleanup();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") cleanup();
	};
	document.addEventListener("pointerdown", onPointerDown);
	document.addEventListener("keydown", onKey);
	openMenus.set(opts.id, cleanup);
	return menu;
}
