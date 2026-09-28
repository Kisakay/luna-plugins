// Windows 10 style controls (buttons, checkbox, fields, combos...).
// Pure DOM. Every helper emits `w10-*` classes styled by win10-shell.css.

/** Settings-style section title ("Appearance", "Quality"...). */
export function w10GroupTitle(text: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "w10-grouptitle";
	el.textContent = text;
	return el;
}

export function w10Desc(text: string): HTMLDivElement {
	const el = document.createElement("div");
	el.className = "w10-desc";
	el.textContent = text;
	return el;
}

export function w10Button(label: string, onClick: (e: MouseEvent) => void, small = false): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "w10-btn" + (small ? " w10-btn-small" : "");
	btn.textContent = label;
	btn.onclick = onClick;
	return btn;
}

export function w10Toggle(label: string, desc: string, get: () => boolean, set: (v: boolean) => void): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "w10-setting";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const box = document.createElement("button");
	box.type = "button";
	box.className = "w10-checkbox";
	box.setAttribute("role", "checkbox");
	const sync = () => {
		const on = get();
		box.classList.toggle("w10-checked", on);
		box.setAttribute("aria-checked", String(on));
	};
	box.onclick = () => {
		set(!get());
		sync();
	};
	sync();
	const texts = document.createElement("div");
	texts.className = "w10-setting-texts";
	const title = document.createElement("div");
	title.className = "w10-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "w10-desc";
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
	row.className = "w10-setting w10-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "w10-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "w10-desc";
	sub.textContent = desc;
	const input = document.createElement("input");
	input.type = "text";
	input.className = "w10-textbox";
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
	row.className = "w10-setting w10-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "w10-setting-title";
	title.textContent = label;
	const sub = document.createElement("div");
	sub.className = "w10-desc";
	sub.textContent = desc;
	const input = document.createElement("textarea");
	input.className = "w10-textbox w10-textarea";
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
	row.className = "w10-setting w10-setting-col";
	row.dataset.search = `${label} ${desc}`.toLowerCase();
	const title = document.createElement("div");
	title.className = "w10-setting-title";
	title.textContent = label;
	row.appendChild(title);
	if (desc) {
		const sub = document.createElement("div");
		sub.className = "w10-desc";
		sub.textContent = desc;
		row.appendChild(sub);
	}
	const select = document.createElement("select");
	select.className = "w10-combo";
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

/** Big number + label hero block. */
export function w10Hero(num: string, label: string, numClass = ""): HTMLDivElement {
	const hero = document.createElement("div");
	hero.className = "w10-hero";
	const n = document.createElement("div");
	n.className = `w10-hero-num ${numClass}`.trim();
	n.textContent = num;
	const l = document.createElement("div");
	l.className = "w10-hero-label";
	l.textContent = label;
	hero.appendChild(n);
	hero.appendChild(l);
	return hero;
}
