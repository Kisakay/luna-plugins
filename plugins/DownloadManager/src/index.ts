import { Tracer } from "@luna/core";
import { ContextMenu, observe, safeTimeout, StyleTag } from "@luna/lib";

import { setBannerStatus, showBanner } from "./downloadBanner";
import { mountBottomOffset } from "./bottomOffset";
import { downloadMediaCollection } from "./downloadCollection";
import { mountIsland } from "./downloadIsland";
import { getFavoritesQueueInfo, onQueueChange, restoreSavedQueue, toggleFavorites } from "./downloadQueue";
import { FavoriteTracks } from "./favoriteTracks";
import { MixCollection, currentMixIdFromUrl } from "./mixCollection";
import { watchPlayedTracks } from "./autoDownload";
import { unloads } from "./index.safe";
import { settings } from "./Settings";
import { onLanguageChange, t } from "./i18n";

import styles from "file://downloadButton.css?minify";
import islandStyles from "file://downloadIsland.css?minify";
// DA framework winml, synchronisée depuis node_modules via prebuild (voir scripts/sync-winml-css.mjs)
import winmlStyles from "file://vendor/win10-shell.css?minify";

export const { errSignal, trace } = Tracer("[DownloadManager]");
export { Settings } from "./Settings";
export { unloads };

new StyleTag("DownloadManager", unloads, styles);
new StyleTag("DownloadManagerIsland", unloads, islandStyles);
new StyleTag("WinmlShell", unloads, winmlStyles);

// Fenêtre de gestion des downloads (style Windows 10) + taskbar
mountIsland();
// Décale les barres bottom (player Tidal) au-dessus de la taskbar
mountBottomOffset();
// Recharge la queue sauvegardée (restart client) : les jobs repartent en queued
void restoreSavedQueue();

// Nettoyage : retire le quickmenu + les boutons Tracks/Mix injectés
unloads.add(() => {
	document.getElementById("luna-downloadmanager-quickmenu")?.remove();
	document.querySelectorAll('[data-luna-downloadmanager="tracks-download-all"]').forEach((b) => b.remove());
	document.querySelectorAll('[data-luna-downloadmanager="mix-download-all"]').forEach((b) => b.remove());
	document.getElementById("luna-downloadmanager-quickmenu")?.remove();
});

const downloadButton = ContextMenu.addButton(unloads);
const tracksDownloadButton = ContextMenu.addButton(unloads);
const mixDownloadButton = ContextMenu.addButton(unloads);

// Helper partagé : toggle les Tracks likés dans la queue.
// (absent -> queue, déjà en file/active -> retire/annule)
const runLikedTracksDownload = async (): Promise<"queued" | "removed" | "cancelled" | "empty"> => {
	const res = await toggleFavorites();
	if (res === "empty") {
		setBannerStatus(t("ctx.noLiked"));
		showBanner();
	}
	refreshAllHeaderButtons();
	return res;
};

// Label live du bouton header selon l'état de la queue
const refreshAllHeaderButtons = () => {
	const info = getFavoritesQueueInfo();
	document.querySelectorAll<HTMLButtonElement>('button[data-luna-downloadmanager="tracks-download-all"]').forEach((btn) => {
		const labelSpan = btn.querySelector("span:last-child");
		if (!labelSpan) return;
		if (!btn.dataset.orig) {
			const count = FavoriteTracks.ids().length;
			btn.dataset.orig = count > 0 ? t("hd.allN", { n: count }) : t("hd.all");
		}
		if (!info) {
			labelSpan.textContent = btn.dataset.orig;
			btn.classList.remove("sd-busy");
		} else if (info.status === "active") {
			labelSpan.textContent = t("hd.stop");
			btn.classList.add("sd-busy");
		} else {
			labelSpan.textContent = t("hd.queued", { n: info.pos });
			btn.classList.add("sd-busy");
		}
	});
};

// Changement de langue : les labels d'origine sont recalculés
unloads.add(
	onLanguageChange(() => {
		document.querySelectorAll<HTMLButtonElement>('button[data-luna-downloadmanager="tracks-download-all"]').forEach((btn) => delete btn.dataset.orig);
		refreshAllHeaderButtons();
	}),
);
let headerQueueSub = false;

// 0) Watcher : auto-download de chaque son joué (option "Auto-download every played track")
watchPlayedTracks();

// 1) Bouton context-menu classique : track / multi / album / playlist
// (fonctionne déjà pour un clic droit sur une ligne de la page Tracks)
ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
	const trackCount = await mediaCollection.count();
	if (trackCount === 0) return;

	downloadButton.text = t("ctx.tracks", { n: trackCount });
	downloadButton.onClick(() => downloadMediaCollection(mediaCollection, downloadButton));

	await downloadButton.show(contextMenu);
});

// 1b) Mix Tidal (My Mix 1-8, Daily Discovery, New Arrivals...) :
// clic droit sur une carte mix (shelf DAILY_MIXES, page Mixes & Radio...)
// émet un event MIX via contextMenu/OPEN (non couvert par onMediaItem
// qui ne gère que ALBUM/PLAYLIST + items).
ContextMenu.onOpen(unloads, async ({ event, contextMenu }) => {
	if (event.type !== "MIX") return;
	const mixId = (event as { id?: string | number }).id;
	if (mixId === undefined || mixId === null) return;
	const mix = await MixCollection.fromId(mixId);
	if (!mix) return;
	// Affiche tout de suite (le chargement du mix peut prendre 1-10s) :
	// le label précis arrive en fond, le download résout les tracks au clic.
	mixDownloadButton.text = t("mix.all");
	mixDownloadButton.onClick(() => downloadMediaCollection(mix, mixDownloadButton));
	await mixDownloadButton.show(contextMenu);
	void mix
		.count()
		.then((n) => {
			if (!mixDownloadButton.elem?.isConnected) return;
			mixDownloadButton.text = n > 0 ? t("ctx.tracks", { n }) : t("mix.empty");
		})
		.catch(() => {});
});

// 2) Page "Tracks" (musiques likées) : aucun event PLAYLIST/ALBUM,
// donc on branche le context-menu générique quand on est sur cette page.
// (onMediaItem gère déjà MEDIA_ITEM/MULTI_MEDIA_ITEM, on les ignore ici)
ContextMenu.onOpen(unloads, async ({ event, contextMenu }) => {
	if (event.type === "MEDIA_ITEM" || event.type === "MULTI_MEDIA_ITEM") return;
	// ALBUM / PLAYLIST sont déjà gérés par onMediaItem ci-dessus, on évite le doublon
	if (event.type === "ALBUM" || event.type === "PLAYLIST") return;
	// MIX / MIX_SHARE : géré par le handler dédié ci-dessous, on évite le doublon
	if (event.type === "MIX" || (event as { type?: string }).type === "MIX_SHARE") return;
	// Le menu sidebar Sort/Filter est géré par l'observer DOM ci-dessous
	if (contextMenu.closest('[data-test="folders-playlists-sort-menu"]') !== null) return;
	if (!FavoriteTracks.isTracksPage()) return;

	const favs = new FavoriteTracks();
	const trackCount = await favs.count();
	if (trackCount === 0) return;

	tracksDownloadButton.text = t("ctx.liked", { n: trackCount });
	tracksDownloadButton.onClick(() => downloadMediaCollection(favs, tracksDownloadButton));

	await tracksDownloadButton.show(contextMenu);
});

// 3) Bouton "Download all" injecté dans le header de la page Tracks
// (à côté de Play / Shuffle), car il n'y a pas de menu playlist à ouvrir au clic droit.
const injectTracksHeaderButton = (tracksPage: Element) => {
	const playBtn = tracksPage.querySelector('[data-test="play-all"]') as HTMLButtonElement | null;
	const container = playBtn?.parentElement;
	if (!container) return;
	if (container.querySelector('[data-luna-downloadmanager="tracks-download-all"]')) return;

	const refBtn = (container.querySelector('[data-test="shuffle-all"]') ?? playBtn) as HTMLButtonElement;
	const labelClass = refBtn.querySelector("span:last-child")?.className ?? "";

	const dlBtn = document.createElement("button");
	dlBtn.type = "button";
	dlBtn.className = refBtn.className;
	dlBtn.setAttribute("data-luna-downloadmanager", "tracks-download-all");
	dlBtn.title = t("hd.title");

	const count = FavoriteTracks.ids().length;
	const labelText = count > 0 ? t("hd.allN", { n: count }) : t("hd.all");

	// Icône download + label (même structure que les boutons Tidal)
	dlBtn.innerHTML = `<span aria-hidden="true" style="display:inline-flex;margin-right:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16"/></svg></span><span class="${labelClass}">${labelText}</span>`;

	dlBtn.onclick = async (e) => {
		e.preventDefault();
		// Toggle dans la queue (jamais de stop brutal) : le label suit via refreshAllHeaderButtons
		await runLikedTracksDownload();
	};

	container.appendChild(dlBtn);
	if (!headerQueueSub) {
		headerQueueSub = true;
		onQueueChange(refreshAllHeaderButtons);
	}
	refreshAllHeaderButtons();
};

observe(unloads, '[data-test="my-tracks-page"]', injectTracksHeaderButton);

// 4) Fallback DOM : le menu sidebar Sort/Filter (folders-playlists-sort-menu,
// celui avec Created date / Alphabetical / Your playlists...) n'est pas émis
// de façon fiable via contextMenu/OPEN, donc on y injecte directement un bouton
// "Download N liked tracks" (la collection Tracks = playlist privée des likés).
const injectSidebarMenuEntry = (menu: Element) => {
	if (menu.querySelector('[data-luna-downloadmanager="sidebar-tracks-download"]')) return;
	const closeBtn = menu.querySelector('button[data-test="context-menu-close-button"]') as HTMLButtonElement | null;
	if (closeBtn === null || closeBtn.parentElement === null) {
		// Le menu se construit parfois en plusieurs temps : réessaie à la prochaine mutation
		const mo = new MutationObserver(() => {
			if (!document.body.contains(menu)) return mo.disconnect();
			if (menu.querySelector('[data-luna-downloadmanager="sidebar-tracks-download"]') !== null) return mo.disconnect();
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
	dlBtn.setAttribute("data-luna-downloadmanager", "sidebar-tracks-download");
	dlBtn.title = t("hd.title");
	const setLabel = () => {
		const count = FavoriteTracks.ids().length;
		dlBtn.textContent = count > 0 ? t("sd.side", { n: count }) : t("sd.sideNone");
	};
	setLabel();
	dlBtn.onclick = async (e) => {
		e.preventDefault();
		e.stopPropagation();
		// Toggle dans la queue (jamais de stop brutal, annulation via l'island)
		const res = await runLikedTracksDownload();
		if (res === "queued") dlBtn.textContent = t("sd.queuedOk");
		else setLabel();
	};
	// En haut du menu (pas en bas) : garanti visible sans scroll
	menu.prepend(dlBtn);
};

observe(unloads, '[data-test="folders-playlists-sort-menu"]', injectSidebarMenuEntry);

// 5) Clic droit sur le lien "Tracks" de la sidebar -> notre propre mini-menu,
// positionné au curseur et entièrement visible (ne dépend pas des menus Tidal).
const QUICKMENU_ID = "luna-downloadmanager-quickmenu";
const closeQuickMenu = () => document.getElementById(QUICKMENU_ID)?.remove();

const showTracksQuickMenu = (x: number, y: number) => {
	closeQuickMenu();
	const count = FavoriteTracks.ids().length;
	const menu = document.createElement("div");
	menu.id = QUICKMENU_ID;
	menu.className = "w10-menu";
	if (settings.winTheme === "dark") menu.classList.add("w10-dark");
	const item = document.createElement("button");
	item.type = "button";
	item.className = "w10-menu-item";
	item.innerHTML = `<span>${count > 0 ? t("sd.side", { n: count }) : t("sd.sideNone")}</span><span class="w10-menu-sub">${t("qm.sub")}</span>`;
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
	if (navItem.hasAttribute("data-luna-downloadmanager-nav")) return;
	navItem.setAttribute("data-luna-downloadmanager-nav", "true");
	navItem.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
		showTracksQuickMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY);
	});
};

observe(unloads, '[data-test="sidebar-collection-tracks"]', attachTracksNavMenu);

// 6) Page Mix (/mix/<id>) : bouton "Download all" injecté dans le header
// (à côté de Play / Shuffle), car le clic droit sur la page ne propose pas
// toujours le menu MIX et il n'y a pas d'autre menu collection à ouvrir.
const injectMixHeaderButton = (playBtn: HTMLButtonElement) => {
	const mixId = currentMixIdFromUrl();
	if (!mixId) return;
	if (FavoriteTracks.isTracksPage()) return;
	const container = playBtn.parentElement;
	if (!container) return;
	// Navigation SPA : le header peut être réutilisé entre deux mix,
	// le bouton existant d'un autre mix est recréé (closure mixId).
	const existing = container.querySelector<HTMLButtonElement>('[data-luna-downloadmanager="mix-download-all"]');
	if (existing) {
		if (existing.dataset.mixId === mixId) return;
		existing.remove();
	}

	const refBtn = (container.querySelector('[data-test="shuffle-all"]') ?? playBtn) as HTMLButtonElement;
	const labelClass = refBtn.querySelector("span:last-child")?.className ?? "";

	const dlBtn = document.createElement("button");
	dlBtn.type = "button";
	dlBtn.className = refBtn.className;
	dlBtn.setAttribute("data-luna-downloadmanager", "mix-download-all");
	dlBtn.dataset.mixId = mixId;
	dlBtn.title = t("mix.title");

	const paintLabel = (n: number | null) => {
		const labelSpan = dlBtn.querySelector("span:last-child");
		const text = n === null ? t("mix.all") : t("mix.allN", { n });
		if (labelSpan) labelSpan.textContent = text;
		else dlBtn.textContent = text;
	};

	dlBtn.innerHTML = `<span aria-hidden="true" style="display:inline-flex;margin-right:6px"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16"/></svg></span><span class="${labelClass}">${t("mix.all")}</span>`;

	dlBtn.onclick = async (e) => {
		e.preventDefault();
		dlBtn.setAttribute("disabled", "true");
		try {
			const mix = await MixCollection.fromId(mixId);
			if (!mix) return;
			await downloadMediaCollection(mix);
		} finally {
			dlBtn.removeAttribute("disabled");
		}
	};

	container.appendChild(dlBtn);

	// Résout le compteur en fond (le chargement du mix peut prendre 1-10s)
	void (async () => {
		try {
			const mix = await MixCollection.fromId(mixId);
			if (!mix) return;
			if (!document.body.contains(dlBtn)) return;
			// Re-vérifie qu'on est toujours sur le même mix (SPA)
			if (currentMixIdFromUrl() !== mixId) return;
			paintLabel(await mix.count());
		} catch {
			// Le label générique reste affiché
		}
	})();
	unloads.add(() => dlBtn.remove());
};

// Le header mix contient un play-all : on s'y accroche uniquement sur /mix/*
// (même data-test sur albums/playlists/tracks, d'où le filtre URL).
observe(unloads, '[data-test="play-all"]', (el) => {
	if (currentMixIdFromUrl() === null) return;
	if (FavoriteTracks.isTracksPage()) return;
	injectMixHeaderButton(el as HTMLButtonElement);
});
