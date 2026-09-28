// Demo app: proves @kisakay/win10-shell runs anywhere with zero dependencies.
// No Tidal, no framework — plain DOM + the published ESM bundle.
import {
	WIN10_LOGO,
	DOWNLOAD_ICON,
	createDesktop,
	renderMarkdown,
	showWin10Menu,
	w10Button,
	w10ComboRow,
	w10Desc,
	w10GroupTitle,
	w10Hero,
	w10MenuHeader,
	w10MenuItem,
	w10Separator,
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
		onClick: () => alert("Clock clicked — plug your own calendar here."),
	},
	accent: "#0078d7",
});

// ---- App 1 : About (markdown + links) ----
const about = desktop.createApp({
	id: "about",
	label: "About",
	appTitle: "About this demo",
	appIconHTML: WIN10_LOGO,
	titleHTML: `About <span class="w10-credit">win10-shell demo</span>`,
	width: 420,
	height: 480,
});
about.body.appendChild(
	renderMarkdown(
		"# win10-shell demo\n\nA full **Windows 10 HUD** running on a blank page — no Tidal, no React, no dependency.\n\n- Drag windows by their titlebar, double-click to maximize\n- Apps live in the taskbar with an **accent underline** while running\n- Right-click anywhere for a Win10 context menu\n\n---\nBuilt with `createDesktop()` from `@kisakay/win10-shell`.",
	),
);
about.body.appendChild(w10GroupTitle("Links"));
const links = document.createElement("div");
links.className = "w10-toolbar";
links.appendChild(w10Button("npm package", () => window.open("https://www.npmjs.com/package/@kisakay/win10-shell", "_blank")));
links.appendChild(w10Button("Context menu", (e) => openDemoMenu(e.clientX, e.clientY)));
about.body.appendChild(links);
about.setRunning(true);
about.show();

// ---- App 2 : Settings (every control of the framework) ----
let dark = false;
let quality = "max";
let nickname = "demo-user";
let notes = "Hello\nfrom win10-shell";
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
settingsApp.body.appendChild(w10Desc(`Signed in as ${nickname}. Close this window: the taskbar underline stays while running.`));
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

// Dark switch also available from the accent row in About? Keep it simple.
console.log("[demo] accent API: desktop.setAccent('#e81123'), desktop.setTheme('dark')");

// ---- Global right-click menu ----
function openDemoMenu(x: number, y: number): void {
	showWin10Menu({
		id: "demo-menu",
		x,
		y,
		dark,
		build: (menu) => {
			menu.appendChild(w10MenuHeader("Demo menu", "win10-shell context menu"));
			menu.appendChild(w10Separator());
			const openAbout = w10MenuItem("Open About", "focus the About app");
			openAbout.onclick = () => about.focus();
			menu.appendChild(openAbout);
			const openSettings = w10MenuItem("Open Settings demo", "focus the Settings app");
			openSettings.onclick = () => settingsApp.focus();
			menu.appendChild(openSettings);
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
