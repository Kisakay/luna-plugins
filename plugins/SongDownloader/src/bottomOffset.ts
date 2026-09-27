import { unloads } from "./index.safe";

/**
 * La taskbar (41px, fixed bottom) recouvrirait le player Tidal (lui aussi en
 * fixed bottom). Le padding body ne suffit pas contre du fixed, et les
 * sélecteurs Tidal changent à chaque build : on détecte donc au runtime
 * toute barre large collée au bas du viewport et on la soulève de 41px.
 * Restauration automatique à l'unload.
 */

const LIFT_PX = 41;
const lifted = new Map<HTMLElement, string | null>();

const OURS = [
	"luna-songdownloader-taskbar",
	"luna-songdownloader-win",
	"luna-songdownloader-toast",
	"luna-songdownloader-cal",
	"luna-songdownloader-quickmenu",
	"luna-songdownloader-jobmenu",
];

function isOurs(el: Element): boolean {
	let node: Element | null = el;
	while (node) {
		if (node.id && OURS.includes(node.id)) return true;
		node = node.parentElement;
	}
	return false;
}

function isBottomBar(el: Element): el is HTMLElement {
	if (!(el instanceof HTMLElement)) return false;
	// Filtres pas chers d'abord (un seul reflow pour le batch de lectures)
	const r = el.getBoundingClientRect();
	if (r.width === 0 || r.height === 0) return false;
	if (r.height < 24 || r.height > 220) return false;
	if (r.width < window.innerWidth * 0.4) return false;
	if (Math.abs(r.bottom - window.innerHeight) > 2) return false;
	if (isOurs(el)) return false;
	const pos = getComputedStyle(el).position;
	return pos === "fixed" || pos === "sticky";
}

function scan() {
	const els = document.querySelectorAll("body *");
	els.forEach((el) => {
		if (!isBottomBar(el)) return;
		// Si un ancêtre est déjà soulevé, inutile de soulever l'enfant
		let p: HTMLElement | null = el.parentElement;
		while (p && p !== document.body) {
			if (lifted.has(p)) return;
			p = p.parentElement;
		}
		if (!lifted.has(el)) {
			lifted.set(el, el.style.getPropertyValue("bottom") || null);
			el.style.setProperty("bottom", `${LIFT_PX}px`, "important");
		}
	});
	// Oublie les éléments détachés du DOM
	for (const node of [...lifted.keys()]) {
		if (!document.body.contains(node)) lifted.delete(node);
	}
}

function restore() {
	for (const [node, original] of lifted) {
		try {
			if (original === null || original === "") node.style.removeProperty("bottom");
			else node.style.setProperty("bottom", original);
		} catch {
			// élément détaché, ignore
		}
	}
	lifted.clear();
}

export function mountBottomOffset() {
	let debounce: ReturnType<typeof setTimeout> | undefined;
	const debouncedScan = () => {
		if (debounce !== undefined) clearTimeout(debounce);
		debounce = setTimeout(scan, 300);
	};

	scan();
	// Le player peut se monter en différé : re-scans + écoute resize/DOM
	const t1 = setTimeout(scan, 2000);
	const t2 = setTimeout(scan, 6000);
	const onResize = () => debouncedScan();
	const mo = new MutationObserver(() => debouncedScan());
	window.addEventListener("resize", onResize);
	mo.observe(document.body, { childList: true, subtree: true });

	unloads.add(() => {
		window.removeEventListener("resize", onResize);
		mo.disconnect();
		if (debounce !== undefined) clearTimeout(debounce);
		clearTimeout(t1);
		clearTimeout(t2);
		restore();
	});
}
