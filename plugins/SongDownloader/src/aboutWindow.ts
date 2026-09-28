// Fenêtre "About" — ouverte par le logo Windows (bouton Démarrer).
// Construite uniquement avec le mini-framework Win10 (window + controls + markdown),
// donc exactement la même DA que le manager, sans dépendance Tidal.
import { unloads } from "./index.safe";
import { DEFAULT_ACCENT, isValidAccent, settings } from "./Settings";
import { INFO_ICON, Win10Window, renderMarkdown, w10Button, w10Desc, w10GroupTitle } from "winml";
import { onLanguageChange, t } from "./i18n";

export const ABOUT_ID = "luna-songdownloader-about";

const AUTHOR_NAME = "Kisakay";
const AUTHOR_URL = "https://github.com/Kisakay";
const AUTHOR_AVATAR = "https://github.com/Kisakay.png";
const REPO_URL = "https://github.com/Kisakay/luna-plugins";
const ISSUES_URL = "https://github.com/Kisakay/luna-plugins/issues";

function aboutMarkdown(): string {
	return `# SongDownloaderV2

${t("ab.mdDesc")}

- ${t("ab.mdB1")}
- ${t("ab.mdB2")}
- ${t("ab.mdB3")}

---
${t("ab.mdFoot", { repo: REPO_URL, author: AUTHOR_URL })}`;
}

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
	for (const b of ["FLAC", t("ab.badges2"), "Win10 UI"]) {
		const badge = document.createElement("span");
		badge.className = "sd-about-badge";
		badge.textContent = b;
		badges.appendChild(badge);
	}
	body.appendChild(badges);

	// Corps markdown
	body.appendChild(renderMarkdown(aboutMarkdown()));

	// Liens : auteur / repo / issue
	body.appendChild(w10GroupTitle(t("ab.links")));
	const links = document.createElement("div");
	links.className = "sd-about-links";
	const open = (url: string) => () => window.open(url, "_blank", "noopener,noreferrer");
	links.appendChild(w10Button(`Author — ${AUTHOR_NAME}`, open(AUTHOR_URL)));
	links.appendChild(w10Button(t("ab.repoBtn"), open(REPO_URL)));
	links.appendChild(w10Button(t("ab.issueBtn"), open(ISSUES_URL)));
	body.appendChild(links);

	const hint = w10Desc(t("ab.tip"));
	body.appendChild(hint);
}

export function mountAboutWindow() {
	if (aboutWin) return;
	const win = new Win10Window({
		id: ABOUT_ID,
		titleHTML: `About`,
		width: 440,
		height: 540,
		chrome: {
			minimize: t("cap.min"),
			maximize: t("cap.max"),
			restore: t("cap.restore"),
			close: t("cap.close"),
			resize: t("cap.resize"),
		},
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
	const titleLeft = win.el.querySelector(".w10-title-left");
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
	unloads.add(onLanguageChange(() => buildContent(win)));
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
