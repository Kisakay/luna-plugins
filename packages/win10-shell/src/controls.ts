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

/**
 * Official Win10 toggle switch (pill + knob). Unlike the square checkbox,
 * this is the switch used across Windows 10 Settings pages.
 */
export function w10Switch(label: string, desc: string, get: () => boolean, set: (v: boolean) => void): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "w10-setting";
	const sw = document.createElement("button");
	sw.type = "button";
	sw.className = "w10-switch";
	sw.setAttribute("role", "switch");
	const knob = document.createElement("span");
	knob.className = "w10-switch-knob";
	sw.appendChild(knob);
	const sync = () => {
		const on = get();
		sw.classList.toggle("w10-on", on);
		sw.setAttribute("aria-checked", String(on));
	};
	const flip = () => {
		set(!get());
		sync();
	};
	sw.onclick = flip;
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
	row.appendChild(sw);
	row.appendChild(texts);
	row.onclick = (e) => {
		if ((e.target as HTMLElement).closest("button")) return;
		flip();
	};
	return row;
}

/** Official Win10 radio buttons (vertical group, circle + dot). */
export function w10RadioGroup(
	options: { value: string; label: string; desc?: string }[],
	get: () => string,
	set: (v: string) => void,
): HTMLDivElement {
	const group = document.createElement("div");
	group.className = "w10-radios";
	group.setAttribute("role", "radiogroup");
	const sync = () => {
		group.querySelectorAll(".w10-radio").forEach((el) => {
			const on = (el as HTMLElement).dataset.value === get();
			el.classList.toggle("w10-on", on);
			el.setAttribute("aria-checked", String(on));
		});
	};
	for (const opt of options) {
		const row = document.createElement("button");
		row.type = "button";
		row.className = "w10-radio";
		row.dataset.value = opt.value;
		row.setAttribute("role", "radio");
		const dot = document.createElement("span");
		dot.className = "w10-radio-dot";
		const texts = document.createElement("span");
		texts.className = "w10-radio-texts";
		const label = document.createElement("span");
		label.className = "w10-setting-title";
		label.textContent = opt.label;
		texts.appendChild(label);
		if (opt.desc) {
			const sub = document.createElement("span");
			sub.className = "w10-desc";
			sub.textContent = opt.desc;
			texts.appendChild(sub);
		}
		row.appendChild(dot);
		row.appendChild(texts);
		row.onclick = () => {
			set(opt.value);
			sync();
		};
		group.appendChild(row);
	}
	sync();
	return group;
}

/** Official Win10 progress bar. `value` 0..100, or null for indeterminate marquee. */
export function w10Progress(value: number | null): { el: HTMLDivElement; set: (v: number | null) => void } {
	const bar = document.createElement("div");
	bar.className = "w10-progress";
	bar.setAttribute("role", "progressbar");
	const fill = document.createElement("div");
	fill.className = "w10-progress-fill";
	bar.appendChild(fill);
	const set = (v: number | null) => {
		if (v === null || v === undefined) {
			bar.classList.add("w10-indeterminate");
			fill.style.width = "";
			bar.removeAttribute("aria-valuenow");
		} else {
			const pct = Math.max(0, Math.min(100, v));
			bar.classList.remove("w10-indeterminate");
			fill.style.width = `${pct}%`;
			bar.setAttribute("aria-valuenow", String(Math.round(pct)));
		}
	};
	set(value);
	return { el: bar, set };
}

/** Official Win10 slider (square thumb, accent fill on hover/focus). */
export function w10Slider(
	label: string,
	min: number,
	max: number,
	step: number,
	get: () => number,
	set: (v: number) => void,
): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "w10-setting w10-setting-col";
	const head = document.createElement("div");
	head.className = "w10-slider-head";
	const title = document.createElement("div");
	title.className = "w10-setting-title";
	title.textContent = label;
	const val = document.createElement("div");
	val.className = "w10-slider-val";
	head.appendChild(title);
	head.appendChild(val);
	const input = document.createElement("input");
	input.type = "range";
	input.className = "w10-slider";
	input.min = String(min);
	input.max = String(max);
	input.step = String(step);
	const sync = () => {
		const v = Math.max(min, Math.min(max, get()));
		input.value = String(v);
		val.textContent = String(v);
		const pct = max === min ? 0 : ((v - min) / (max - min)) * 100;
		input.style.setProperty("--w10-fill", `${pct}%`);
	};
	input.oninput = () => {
		set(Number(input.value));
		sync();
	};
	sync();
	row.appendChild(head);
	row.appendChild(input);
	return row;
}

/** ListView row: optional icon + title + sub, full-width hover like Win10 lists. */
export function w10ListItem(opts: { iconHTML?: string; title: string; sub?: string; selected?: boolean; onClick?: (e: MouseEvent) => void }): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "w10-listitem" + (opts.selected ? " w10-selected" : "");
	if (opts.iconHTML) {
		const icon = document.createElement("span");
		icon.className = "w10-listitem-icon";
		icon.innerHTML = opts.iconHTML;
		btn.appendChild(icon);
	}
	const texts = document.createElement("span");
	texts.className = "w10-listitem-texts";
	const title = document.createElement("span");
	title.className = "w10-listitem-title";
	title.textContent = opts.title;
	texts.appendChild(title);
	if (opts.sub) {
		const sub = document.createElement("span");
		sub.className = "w10-desc";
		sub.textContent = opts.sub;
		texts.appendChild(sub);
	}
	btn.appendChild(texts);
	if (opts.onClick) btn.onclick = opts.onClick;
	return btn;
}

/** Thin horizontal divider. */
export function w10Divider(): HTMLDivElement {
	const d = document.createElement("div");
	d.className = "w10-divider";
	return d;
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
