import { unloads } from "./index.safe";
import { settings } from "./Settings";

const TOAST_ID = "luna-songdownloader-toast";

let el: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let unloadRegistered = false;
// Pendant un bulk, les statuts de progression inondent : on les tait,
// seuls les événements importants (fin, erreurs, actions user) ressortent.
let quiet = false;

export function setToastQuiet(q: boolean) {
	quiet = q;
}

/** Toast normal : ignoré en mode silencieux (bulk en cours). */
export function showToast(text: string, ms = 4000) {
	if (quiet) return;
	paintToast(text, ms);
}

/** Toast forcé : affiché même en mode silencieux (fin de job, erreurs). */
export function showToastForce(text: string, ms = 6000) {
	paintToast(text, ms);
}

function paintToast(text: string, ms: number) {
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
