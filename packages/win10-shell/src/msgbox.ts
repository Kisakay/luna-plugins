// Win10 style MessageBox ("VBS" confirm dialog): official system icon +
// text + right-aligned buttons. Modal overlay, draggable, Enter/Escape.
// Pure DOM; button labels come from the caller (language-agnostic core).

import { MSGBOX_ERROR, MSGBOX_INFO, MSGBOX_QUESTION, MSGBOX_WARNING } from "./icons.js";
import { Win10Window, type Win10Theme } from "./window.js";

export type MsgBoxIcon = "none" | "info" | "warning" | "error" | "question";

const ICONS: Record<Exclude<MsgBoxIcon, "none">, string> = {
	info: MSGBOX_INFO,
	warning: MSGBOX_WARNING,
	error: MSGBOX_ERROR,
	question: MSGBOX_QUESTION,
};

export interface MsgBoxButton {
	id: string;
	label: string;
	/** Activated by Enter (initial focus). */
	isDefault?: boolean;
	/** Activated by Escape / X (else first non-default). */
	isCancel?: boolean;
}

export interface MsgBoxOptions {
	title: string;
	/** Message text (multi-line via \n). */
	text: string;
	icon?: MsgBoxIcon;
	buttons: MsgBoxButton[];
	theme?: Win10Theme;
	accent?: string;
	width?: number;
}

let msgSeq = 0;
let msgZ = 99997;

/** Show a modal dialog, resolve with the clicked button id. */
export function showWin10MsgBox(opts: MsgBoxOptions): Promise<string> {
	const icon = opts.icon ?? "none";
	const theme = opts.theme ?? "light";
	if (opts.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(opts.accent)) {
		return Promise.reject(new Error(`Invalid accent: ${opts.accent}`));
	}

	return new Promise((resolve) => {
		let settled = false;
		const finish = (id: string) => {
			if (settled) return;
			settled = true;
			document.removeEventListener("keydown", onKey, true);
			overlay.remove();
			win.destroy();
			resolve(id);
		};

		const overlay = document.createElement("div");
		overlay.className = "w10-msgbox-overlay";
		overlay.style.zIndex = String(msgZ);
		overlay.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		document.body.appendChild(overlay);

		const win = new Win10Window({
			id: `w10-msgbox-${++msgSeq}`,
			titleHTML: opts.title,
			width: opts.width ?? 420,
			height: 10,
			resizable: false,
			onClose: () => finish(cancelId()),
		});
		win.el.classList.add("w10-dialog");
		win.el.style.zIndex = String(msgZ + 1);
		msgZ += 2;
		win.setTheme(theme);
		if (opts.accent) win.setAccent(opts.accent);

		// Dialogs have no minimize/maximize/resize, just the X
		win.el.querySelectorAll(".w10-capbtn:not(.w10-capbtn-close)").forEach((b) => b.remove());
		win.el.querySelector(".w10-resize")?.remove();
		win.titlebar.ondblclick = null;

		const body = win.body;
		body.classList.add("w10-msgbox-body");

		const row = document.createElement("div");
		row.className = "w10-msgbox-row";
		if (icon !== "none") {
			const iconEl = document.createElement("div");
			iconEl.className = "w10-msgbox-icon";
			iconEl.innerHTML = ICONS[icon];
			row.appendChild(iconEl);
		}
		const textEl = document.createElement("div");
		textEl.className = "w10-msgbox-text";
		textEl.textContent = opts.text;
		row.appendChild(textEl);
		body.appendChild(row);

		const btnRow = document.createElement("div");
		btnRow.className = "w10-msgbox-btns";
		const byId = new Map<string, HTMLButtonElement>();
		for (const b of opts.buttons) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "w10-btn w10-msgbox-btn";
			btn.textContent = b.label;
			btn.onclick = () => finish(b.id);
			btnRow.appendChild(btn);
			byId.set(b.id, btn);
		}
		body.appendChild(btnRow);

		const cancelId = () => opts.buttons.find((b) => b.isCancel)?.id ?? opts.buttons.find((b) => !b.isDefault)?.id ?? "cancel";
		const defaultId = () => opts.buttons.find((b) => b.isDefault)?.id ?? opts.buttons[0]?.id ?? "ok";

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				finish(defaultId());
			} else if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				finish(cancelId());
			}
		};
		document.addEventListener("keydown", onKey, true);

		document.body.appendChild(win.el);
		win.show();
		win.el.style.height = "auto";
		win.el.style.maxHeight = "calc(100vh - 120px)";
		win.el.style.left = `${Math.max(8, (window.innerWidth - win.el.offsetWidth) / 2)}px`;
		win.el.style.top = `${Math.max(8, (window.innerHeight - win.el.offsetHeight) / 2 - 40)}px`;
		win.el.style.transform = "none";
		byId.get(defaultId())?.focus();
	});
}

/** Yes/No confirm with the official question icon (VBS style). */
export function confirmWin10(
	title: string,
	text: string,
	labels: { yes: string; no: string },
	extra?: Partial<MsgBoxOptions>,
): Promise<boolean> {
	return showWin10MsgBox({
		title,
		text,
		icon: "question",
		buttons: [
			{ id: "yes", label: labels.yes, isDefault: true },
			{ id: "no", label: labels.no, isCancel: true },
		],
		...extra,
	}).then((id) => id === "yes");
}
