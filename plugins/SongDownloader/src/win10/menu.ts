// Mini-framework Win10 — menu contextuel (style Win10, pur DOM).

export interface Win10MenuOptions {
	id: string;
	x: number;
	y: number;
	dark?: boolean;
	accent?: string;
	build: (menu: HTMLDivElement) => void;
}

const openMenus = new Map<string, () => void>();

export function closeWin10Menu(id: string) {
	openMenus.get(id)?.();
}

export function w10Separator(): HTMLDivElement {
	const d = document.createElement("div");
	d.className = "sd-qm-sep";
	return d;
}

export function w10MenuItem(label: string, sub?: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "sd-qm-item";
	if (sub) btn.innerHTML = `<span>${label}</span><span class="sd-qm-sub">${sub}</span>`;
	else btn.textContent = label;
	return btn;
}

export function w10MenuHeader(title: string, sub?: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "sd-qm-item sd-qm-disabled";
	el.innerHTML = sub ? `<span>${title}</span><span class="sd-qm-sub">${sub}</span>` : `<span>${title}</span>`;
	return el;
}

export function showWin10Menu(opts: Win10MenuOptions): HTMLDivElement {
	closeWin10Menu(opts.id);
	const menu = document.createElement("div");
	menu.id = opts.id;
	menu.className = "sd-quickmenu";
	if (opts.dark) menu.classList.add("sd-qm-dark");
	if (opts.accent) menu.style.setProperty("--sd-accent", opts.accent);

	opts.build(menu);
	document.body.appendChild(menu);

	// Position au curseur, clampée dans l'écran
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
