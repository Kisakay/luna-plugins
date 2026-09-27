import { Tracer } from "@luna/core";
import { ContextMenu, observe, StyleTag } from "@luna/lib";

import { downloadState, hideBanner } from "./downloadBanner";
import { downloadMediaCollection } from "./downloadCollection";
import { FavoriteTracks } from "./favoriteTracks";
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
		if (downloadState.active) {
			await downloadMediaCollection(new FavoriteTracks());
			return;
		}
		const orig = labelSpan?.textContent ?? labelText;
		if (labelSpan) labelSpan.textContent = "Stop";
		dlBtn.classList.add("sd-busy");
		try {
			await downloadMediaCollection(new FavoriteTracks());
		} finally {
			if (labelSpan) labelSpan.textContent = orig;
			dlBtn.classList.remove("sd-busy");
		}
	};

	container.appendChild(dlBtn);
};

observe(unloads, '[data-test="my-tracks-page"]', injectTracksHeaderButton);
