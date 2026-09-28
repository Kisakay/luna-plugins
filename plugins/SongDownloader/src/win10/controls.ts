// Mini-framework Win10 — contrôles (boutons, checkbox, champs, combos...).
// Pur DOM, indépendant de Tidal. Les classes émises sont celles de la DA
// existante (sd-win-*) pour garder exactement le même rendu.

export function w10GroupTitle(text: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "sd-win-grouptitle";
	el.textContent = text;
	return el;
}

export function w10Desc(text: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "sd-win-setting-desc";
	el.textContent = text;
	return el;
}

export function w10Button(label: string, onClick: (e: MouseEvent) => void, small = false): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "sd-win-btn" + (small ? " sd-win-btn-small" : "");
	btn.textContent = label;
	btn.onclick = onClick;
	return btn;
}

export function w10Toggle(
	label: string,
	desc: string,
	get: () => boolean,
	set: (v: boolean) => void,
): HTMLDivElement {
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
		if ((e.target as HTMLElement).closest("button")) return;
		set(!get());
		sync();
	};
	return row;
}

export function w10TextRow(
	label: string,
	desc: string,
	get: () => string,
	set: (v: string) => void,
): HTMLDivElement {
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

export function w10TextareaRow(
	label: string,
	desc: string,
	get: () => string,
	set: (v: string) => void,
	rows = 6,
): HTMLDivElement {
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
	input.rows = rows;
	input.spellcheck = false;
	input.value = get();
	input.onchange = () => set(input.value);
	row.appendChild(title);
	row.appendChild(sub);
	row.appendChild(input);
	return row;
}

export type W10ComboOption = { value: string; label: string };

export function w10ComboRow(
	label: string,
	desc: string,
	options: W10ComboOption[],
	get: () => string,
	set: (v: string) => void,
): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "sd-win-setting sd-win-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "sd-win-setting-title";
	title.textContent = label;
	if (desc) {
		const sub = document.createElement("div");
		sub.className = "sd-win-setting-desc";
		sub.textContent = desc;
		row.appendChild(title);
		row.appendChild(sub);
	} else {
		row.appendChild(title);
	}
	const select = document.createElement("select");
	select.className = "sd-win-combo";
	for (const opt of options) {
		const o = document.createElement("option");
		o.value = opt.value;
		o.textContent = opt.label;
		select.appendChild(o);
	}
	select.value = get();
	select.onchange = () => set(select.value);
	row.appendChild(select);
	return row;
}

// Aliases compatibles avec l'autre convention de nommage du framework (`win10*`).
// Même DA, même comportement — un seul système sous le capot.
export function win10Button(label: string, opts?: { onClick?: (e: MouseEvent) => void; small?: boolean }): HTMLButtonElement {
	return w10Button(label, (e) => opts?.onClick?.(e), opts?.small ?? false);
}

export function win10GroupTitle(text: string): HTMLDivElement {
	return w10GroupTitle(text);
}

export function w10Hero(num: string, label: string, numClass = ""): HTMLDivElement {
	const hero = document.createElement("div");
	hero.className = "sd-win-hero";
	hero.innerHTML = `<div class="sd-win-hero-num ${numClass}">${num}</div><div class="sd-win-hero-label">${label}</div>`;
	return hero;
}
