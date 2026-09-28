/**
 * Compatibilité : même API que la première version (`mountAboutWindow`,
 * `toggleAboutWindow`, `hideAboutWindow`, `isAboutShown`,
 * `setAboutChangeListener`), mais déléguée à l'unique fenêtre About
 * (`src/aboutWindow.ts`) pour ne jamais dupliquer l'ID DOM ni le système.
 */
import {
	ABOUT_ID,
	closeAbout,
	getAboutWin,
	isAboutOpen,
	mountAboutWindow as mountReal,
	onAboutChange,
	toggleAbout,
} from "../aboutWindow";
import type { Win10Theme } from "./window";

export { ABOUT_ID };

/** Façade structurelle d'une fenêtre Win10 (sans dépendre d'un module externe). */
export interface AboutWin10Window {
	el: HTMLDivElement;
	body: HTMLDivElement;
	titlebar: HTMLDivElement;
	readonly maximized: boolean;
	readonly visible: boolean;
	show: () => void;
	hide: () => void;
	toggle: () => void;
	close: () => void;
	minimize: () => void;
	toggleMaximize: () => void;
	applyTheme: (theme: Win10Theme, accent: string) => void;
	destroy: () => void;
}

let changeListener: (() => void) | null = null;
let subscribed = false;

/** Appelé à chaque show/hide/close/minimize (ex: pour repeindre la taskbar). */
export function setAboutChangeListener(fn: (() => void) | null): void {
	changeListener = fn;
	if (!subscribed) {
		subscribed = true;
		onAboutChange(() => changeListener?.());
	}
}

export function mountAboutWindow(): AboutWin10Window {
	mountReal();
	const w = getAboutWin();
	if (!w) throw new Error("About window failed to mount");
	return {
		el: w.el,
		body: w.body,
		titlebar: w.titlebar,
		get maximized() {
			return w.isMaximized;
		},
		get visible() {
			return isAboutOpen();
		},
		show: () => {
			if (!isAboutOpen()) toggleAbout();
		},
		hide: () => closeAbout(),
		toggle: () => toggleAbout(),
		close: () => closeAbout(),
		minimize: () => {
			if (isAboutOpen()) toggleAbout();
		},
		toggleMaximize: () => w.toggleMaximize(),
		applyTheme: (theme: Win10Theme, accent: string) => {
			w.setTheme(theme);
			w.setAccent(accent);
		},
		destroy: () => w.destroy(),
	};
}

export function toggleAboutWindow(): void {
	toggleAbout();
}

export function hideAboutWindow(): void {
	closeAbout();
}

export function isAboutShown(): boolean {
	return isAboutOpen();
}
