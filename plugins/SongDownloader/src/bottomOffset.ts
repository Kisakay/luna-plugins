import { unloads } from "./index.safe";

/**
 * La taskbar (41px, fixed bottom) recouvrirait le player Tidal.
 * Approche forcée, en 2 couches :
 *  1. Toute barre large collée au bas du viewport (fixed/sticky/ABSOLUTE)
 *     est soulevée de 41px avec !important.
 *  2. Le shell plein-écran de l'app (enfant direct de body qui remplit
 *     le viewport) est réduit à calc(100vh - 41px) pour que le document
 *     finisse réellement au-dessus de la taskbar.
 * Restauration automatique à l'unload.
 */

const LIFT_PX = 41;
const lifted = new Map<HTMLElement, string | null>();
const shrunk = new Map<HTMLElement, { height: string | null; maxHeight: string | null }>();

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
	const r = el.getBoundingClientRect();
	if (r.width === 0 || r.height === 0) return false;
	if (r.height < 20 || r.height > 260) return false;
	if (r.width < window.innerWidth * 0.3) return false;
	if (Math.abs(r.bottom - window.innerHeight) > 4) return false;
	if (isOurs(el)) return false;
	const pos = getComputedStyle(el).position;
	return pos === "fixed" || pos === "sticky" || pos === "absolute";
}

function lift(el: HTMLElement) {
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
}

function shrinkShell(el: HTMLElement) {
	if (shrunk.has(el)) return;
	shrunk.set(el, {
		height: el.style.getPropertyValue("height") || null,
		maxHeight: el.style.getPropertyValue("max-height") || null,
	});
	el.style.setProperty("height", `calc(100vh - ${LIFT_PX}px)`, "important");
	el.style.setProperty("max-height", `calc(100vh - ${LIFT_PX}px)`, "important");
}

function scan() {
	// 1. Barres bottom -> lift
	const els = document.querySelectorAll("body *");
	els.forEach((el) => {
		if (isBottomBar(el)) lift(el);
	});
	// 2. Shell plein-écran (enfant direct de body) -> shrink
	for (const child of Array.from(document.body.children)) {
		if (!(child instanceof HTMLElement)) continue;
		if (isOurs(child)) continue;
		if (child.tagName === "SCRIPT" || child.tagName === "STYLE" || child.tagName === "LINK") continue;
		const r = child.getBoundingClientRect();
		if (r.width < window.innerWidth * 0.9) continue;
		if (r.height < window.innerHeight - 60) continue;
		// Évite les overlays plein-écran temporaires (modales, menus) : on ne
		// touche que si ça ressemble à un shell d'app persistant.
		const pos = getComputedStyle(child).position;
		if (pos === "fixed") continue;
		shrinkShell(child);
	}
	// Oublie les éléments détachés du DOM
	for (const node of [...lifted.keys()]) {
		if (!document.body.contains(node)) lifted.delete(node);
	}
	for (const node of [...shrunk.keys()]) {
		if (!document.body.contains(node)) shrunk.delete(node);
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
	for (const [node, original] of shrunk) {
		try {
			if (original.height === null || original.height === "") node.style.removeProperty("height");
			else node.style.setProperty("height", original.height);
			if (original.maxHeight === null || original.maxHeight === "") node.style.removeProperty("max-height");
			else node.style.setProperty("max-height", original.maxHeight);
		} catch {
			// élément détaché, ignore
		}
	}
	shrunk.clear();
}

export function mountBottomOffset() {
	let debounce: ReturnType<typeof setTimeout> | undefined;
	const debouncedScan = () => {
		if (debounce !== undefined) clearTimeout(debounce);
		debounce = setTimeout(scan, 300);
	};

	scan();
	// Le player peut se monter en différé + enforcement continu
	const t1 = setTimeout(scan, 1500);
	const t2 = setTimeout(scan, 5000);
	const keeper = setInterval(scan, 5000);
	const onResize = () => {
		scan();
		debouncedScan();
	};
	const mo = new MutationObserver(() => debouncedScan());
	window.addEventListener("resize", onResize);
	mo.observe(document.body, { childList: true, subtree: true });

	unloads.add(() => {
		window.removeEventListener("resize", onResize);
		mo.disconnect();
		if (debounce !== undefined) clearTimeout(debounce);
		clearTimeout(t1);
		clearTimeout(t2);
		clearInterval(keeper);
		restore();
	});
}
