// Mini-framework Win10 — MessageBox façon "VBS" (dialog modal Win32).
// Icône officielle + texte + boutons alignés à droite, comme les vrais
// dialogs Windows. Pur DOM, aucune dépendance (les libellés viennent de
// l'appelant pour rester agnostique de toute langue).

import { MSGBOX_ERROR, MSGBOX_INFO, MSGBOX_QUESTION, MSGBOX_WARNING } from "./icons";
import { Win10Window, type Win10Theme } from "./window";

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
	/** Bouton activé par Entrée (focus initial). */
	isDefault?: boolean;
	/** Bouton activé par Échap / croix (sinon le premier non-default). */
	isCancel?: boolean;
}

export interface MsgBoxOptions {
	/** Titre de la fenêtre de dialogue. */
	title: string;
	/** Texte du message (une ligne ou multi-lignes via \n). */
	text: string;
	icon?: MsgBoxIcon;
	buttons: MsgBoxButton[];
	theme?: Win10Theme;
	accent?: string;
	width?: number;
}

let msgSeq = 0;
let msgZ = 99997;

/**
 * Affiche un dialog modal et résout avec l'id du bouton cliqué.
 * (Échap / croix = bouton isCancel, sinon "cancel".)
 */
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

		// Overlay modal transparent : bloque les clics derrière (vrai modal)
		const overlay = document.createElement("div");
		overlay.className = "sd-msgbox-overlay";
		overlay.style.zIndex = String(msgZ);
		overlay.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		document.body.appendChild(overlay);

		const win = new Win10Window({
			id: `luna-songdownloader-msgbox-${++msgSeq}`,
			titleHTML: opts.title,
			width: opts.width ?? 420,
			height: 10, // auto-ajustée plus bas au contenu
			onClose: () => finish(cancelId()),
		});
		win.el.classList.add("sd-win-dialog");
		win.el.style.zIndex = String(msgZ + 1);
		msgZ += 2;
		win.setTheme(theme);
		if (opts.accent) win.setAccent(opts.accent);

		// Un dialog n'a ni minimize ni maximize ni resize (juste la croix)
		win.el.querySelectorAll(".sd-win-capbtn:not(.sd-win-close)").forEach((b) => b.remove());
		win.el.querySelector(".sd-win-resize")?.remove();
		win.titlebar.ondblclick = null;

		const body = win.body;
		body.classList.add("sd-msgbox-body");

		const row = document.createElement("div");
		row.className = "sd-msgbox-row";
		if (icon !== "none") {
			const iconEl = document.createElement("div");
			iconEl.className = "sd-msgbox-icon";
			iconEl.innerHTML = ICONS[icon];
			row.appendChild(iconEl);
		}
		const textEl = document.createElement("div");
		textEl.className = "sd-msgbox-text";
		textEl.textContent = opts.text;
		row.appendChild(textEl);
		body.appendChild(row);

		const btnRow = document.createElement("div");
		btnRow.className = "sd-msgbox-btns";
		const byId = new Map<string, HTMLButtonElement>();
		for (const b of opts.buttons) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "sd-win-btn sd-msgbox-btn";
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
		// Hauteur auto : le body dictait 10px, on laisse le contenu respirer,
		// puis on centre sur les vraies dimensions mesurées
		win.el.style.height = "auto";
		win.el.style.maxHeight = "calc(100vh - 120px)";
		win.el.style.left = `${Math.max(8, (window.innerWidth - win.el.offsetWidth) / 2)}px`;
		win.el.style.top = `${Math.max(8, (window.innerHeight - win.el.offsetHeight) / 2 - 40)}px`;
		win.el.style.transform = "none";
		byId.get(defaultId())?.focus();
	});
}

/** Raccourci confirm Oui/Non avec icône question (style VBS). */
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
