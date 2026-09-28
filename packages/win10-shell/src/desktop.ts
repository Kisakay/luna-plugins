// Full Windows 10 desktop environment: taskbar + window manager + theme.
// One call gives any web app the whole HUD:
//
//   const desktop = createDesktop({ start: { icon: WIN10_LOGO, onClick: ... } });
//   const app = desktop.createApp({ id: "main", label: "My app", title: "..." });
//   app.body.append(...);
//   app.show();
//
// Pure DOM, zero dependencies, framework-agnostic (React, Vue, vanilla...).

import { Win10Taskbar } from "./taskbar.js";
import { Win10Window, type Win10Geometry, type Win10Theme, type Win10WindowOptions } from "./window.js";

export const DEFAULT_ACCENT = "#0078d7";
const BASE_Z = 10000;

export interface DesktopStartOptions {
	iconHTML: string;
	title?: string;
	onClick: () => void;
}

export interface DesktopClockOptions {
	onClick?: () => void;
	intervalMs?: number;
}

export interface DesktopOptions {
	/** Where to mount taskbar + windows. Defaults to document.body. */
	mount?: HTMLElement;
	taskbarId?: string;
	theme?: Win10Theme;
	accent?: string;
	start?: DesktopStartOptions;
	/** Set to false to hide the clock. */
	clock?: DesktopClockOptions | false;
}

export interface DesktopAppOptions extends Omit<Win10WindowOptions, "onClose" | "onMinimize" | "id"> {
	id: string;
	/** Label shown in the taskbar app button. */
	label: string;
	/** Tooltip of the taskbar app button. Defaults to label. */
	appTitle?: string;
	/** Icon HTML for the taskbar app button. */
	appIconHTML?: string;
	/** "hide" keeps the window for re-show (default), "destroy" removes it. */
	closeMode?: "hide" | "destroy";
	/** Called when the app is destroyed (close in destroy mode / desktop.destroy). */
	onDestroy?: () => void;
}

export interface DesktopApp {
	readonly id: string;
	readonly window: Win10Window;
	readonly body: HTMLDivElement;
	readonly isOpen: boolean;
	readonly isRunning: boolean;
	show: () => void;
	hide: () => void;
	toggle: () => void;
	focus: () => void;
	minimize: () => void;
	close: () => void;
	setRunning: (running: boolean) => void;
	setAppTitle: (title: string) => void;
	destroy: () => void;
}

export interface Win10Desktop {
	readonly taskbar: Win10Taskbar;
	readonly theme: Win10Theme;
	readonly accent: string;
	createApp: (opts: DesktopAppOptions) => DesktopApp;
	getApp: (id: string) => DesktopApp | undefined;
	setTheme: (theme: Win10Theme) => void;
	setAccent: (accent: string) => void;
	setStatus: (html: string | null) => void;
	setStartOpen: (open: boolean) => void;
	destroy: () => void;
}

export function isValidAccent(v: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function createDesktop(opts: DesktopOptions = {}): Win10Desktop {
	const mount = opts.mount ?? document.body;
	let theme: Win10Theme = opts.theme ?? "light";
	let accent = opts.accent ?? DEFAULT_ACCENT;
	let zTop = BASE_Z;
	let destroyed = false;
	const apps = new Map<string, DesktopApp>();
	const focusCleanups = new Map<string, () => void>();

	const taskbar = new Win10Taskbar(opts.taskbarId ?? "w10-taskbar");
	if (opts.start) {
		taskbar.addStartButton({
			iconHTML: opts.start.iconHTML,
			title: opts.start.title ?? "Start",
			onClick: opts.start.onClick,
		});
	}
	if (opts.clock !== false) {
		if (opts.clock?.onClick) taskbar.onClockClick(opts.clock.onClick);
		taskbar.startClock(undefined, opts.clock?.intervalMs ?? 10000);
	}
	taskbar.mount(mount);
	taskbar.setAccent(accent);

	const syncApp = (id: string, app: DesktopApp) => {
		taskbar.setAppState(id, { running: app.isRunning, open: app.isOpen });
	};

	const focusApp = (id: string) => {
		const app = apps.get(id);
		if (!app || destroyed) return;
		app.window.setZIndex(++zTop);
		for (const [otherId, other] of apps) {
			if (otherId !== id) syncApp(otherId, other);
		}
		syncApp(id, app);
	};

	const desktop: Win10Desktop = {
		taskbar,
		get theme() {
			return theme;
		},
		get accent() {
			return accent;
		},

		createApp(appOpts: DesktopAppOptions): DesktopApp {
			if (destroyed) throw new Error("Desktop is destroyed");
			desktop.getApp(appOpts.id)?.destroy();

			const win = new Win10Window({
				...appOpts,
				titleHTML: appOpts.titleHTML,
				onClose: () => app.close(),
				onMinimize: () => app.minimize(),
			});
			win.setTheme(theme);
			win.setAccent(accent);
			mount.appendChild(win.el);

			taskbar.addApp({
				id: appOpts.id,
				iconHTML: appOpts.appIconHTML ?? "",
				label: appOpts.label,
				title: appOpts.appTitle ?? appOpts.label,
				onClick: () => app.toggle(),
			});

			let running = false;
			const onPointerDown = () => focusApp(appOpts.id);
			win.el.addEventListener("pointerdown", onPointerDown);
			focusCleanups.set(appOpts.id, () => win.el.removeEventListener("pointerdown", onPointerDown));

			const app: DesktopApp = {
				id: appOpts.id,
				window: win,
				body: win.body,
				get isOpen() {
					return win.shown;
				},
				get isRunning() {
					return running;
				},
				show: () => {
					win.show();
					focusApp(appOpts.id);
				},
				hide: () => {
					win.hide();
					syncApp(appOpts.id, app);
				},
				toggle: () => {
					if (win.shown) {
						win.hide();
						syncApp(appOpts.id, app);
					} else {
						win.show();
						focusApp(appOpts.id);
					}
				},
				focus: () => {
					if (!win.shown) win.show();
					focusApp(appOpts.id);
				},
				minimize: () => {
					win.hide();
					syncApp(appOpts.id, app);
				},
				close: () => {
					if (appOpts.closeMode === "destroy") app.destroy();
					else {
						win.hide();
						syncApp(appOpts.id, app);
					}
				},
				setRunning: (v: boolean) => {
					running = v;
					syncApp(appOpts.id, app);
				},
				setAppTitle: (title: string) => {
					taskbar.setAppTitle(appOpts.id, title);
				},
				destroy: () => {
					focusCleanups.get(appOpts.id)?.();
					focusCleanups.delete(appOpts.id);
					win.destroy();
					taskbar.removeApp(appOpts.id);
					apps.delete(appOpts.id);
					appOpts.onDestroy?.();
				},
			};
			apps.set(appOpts.id, app);
			syncApp(appOpts.id, app);
			return app;
		},

		getApp: (id: string) => apps.get(id),

		setTheme: (t: Win10Theme) => {
			theme = t;
			for (const app of apps.values()) app.window.setTheme(t);
		},

		setAccent: (a: string) => {
			if (!isValidAccent(a)) return;
			accent = a;
			taskbar.setAccent(a);
			for (const app of apps.values()) app.window.setAccent(a);
		},

		setStatus: (html: string | null) => {
			taskbar.setStatus(html);
		},

		setStartOpen: (open: boolean) => {
			taskbar.setStartOpen(open);
		},

		destroy: () => {
			if (destroyed) return;
			destroyed = true;
			for (const app of [...apps.values()]) app.destroy();
			taskbar.destroy();
		},
	};

	return desktop;
}

export type { Win10Geometry, Win10Theme };
