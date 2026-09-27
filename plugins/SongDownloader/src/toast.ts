import { unloads } from "./index.safe";
import { settings } from "./Settings";

const TOAST_ID = "luna-songdownloader-toast";

let el: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let unloadRegistered = false;

/** Petit toast façon notification Win10, en bas à droite. Remplace l'ancienne bannière. */
export function showToast(text: string, ms = 4000) {
	if (!el || !document.body.contains(el)) {
		el = document.createElement("div");
		el.id = TOAST_ID;
		el.className = "sd-toast";
		el.onclick = () => hideToast();
		document.body.appendChild(el);
		if (!unloadRegistered) {
			unloadRegistered = true;
			unloads.add(() => {
				el?.remove();
				el = null;
			});
		}
	}
	el.classList.toggle("sd-toast-dark", settings.winTheme === "dark");
	el.textContent = text;
	el.classList.remove("sd-toast-hidden");
	// Relance l'animation + le timer
	el.classList.remove("sd-toast-in");
	void el.offsetWidth;
	el.classList.add("sd-toast-in");
	if (timer !== undefined) clearTimeout(timer);
	timer = setTimeout(hideToast, ms);
}

export function hideToast() {
	if (timer !== undefined) {
		clearTimeout(timer);
		timer = undefined;
	}
	el?.classList.add("sd-toast-hidden");
}
