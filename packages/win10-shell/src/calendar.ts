// Official Win10 style calendar flyout content: month grid + nav + today footer.
// Pure DOM. Used by taskbar clocks, date pickers, About pages...

export interface W10CalendarOptions {
	value?: Date;
	/** BCP47 tag for month/day names (default runtime locale). */
	locale?: string;
	/** Monday-first columns like Windows 10 default (default true). */
	mondayFirst?: boolean;
	dark?: boolean;
	accent?: string;
	onPick?: (date: Date) => void;
}

export interface W10Calendar {
	el: HTMLDivElement;
	setValue: (d: Date) => void;
	sync: () => void;
}

export function w10Calendar(opts: W10CalendarOptions = {}): W10Calendar {
	const locale = opts.locale;
	const mondayFirst = opts.mondayFirst ?? true;
	let year: number;
	let month: number;
	if (opts.value) {
		year = opts.value.getFullYear();
		month = opts.value.getMonth();
	} else {
		const now = new Date();
		year = now.getFullYear();
		month = now.getMonth();
	}
	let selected: Date | null = opts.value ? new Date(opts.value) : null;

	const cal = document.createElement("div");
	cal.className = "w10-cal" + (opts.dark ? " w10-dark" : "");
	if (opts.accent) cal.style.setProperty("--w10-accent", opts.accent);

	const head = document.createElement("div");
	head.className = "w10-cal-head";
	const title = document.createElement("span");
	title.className = "w10-cal-title";
	head.appendChild(title);
	const nav = document.createElement("div");
	nav.className = "w10-cal-nav";
	const prev = document.createElement("button");
	prev.type = "button";
	prev.className = "w10-cal-navbtn";
	prev.textContent = "‹";
	prev.title = "Previous month";
	prev.onclick = (e) => {
		e.stopPropagation();
		month--;
		if (month < 0) {
			month = 11;
			year--;
		}
		paint();
	};
	const next = document.createElement("button");
	next.type = "button";
	next.className = "w10-cal-navbtn";
	next.textContent = "›";
	next.title = "Next month";
	next.onclick = (e) => {
		e.stopPropagation();
		month++;
		if (month > 11) {
			month = 0;
			year++;
		}
		paint();
	};
	nav.appendChild(prev);
	nav.appendChild(next);
	head.appendChild(nav);
	cal.appendChild(head);

	const grid = document.createElement("div");
	grid.className = "w10-cal-grid";
	cal.appendChild(grid);

	const today = new Date();
	const foot = document.createElement("div");
	foot.className = "w10-cal-foot";
	foot.textContent = `Today: ${today.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" })}`;
	foot.style.cursor = "pointer";
	foot.onclick = () => {
		year = today.getFullYear();
		month = today.getMonth();
		paint();
	};
	cal.appendChild(foot);

	function dayCell(day: number, other: boolean, isToday: boolean, date: Date | null): HTMLButtonElement {
		const b = document.createElement("button");
		b.type = "button";
		b.className = "w10-cal-day";
		if (other) b.classList.add("w10-cal-other");
		if (isToday) b.classList.add("w10-cal-today");
		if (date && selected && date.getTime() === selected.getTime()) b.classList.add("w10-cal-selected");
		b.textContent = String(day);
		if (date) {
			b.onclick = (e) => {
				e.stopPropagation();
				selected = new Date(date);
				opts.onPick?.(new Date(date));
				paint();
			};
		}
		return b;
	}

	function paint(): void {
		title.textContent = new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
		grid.innerHTML = "";
		// Monday 2024-01-01 base keeps Monday-first alignment like Win10 default
		for (let i = 0; i < 7; i++) {
			const base = new Date(2024, 0, 1 + i + (mondayFirst ? 0 : 6));
			const dow = document.createElement("div");
			dow.className = "w10-cal-dow";
			dow.textContent = base.toLocaleDateString(locale, { weekday: "short" }).replace(".", "");
			grid.appendChild(dow);
		}
		const first = new Date(year, month, 1);
		const lead = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const daysPrev = new Date(year, month, 0).getDate();
		for (let i = lead - 1; i >= 0; i--) {
			grid.appendChild(dayCell(daysPrev - i, true, false, null));
		}
		for (let d = 1; d <= daysInMonth; d++) {
			const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
			grid.appendChild(dayCell(d, false, isToday, new Date(year, month, d)));
		}
		const total = lead + daysInMonth;
		for (let d = 1; d <= (7 - (total % 7)) % 7; d++) {
			grid.appendChild(dayCell(d, true, false, null));
		}
	}
	paint();

	return {
		el: cal,
		setValue: (d: Date) => {
			selected = new Date(d);
			year = d.getFullYear();
			month = d.getMonth();
			paint();
		},
		sync: paint,
	};
}
