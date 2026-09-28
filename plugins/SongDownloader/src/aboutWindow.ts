// Fenêtre "About" — ouverte par le logo Windows (bouton Démarrer).
// Construite uniquement avec le mini-framework Win10 (window + controls + markdown),
// donc exactement la même DA que le manager, sans dépendance Tidal.
import { unloads } from "./index.safe";
import { DEFAULT_ACCENT, isValidAccent, settings } from "./Settings";
import { Win10Window } from "./win10/window";
import { renderMarkdown } from "./win10/markdown";
import { w10Button, w10Desc, w10GroupTitle } from "./win10/controls";

export const ABOUT_ID = "luna-songdownloader-about";

const AUTHOR_NAME = "Kisakay";
const AUTHOR_URL = "https://github.com/Kisakay";
const AUTHOR_AVATAR = "https://github.com/Kisakay.png";
const REPO_URL = "https://github.com/Kisakay/luna-plugins";
const ISSUES_URL = "https://github.com/Kisakay/luna-plugins/issues";

const ABOUT_MD = `# SongDownloaderV2

**Download-only TidaLuna plugin** — save Tidal tracks, albums and playlists as **FLAC**, with lyrics and metadata files.

- ⬇ Manual queue, liked-Tracks queue and **auto-download** of played tracks
- ⚙ Quality picker (**RealMAX**), path templates with tags like \`{artist}/{album}/{title}\`
- 🪟 Native-feel **Windows 10** manager, theme + accent color, history & calendar

---
Built with the Win10 mini-framework in this codebase (windows, taskbar apps, buttons, toggles, text fields, menus, markdown) — no Tidal UI dependency.`;

let aboutWin: Win10Window | null = null;
let visible = false;
let minimized = false;
const listeners = new Set<() => void>();

function notify() {
	for (const cb of listeners) {
		try {
			cb();
		} catch {
			// ignore
		}
	}
}

/** Accès à la fenêtre sous-jacente (pour adaptateurs / tests). */
export function getAboutWin(): Win10Window | null {
	return aboutWin;
}

export function onAboutChange(cb: () => void): () => void {
	listeners.add(cb);
	unloads.add(() => listeners.delete(cb));
	return () => listeners.delete(cb);
}

/** La fenêtre About est-elle visible à l'écran ? */
export function isAboutOpen(): boolean {
	return visible && !minimized && aboutWin?.shown === true;
}

function currentAccent(): string {
	return isValidAccent(settings.accent) ? settings.accent : DEFAULT_ACCENT;
}

export function refreshAboutTheme() {
	if (!aboutWin) return;
	aboutWin.setTheme(settings.winTheme);
	aboutWin.setAccent(currentAccent());
}

function buildContent(win: Win10Window) {
	const body = win.body;
	body.innerHTML = "";

	// Hero : avatar + nom + version
	const hero = document.createElement("div");
	hero.className = "sd-about-hero";
	const avatar = document.createElement("img");
	avatar.className = "sd-about-avatar";
	avatar.src = AUTHOR_AVATAR;
	avatar.alt = AUTHOR_NAME;
	avatar.draggable = false;
	avatar.onerror = () => {
		avatar.style.display = "none";
	};
	const texts = document.createElement("div");
	const name = document.createElement("div");
	name.className = "sd-about-name";
	name.textContent = "SongDownloaderV2";
	const sub = document.createElement("div");
	sub.className = "sd-about-sub";
	sub.textContent = `by ${AUTHOR_NAME} · TidaLuna plugin`;
	texts.appendChild(name);
	texts.appendChild(sub);
	hero.appendChild(avatar);
	hero.appendChild(texts);
	body.appendChild(hero);

	const badges = document.createElement("div");
	badges.className = "sd-about-badges";
	for (const b of ["FLAC", "Lyrics + metadata", "Win10 UI"]) {
		const badge = document.createElement("span");
		badge.className = "sd-about-badge";
		badge.textContent = b;
		badges.appendChild(badge);
	}
	body.appendChild(badges);

	// Corps markdown
	body.appendChild(renderMarkdown(ABOUT_MD));

	// Liens : auteur / repo / issue
	body.appendChild(w10GroupTitle("Links"));
	const links = document.createElement("div");
	links.className = "sd-about-links";
	const open = (url: string) => () => window.open(url, "_blank", "noopener,noreferrer");
	links.appendChild(w10Button(`Author — ${AUTHOR_NAME}`, open(AUTHOR_URL)));
	links.appendChild(w10Button("GitHub repository", open(REPO_URL)));
	links.appendChild(w10Button("Report an issue", open(ISSUES_URL)));
	body.appendChild(links);

	const hint = w10Desc("Tip: the Downloader Manager app lives next to the Start button in the taskbar.");
	body.appendChild(hint);
}

/** Icône "Information" officielle façon Windows (cercle bleu + "i" blanc). */
const INFO_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="#0078D7"/><circle cx="8" cy="8" r="7" fill="none" stroke="#005A9E" stroke-width="1"/><rect x="7.1" y="7.2" width="1.8" height="5" fill="#fff"/><circle cx="8" cy="4.9" r="1.2" fill="#fff"/></svg>`;

export function mountAboutWindow() {
	if (aboutWin) return;
	const win = new Win10Window({
		id: ABOUT_ID,
		titleHTML: `About`,
		width: 440,
		height: 540,
		onClose: () => {
			visible = false;
			minimized = false;
			win.hide();
			notify();
		},
		onMinimize: () => {
			minimized = true;
			win.hide();
			notify();
		},
	});
	aboutWin = win;
	// Icône info bleue officielle à gauche du titre (vraie fenêtre Win10)
	const titleLeft = win.el.querySelector(".sd-win-titleleft");
	if (titleLeft) {
		const icon = document.createElement("span");
		icon.className = "sd-win-infoicon";
		icon.innerHTML = INFO_ICON;
		titleLeft.prepend(icon);
	}
	document.body.appendChild(win.el);
	buildContent(win);
	refreshAboutTheme();
	placeAboveStart(win);

	unloads.add(() => {
		win.destroy();
		aboutWin = null;
		visible = minimized = false;
	});
}

/** Positionne la mini-fenêtre au-dessus du bouton Démarrer (façon menu Start). */
function placeAboveStart(win: Win10Window) {
	const h = Number.parseFloat(win.el.style.height) || 540;
	win.applyGeometry(8, Math.max(8, window.innerHeight - h - 56));
}

export function openAbout() {
	mountAboutWindow();
	visible = true;
	minimized = false;
	if (aboutWin) {
		buildContent(aboutWin);
		refreshAboutTheme();
		if (aboutWin.el.style.left === "") placeAboveStart(aboutWin);
		aboutWin.show();
	}
	notify();
}

export function closeAbout() {
	visible = false;
	minimized = false;
	aboutWin?.hide();
	notify();
}

export function toggleAbout() {
	if (isAboutOpen()) {
		minimized = true;
		aboutWin?.hide();
	} else {
		openAbout();
		return;
	}
	notify();
}
