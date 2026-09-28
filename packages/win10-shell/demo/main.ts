// Demo app: proves winml runs anywhere with zero dependencies.
// No Tidal, no framework — plain DOM + the published ESM bundle.
import {
	ICON_CALENDAR,
	ICON_CHECK,
	ICON_CLOCK,
	ICON_EDIT,
	ICON_FILE,
	ICON_FOLDER,
	ICON_HEART,
	ICON_HOME,
	ICON_MAIL,
	ICON_MUSIC,
	ICON_PAUSE,
	ICON_PLAY,
	ICON_REFRESH,
	ICON_SAVE,
	ICON_SEARCH,
	ICON_SETTINGS,
	ICON_SHIELD,
	ICON_STAR,
	ICON_TRASH,
	ICON_USER,
	ICON_VOLUME,
	ICON_WIFI,
	WIN10_LOGO,
	DOWNLOAD_ICON,
	INFO_ICON,
	MSGBOX_ERROR,
	MSGBOX_INFO,
	MSGBOX_QUESTION,
	MSGBOX_WARNING,
	confirmWin10,
	createDesktop,
	renderMarkdown,
	showWin10Menu,
	showWin10MsgBox,
	w10Button,
	w10Calendar,
	w10ComboRow,
	w10Desc,
	w10Divider,
	w10GroupTitle,
	w10Hero,
	w10ListItem,
	w10MenuHeader,
	w10MenuItem,
	w10Progress,
	w10RadioGroup,
	w10Separator,
	w10Slider,
	w10Switch,
	w10TextareaRow,
	w10Toggle,
	type DesktopApp,
} from "../src/index.js";

const desktop = createDesktop({
	start: {
		iconHTML: WIN10_LOGO,
		title: "About this demo",
		onClick: () => about.focus(),
	},
	clock: {
		onClick: () => calendarApp.focus(),
	},
	accent: "#0078d7",
});

// ---- App 1 : About (markdown + links) ----
const about = desktop.createApp({
	id: "about",
	label: "About",
	appTitle: "About this demo",
	appIconHTML: WIN10_LOGO,
	titleHTML: `About <span class="w10-credit">winml demo</span>`,
	width: 420,
	height: 480,
});
about.body.appendChild(
	renderMarkdown(
		"# winml demo\n\nA full **Windows 10 HUD** running on a blank page — no Tidal, no React, no dependency.\n\n- Drag windows by their titlebar, double-click to maximize\n- Apps live in the taskbar with an **accent underline** while running\n- Right-click anywhere for a Win10 context menu\n\n---\nBuilt with `createDesktop()` from `winml`.",
	),
);
about.body.appendChild(w10GroupTitle("Links"));
const links = document.createElement("div");
links.className = "w10-toolbar";
links.appendChild(w10Button("npm package", () => window.open("https://www.npmjs.com/package/winml", "_blank")));
links.appendChild(w10Button("Context menu", (e) => openDemoMenu(e.clientX, e.clientY)));
about.body.appendChild(links);
about.setRunning(true);
about.show();

// ---- App 2 : Settings (every control of the framework) ----
let dark = false;
let quality = "max";
let notes = "Hello\nfrom winml";
const settingsApp: DesktopApp = desktop.createApp({
	id: "settings",
	label: "Settings demo",
	appTitle: "Settings demo",
	appIconHTML: DOWNLOAD_ICON,
	titleHTML: `Settings demo <span class="w10-credit">controls</span>`,
	width: 460,
	height: 560,
});
settingsApp.body.appendChild(w10Hero("2", "demo apps running"));
settingsApp.body.appendChild(w10GroupTitle("Appearance"));
settingsApp.body.appendChild(
	w10Toggle("Dark theme", "Dark mode for every window at once", () => dark, (v) => {
		dark = v;
		desktop.setTheme(v ? "dark" : "light");
	}),
);
settingsApp.body.appendChild(w10GroupTitle("Content"));
settingsApp.body.appendChild(
	w10ComboRow(
		"Quality",
		"Picked value is logged to the console.",
		[
			{ value: "max", label: "MAX" },
			{ value: "high", label: "High" },
			{ value: "low", label: "Low" },
		],
		() => quality,
		(v) => {
			quality = v;
			console.log("[demo] quality =", v);
			desktop.setStatus(`<span>Quality: ${v}</span>`);
		},
	),
);
settingsApp.body.appendChild(
	w10TextareaRow("Notes", "A Win10 textarea.", () => notes, (v) => (notes = v)),
);
settingsApp.body.appendChild(w10Desc("Close this window: the taskbar underline stays while running."));
const row = document.createElement("div");
row.className = "w10-toolbar";
row.appendChild(
	w10Button("Stop running", () => {
		settingsApp.setRunning(false);
		desktop.setStatus(null);
	}),
);
settingsApp.body.appendChild(row);
settingsApp.setRunning(true);

// ---- App 3 : Components gallery (switch, radios, slider, progress, lists, icons, msgbox) ----
let notify = true;
let plan: string = "pro";
let volume = 65;
const gallery = desktop.createApp({
	id: "components",
	label: "Components",
	appTitle: "Win10 components gallery",
	appIconHTML: ICON_SETTINGS,
	titleHTML: `Components <span class="w10-credit">gallery</span>`,
	width: 480,
	height: 600,
});
gallery.body.appendChild(w10GroupTitle("Toggle switch"));
gallery.body.appendChild(w10Switch("Notifications", "The official Win10 Settings switch.", () => notify, (v) => (notify = v)));
gallery.body.appendChild(w10GroupTitle("Radio buttons"));
gallery.body.appendChild(
	w10RadioGroup(
		[
			{ value: "free", label: "Free", desc: "No account needed." },
			{ value: "pro", label: "Pro", desc: "Accent color everywhere." },
			{ value: "team", label: "Team", desc: "Shared HUD for everyone." },
		],
		() => plan,
		(v) => (plan = v),
	),
);
gallery.body.appendChild(w10GroupTitle("Slider + progress"));
gallery.body.appendChild(
	w10Slider("Volume", 0, 100, 1, () => volume, (v) => {
		volume = v;
		bar.set(v);
	}),
);
const bar = w10Progress(65);
gallery.body.appendChild(bar.el);
const ind = w10Progress(null);
const indLabel = w10Desc("Indeterminate marquee below:");
gallery.body.appendChild(indLabel);
gallery.body.appendChild(ind.el);
gallery.body.appendChild(w10GroupTitle("ListView rows"));
for (const [icon, title, sub] of [
	[ICON_MUSIC, "Now playing", "FLAC · 44.1 kHz"],
	[ICON_FOLDER, "Downloads", "12 files"],
	[ICON_SETTINGS, "Settings", undefined],
] as [string, string, string | undefined][]) {
	gallery.body.appendChild(w10ListItem({ iconHTML: icon, title, sub }));
}
gallery.body.appendChild(w10Divider());
gallery.body.appendChild(w10GroupTitle("MessageBox (official icons)"));
const msgRow = document.createElement("div");
msgRow.className = "w10-toolbar";
msgRow.style.flexWrap = "wrap";
for (const [label, icon] of [
	["Info", "info"],
	["Warning", "warning"],
	["Error", "error"],
	["Question", "question"],
] as [string, "info" | "warning" | "error" | "question"][]) {
	msgRow.appendChild(
		w10Button(label, () =>
			showWin10MsgBox({
				title: `${label} dialog`,
				text: `This is the official ${label.toLowerCase()} dialog.\nBuilt with showWin10MsgBox().`,
				icon,
				buttons: [{ id: "ok", label: "OK", isDefault: true }],
				theme: dark ? "dark" : "light",
			}),
		),
	);
}
msgRow.appendChild(
	w10Button("Confirm…", () =>
		confirmWin10("Delete files?", "Would you want to delete 3 files?", { yes: "Yes", no: "No" }, { theme: dark ? "dark" : "light" }).then((yes) =>
			console.log("[demo] confirm =", yes),
		),
	),
);
gallery.body.appendChild(msgRow);
gallery.body.appendChild(w10GroupTitle("Official MDL2 icon pack"));
const wall = document.createElement("div");
wall.style.display = "flex";
wall.style.flexWrap = "wrap";
wall.style.gap = "6px";
for (const [icon, name] of [
	[ICON_SEARCH, "Search"],
	[ICON_REFRESH, "Refresh"],
	[ICON_SAVE, "Save"],
	[ICON_TRASH, "Trash"],
	[ICON_EDIT, "Edit"],
	[ICON_FILE, "File"],
	[ICON_HOME, "Home"],
	[ICON_STAR, "Star"],
	[ICON_HEART, "Heart"],
	[ICON_USER, "User"],
	[ICON_CALENDAR, "Calendar"],
	[ICON_CLOCK, "Clock"],
	[ICON_MAIL, "Mail"],
	[ICON_SHIELD, "Shield"],
	[ICON_WIFI, "WiFi"],
	[ICON_PLAY, "Play"],
	[ICON_PAUSE, "Pause"],
	[ICON_VOLUME, "Volume"],
	[ICON_CHECK, "Check"],
] as [string, string][]) {
	const cell = document.createElement("span");
	cell.title = name;
	cell.style.cssText = "display:inline-flex;padding:6px;border:1px solid #e1e1e1;color:var(--w10-accent,#0078d7)";
	cell.innerHTML = icon;
	wall.appendChild(cell);
}
gallery.body.appendChild(wall);
gallery.body.appendChild(w10GroupTitle("System icons (32px)"));
const sysRow = document.createElement("div");
sysRow.style.cssText = "display:flex;gap:10px;align-items:center";
for (const [svg, name] of [
	[MSGBOX_INFO, "Info"],
	[MSGBOX_WARNING, "Warning"],
	[MSGBOX_ERROR, "Error"],
	[MSGBOX_QUESTION, "Question"],
	[INFO_ICON, "Info 16"],
] as [string, string][]) {
	const cell = document.createElement("span");
	cell.title = name;
	cell.style.lineHeight = "0";
	cell.innerHTML = svg;
	sysRow.appendChild(cell);
}
gallery.body.appendChild(sysRow);

// ---- App 4 : Calendar ----
const picked = w10Desc("No date picked yet.");
const calendarApp = desktop.createApp({
	id: "calendar",
	label: "Calendar",
	appTitle: "Win10 calendar component",
	appIconHTML: ICON_CALENDAR,
	titleHTML: `Calendar <span class="w10-credit">component</span>`,
	width: 360,
	height: 420,
});
const cal = w10Calendar({
	dark,
	onPick: (d) => {
		picked.textContent = `Picked: ${d.toLocaleDateString()}`;
	},
});
calendarApp.body.appendChild(cal.el);
calendarApp.body.appendChild(picked);

console.log("[demo] accent API: desktop.setAccent('#e81123'), desktop.setTheme('dark')");

// ---- Global right-click menu ----
function openDemoMenu(x: number, y: number): void {
	showWin10Menu({
		id: "demo-menu",
		x,
		y,
		dark,
		build: (menu) => {
			menu.appendChild(w10MenuHeader("Demo menu", "winml context menu"));
			menu.appendChild(w10Separator());
			const openAbout = w10MenuItem("Open About", "focus the About app");
			openAbout.onclick = () => about.focus();
			menu.appendChild(openAbout);
			const openGallery = w10MenuItem("Open Components", "the new gallery");
			openGallery.onclick = () => gallery.focus();
			menu.appendChild(openGallery);
			menu.appendChild(w10Separator());
			const red = w10MenuItem("Red accent", "broadcast to shell");
			red.onclick = () => desktop.setAccent("#e81123");
			menu.appendChild(red);
			const blue = w10MenuItem("Blue accent", "broadcast to shell");
			blue.onclick = () => desktop.setAccent("#0078d7");
			menu.appendChild(blue);
		},
	});
}

document.addEventListener("contextmenu", (e) => {
	e.preventDefault();
	openDemoMenu(e.clientX, e.clientY);
});
