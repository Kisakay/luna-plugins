import { Tracer } from "@luna/core";
import { ContextMenu, observe, safeTimeout, StyleTag } from "@luna/lib";

import { downloadState, hideBanner, setBannerStatus, showBanner } from "./downloadBanner";
import { downloadMediaCollection } from "./downloadCollection";
import { FavoriteTracks } from "./favoriteTracks";
import { watchPlayedTracks } from "./autoDownload";
import { unloads } from "./index.safe";

import styles from "file://downloadButton.css?minify";
import bannerStyles from "file://downloadBanner.css?minify";

export const { errSignal, trace } = Tracer("[SongDownloader]");
export { Settings } from "./Settings";
export { unloads };

new StyleTag("SongDownloader", unloads, styles);
new StyleTag("SongDownloaderBanner", unloads, bannerStyles);

// Nettoyage : retire la bannière + les boutons Tracks injectés
unloads.add(() => {
	hideBanner();
	document.querySelectorAll('[data-luna-songdownloader="tracks-download-all"]').forEach((b) => b.remove());
});

const downloadButton = ContextMenu.addButton(unloads);
const tracksDownloadButton = ContextMenu.addButton(unloads);

// Helper partagé : télécharge tous les likés (avec feedback si vide).
// Appelé pendant un download actif = demande d'arrêt (voir downloadMediaCollection).
const runLikedTracksDownload = async () => {
	const favs = new FavoriteTracks();
	if ((await favs.count()) === 0) {
		setBannerStatus("No liked tracks found — open the Tracks page first");
		showBanner();
		return;
	}
	await downloadMediaCollection(favs);
};

// 0) Watcher : auto-download de chaque son joué (option "Auto-download every played track")
watchPlayedTracks();

// 1) Bouton context-menu classique : track / multi / album / playlist
// (fonctionne déjà pour un clic droit sur une ligne de la page Tracks)
ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
	const trackCount = await mediaCollection.count();
	if (trackCount === 0) return;

	downloadButton.text = `Download ${trackCount} tracks`;
	downloadButton.onClick(() => downloadMediaCollection(mediaCollection, downloadButton));

	await downloadButton.show(contextMenu);
});

// 2) Page "Tracks" (musiques likées) : aucun event PLAYLIST/ALBUM,
// donc on branche le context-menu générique quand on est sur cette page.
// (onMediaItem gère déjà MEDIA_ITEM/MULTI_MEDIA_ITEM, on les ignore ici)
ContextMenu.onOpen(unloads, async ({ event, contextMenu }) => {
	if (event.type === "MEDIA_ITEM" || event.type === "MULTI_MEDIA_ITEM") return;
	// ALBUM / PLAYLIST sont déjà gérés par onMediaItem ci-dessus, on évite le doublon
	if (event.type === "ALBUM" || event.type === "PLAYLIST") return;
	// Le menu sidebar Sort/Filter est géré par l'observer DOM ci-dessous
	if (contextMenu.closest('[data-test="folders-playlists-sort-menu"]') !== null) return;
	if (!FavoriteTracks.isTracksPage()) return;

	const favs = new FavoriteTracks();
	const trackCount = await favs.count();
	if (trackCount === 0) return;

	tracksDownloadButton.text = `Download ${trackCount} liked tracks`;
	tracksDownloadButton.onClick(() => downloadMediaCollection(favs, tracksDownloadButton));

	await tracksDownloadButton.show(contextMenu);
});

// 3) Bouton "Download all" injecté dans le header de la page Tracks
// (à côté de Play / Shuffle), car il n'y a pas de menu playlist à ouvrir au clic droit.
const injectTracksHeaderButton = (tracksPage: Element) => {
	const playBtn = tracksPage.querySelector('[data-test="play-all"]') as HTMLButtonElement | null;
	const container = playBtn?.parentElement;
	if (!container) return;
	if (container.querySelector('[data-luna-songdownloader="tracks-download-all"]')) return;

	const refBtn = (container.querySelector('[data-test="shuffle-all"]') ?? playBtn) as HTMLButtonElement;
	const labelClass = refBtn.querySelector("span:last-child")?.className ?? "";

	const dlBtn = document.createElement("button");
	dlBtn.type = "button";
	dlBtn.className = refBtn.className;
	dlBtn.setAttribute("data-luna-songdownloader", "tracks-download-all");
	dlBtn.title = "Download all liked Tracks as FLAC";

	const count = FavoriteTracks.ids().length;
	const labelText = count > 0 ? `Download all (${count})` : "Download all";

	// Icône download + label (même structure que les boutons Tidal)
	dlBtn.innerHTML = `<span aria-hidden="true" style="display:inline-flex;margin-right:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16"/></svg></span><span class="${labelClass}">${labelText}</span>`;
	const labelSpan = dlBtn.querySelector("span:last-child") as HTMLSpanElement | null;

	dlBtn.onclick = async (e) => {
		e.preventDefault();
		// Click pendant un download = stop
		if (downloadState.active) return runLikedTracksDownload();
		const orig = labelSpan?.textContent ?? labelText;
		if (labelSpan) labelSpan.textContent = "Stop";
		dlBtn.classList.add("sd-busy");
		try {
			await runLikedTracksDownload();
		} finally {
			if (labelSpan) labelSpan.textContent = orig;
			dlBtn.classList.remove("sd-busy");
		}
	};

	container.appendChild(dlBtn);
};

observe(unloads, '[data-test="my-tracks-page"]', injectTracksHeaderButton);

// 4) Fallback DOM : le menu sidebar Sort/Filter (folders-playlists-sort-menu,
// celui avec Created date / Alphabetical / Your playlists...) n'est pas émis
// de façon fiable via contextMenu/OPEN, donc on y injecte directement un bouton
// "Download N liked tracks" (la collection Tracks = playlist privée des likés).
const injectSidebarMenuEntry = (menu: Element) => {
	if (menu.querySelector('[data-luna-songdownloader="sidebar-tracks-download"]')) return;
	const closeBtn = menu.querySelector('button[data-test="context-menu-close-button"]') as HTMLButtonElement | null;
	if (closeBtn === null || closeBtn.parentElement === null) {
		// Le menu se construit parfois en plusieurs temps : réessaie à la prochaine mutation
		const mo = new MutationObserver(() => {
			if (!document.body.contains(menu)) return mo.disconnect();
			if (menu.querySelector('[data-luna-songdownloader="sidebar-tracks-download"]') !== null) return mo.disconnect();
			if (menu.querySelector('button[data-test="context-menu-close-button"]') !== null) {
				mo.disconnect();
				injectSidebarMenuEntry(menu);
			}
		});
		mo.observe(menu, { childList: true, subtree: true });
		unloads.add(() => mo.disconnect());
		safeTimeout(unloads, () => mo.disconnect(), 5000);
		return;
	}
	const dlBtn = closeBtn.cloneNode(true) as HTMLButtonElement;
	dlBtn.removeAttribute("data-test");
	dlBtn.setAttribute("data-luna-songdownloader", "sidebar-tracks-download");
	dlBtn.title = "Download all liked Tracks as FLAC";
	const setLabel = () => {
		const count = FavoriteTracks.ids().length;
		dlBtn.textContent = count > 0 ? `Download ${count} liked tracks` : "Download liked tracks";
	};
	setLabel();
	dlBtn.onclick = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		// Click pendant un download = stop
		if (downloadState.active) return runLikedTracksDownload();
		dlBtn.textContent = "Stop";
		try {
			await runLikedTracksDownload();
		} finally {
			setLabel();
		}
	};
	// En haut du menu (pas en bas) : garanti visible sans scroll
	menu.prepend(dlBtn);
};

observe(unloads, '[data-test="folders-playlists-sort-menu"]', injectSidebarMenuEntry);

// 5) Clic droit sur le lien "Tracks" de la sidebar -> notre propre mini-menu,
// positionné au curseur et entièrement visible (ne dépend pas des menus Tidal).
const QUICKMENU_ID = "luna-songdownloader-quickmenu";
const closeQuickMenu = () => document.getElementById(QUICKMENU_ID)?.remove();

const showTracksQuickMenu = (x: number, y: number) => {
	closeQuickMenu();
	const count = FavoriteTracks.ids().length;
	const menu = document.createElement("div");
	menu.id = QUICKMENU_ID;
	menu.className = "sd-quickmenu";
	const item = document.createElement("button");
	item.type = "button";
	item.className = "sd-qm-item";
	item.innerHTML = `<span>Download ${count > 0 ? `${count} ` : ""}liked tracks</span><span class="sd-qm-sub">FLAC + lyrics, with current settings</span>`;
	item.onclick = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		closeQuickMenu();
		await runLikedTracksDownload();
	};
	menu.appendChild(item);
	document.body.appendChild(menu);
	// Position au curseur, clampée dans l'écran
	const w = menu.offsetWidth || 250;
	const h = menu.offsetHeight || 60;
	menu.style.left = `${Math.max(0, Math.min(window.innerWidth - w, x))}px`;
	menu.style.top = `${Math.max(0, Math.min(window.innerHeight - h, y))}px`;
	// Ferme sur clic ailleurs / Escape
	const onPointerDown = (ev: PointerEvent) => {
		if (!menu.contains(ev.target as Node)) closeQuickMenu();
	};
	const onKey = (ev: KeyboardEvent) => {
		if (ev.key === "Escape") closeQuickMenu();
	};
	document.addEventListener("pointerdown", onPointerDown, { once: true });
	document.addEventListener("keydown", onKey, { once: true });
	unloads.add(() => {
		closeQuickMenu();
		document.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("keydown", onKey);
	});
};

const attachTracksNavMenu = (navItem: Element) => {
	if (navItem.hasAttribute("data-luna-songdownloader-nav")) return;
	navItem.setAttribute("data-luna-songdownloader-nav", "true");
	navItem.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		showTracksQuickMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY);
	});
};

observe(unloads, '[data-test="sidebar-collection-tracks"]', attachTracksNavMenu);
