import { MediaItem, redux } from "@luna/lib";
import type { MediaCollection } from "@luna/lib";

/**
 * Collection représentant les "Tracks" likés (My Collection > Tracks).
 * Équivalent des musiques likées sur Spotify.
 * Les ids sont lus depuis le store redux `favorites.tracks`.
 */
export class FavoriteTracks implements MediaCollection {
	public static isTracksPage(): boolean {
		return document.querySelector('[data-test="my-tracks-page"], [data-track--page-id="mycollection_tracks"]') !== null;
	}

	public static ids(): redux.ItemId[] {
		try {
			const tracks = redux.store.getState()?.favorites?.tracks;
			if (Array.isArray(tracks)) return tracks as redux.ItemId[];
		} catch {
			// store pas encore prêt
		}
		return [];
	}

	public async count(): Promise<number> {
		return FavoriteTracks.ids().length;
	}

	public async mediaItems(): Promise<AsyncGenerator<MediaItem, unknown, unknown>> {
		return MediaItem.fromIds(FavoriteTracks.ids());
	}

	public async title(): Promise<string | undefined> {
		return "Tracks";
	}
}
