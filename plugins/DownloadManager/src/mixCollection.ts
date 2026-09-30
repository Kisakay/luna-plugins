import { Tracer } from "@luna/core";
import { MediaItem, redux } from "@luna/lib";
import type { MediaCollection } from "@luna/lib";

import { unloads } from "./index.safe";

const { trace } = Tracer("[DownloadManager][Mix]");

type RawRef = { id: NonNullable<Parameters<typeof MediaItem.fromId>[0]>; type: NonNullable<Parameters<typeof MediaItem.fromId>[1]> };
export type RawMixItem = { item: { id: redux.ItemId }; type: redux.ContentType };

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function storeMixTitle(mixId: redux.ItemId): string | undefined {
	try {
		const mixes = (redux.store.getState()?.content as unknown as { mixes?: Record<string, { title?: string }> })?.mixes;
		const title = mixes?.[String(mixId)]?.title;
		return typeof title === "string" && title.length > 0 ? title : undefined;
	} catch {
		return undefined;
	}
}

/** Trouve un mixId dans un href /mix/<id> (cartes Daily Mixes, liens...). */
export function mixIdFromHref(href: string | null | undefined): string | null {
	if (!href) return null;
	const m = href.match(/\/mix\/([0-9a-f-]{8,36})/i);
	return m ? m[1] : null;
}

/** MixId de la page courante (/mix/<id>), null hors page mix. */
export function currentMixIdFromUrl(): string | null {
	try {
		const m = window.location.pathname.match(/\/mix\/([0-9a-f-]{8,36})/i);
		return m ? m[1] : null;
	} catch {
		return null;
	}
}

/**
 * Collection représentant un Mix Tidal (My Mix 1-8, Daily Discovery,
 * New Arrivals...). Les tracks sont chargées via les actions redux
 * `mix/LOAD_TRACK_LIST_FOR_MIX_ID` -> `mix/LOAD_ALL_MIX_MEDIA_ITEMS_SUCCESS`,
 * avec repli sur l'API v1 (`mixes/:id/items`, `pages/mix`).
 */
export class MixCollection implements MediaCollection {
	constructor(
		public readonly mixId: redux.ItemId,
		private cachedTitle?: string,
	) {}

	public static async fromId(mixId?: redux.ItemId): Promise<MixCollection | undefined> {
		if (mixId === undefined || mixId === null || mixId === "") return undefined;
		return new MixCollection(mixId, storeMixTitle(mixId));
	}

	public async title(): Promise<string | undefined> {
		if (this.cachedTitle) return this.cachedTitle;
		const t = storeMixTitle(this.mixId);
		if (t !== undefined) {
			this.cachedTitle = t;
			return t;
		}
		// Dernier repli : titre générique (le job affichera quand même le contenu)
		return `Mix ${String(this.mixId).slice(0, 8)}`;
	}

	private itemsCache: RawMixItem[] | null = null;

	public async tMediaItems(): Promise<RawMixItem[]> {
		if (this.itemsCache !== null) return this.itemsCache;
		const items = await loadMixItems(this.mixId);
		this.itemsCache = items;
		// Le titre a pu arriver dans le store entre-temps (page mix ouverte)
		const t = storeMixTitle(this.mixId);
		if (t !== undefined) this.cachedTitle = t;
		return items;
	}

	public async count(): Promise<number> {
		return (await this.tMediaItems()).length;
	}

	public async mediaItems(): Promise<AsyncGenerator<MediaItem, unknown, unknown>> {
		return MediaItem.fromTMediaItems(await this.tMediaItems());
	}

	/** Références brutes pour le fast-path avec retry de la queue. */
	public async rawRefs(): Promise<RawRef[]> {
		return (await this.tMediaItems())
			.filter((e) => e?.item?.id !== undefined)
			.map((e) => ({ id: e.item.id as RawRef["id"], type: (e.type ?? "track") as RawRef["type"] }));
	}
}

async function loadMixItems(mixId: redux.ItemId): Promise<RawMixItem[]> {
	const viaRedux = await loadViaRedux(mixId);
	if (viaRedux !== null && viaRedux.length > 0) return viaRedux;
	trace.msg.warn.withContext(`Mix ${mixId}: redux gave ${viaRedux?.length ?? 0} items, trying v1 API`)({});
	const viaApi = await loadViaApi(mixId);
	if (viaApi !== null && viaApi.length > 0) return viaApi;
	trace.msg.err.withContext(`Mix ${mixId}: no tracks found (redux + api empty)`)({});
	return [];
}

/**
 * Charge les tracks via l'action native du client :
 * dispatch LOAD_TRACK_LIST_FOR_MIX_ID puis collecte les
 * LOAD_ALL_MIX_MEDIA_ITEMS_SUCCESS du même mixId (pagination possible).
 */
async function loadViaRedux(mixId: redux.ItemId): Promise<RawMixItem[] | null> {
	const collected: RawMixItem[] = [];
	// Interceptions temporaires (nettoyées après la collecte)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bag = new Set<any>();
	try {
		(redux.intercept as any)("mix/LOAD_ALL_MIX_MEDIA_ITEMS_SUCCESS", bag, (payload: any) => {
			try {
				const p = payload as unknown as { mixId?: redux.ItemId; mediaItems?: RawMixItem[]; reset?: boolean };
				if (p.mixId === undefined || String(p.mixId) !== String(mixId)) return;
				if (p.reset === true && collected.length > 0) collected.length = 0;
				if (Array.isArray(p.mediaItems)) {
					for (const m of p.mediaItems) {
						if (m?.item?.id !== undefined) collected.push(m);
					}
				}
			} catch (err) {
				trace.msg.warn.withContext("Mix SUCCESS collect failed")(err);
			}
		});
	} catch (err) {
		trace.msg.warn.withContext("Cannot intercept mix SUCCESS")(err);
		return null;
	}

	try {
		const action = (redux.actions as unknown as Record<string, ((p: unknown) => unknown) | undefined>)["mix/LOAD_TRACK_LIST_FOR_MIX_ID"];
		if (typeof action !== "function") {
			trace.msg.warn.withContext("mix/LOAD_TRACK_LIST_FOR_MIX_ID action missing")({});
			return null;
		}
		await action({ mixId });
	} catch (err) {
		trace.msg.warn.withContext(`Cannot dispatch LOAD_TRACK_LIST_FOR_MIX_ID for ${mixId}`)(err);
	}

	// Attente : premier paquet jusqu'à 10s, puis 1.2s sans croissance = fini.
	// (les gros mix peuvent paginer en plusieurs SUCCESS)
	const start = Date.now();
	const FIRST_TIMEOUT = 10000;
	const QUIET_MS = 1200;
	let lastLen = 0;
	let lastGrow = Date.now();
	let expectedTotal: number | null = null;
	while (Date.now() - start < FIRST_TIMEOUT + 5000) {
		await sleep(100);
		if (collected.length > lastLen) {
			lastLen = collected.length;
			lastGrow = Date.now();
		}
		if (expectedTotal === null) {
			try {
				const lists = (redux.store.getState()?.content as unknown as { mixLists?: Record<string, { totalNumberOfItems?: number }> })?.mixLists;
				const total = lists?.[String(mixId)]?.totalNumberOfItems;
				if (typeof total === "number" && total > 0) expectedTotal = total;
			} catch {
				// ignore
			}
		}
		if (expectedTotal !== null && collected.length >= expectedTotal) break;
		if (collected.length > 0 && Date.now() - lastGrow > QUIET_MS) break;
		if (collected.length === 0 && Date.now() - start > FIRST_TIMEOUT) break;
	}

	// Nettoyage des interceptions temporaires
	try {
		for (const u of [...(bag as Set<() => void>)]) {
			try {
				(u as () => void)();
			} catch {
				// ignore
			}
		}
	} catch {
		// ignore
	}
	unloads.add(() => {
		try {
			for (const u of [...(bag as Set<() => void>)]) {
				try {
					(u as () => void)();
				} catch {
					// ignore
				}
			}
		} catch {
			// ignore
		}
	});

	return collected;
}

async function authHeaders(): Promise<Record<string, string>> {
	try {
		const { TidalApi } = await import("@luna/lib");
		const api = TidalApi as unknown as { getAuthHeaders: () => Promise<Record<string, string>> };
		if (typeof api?.getAuthHeaders === "function") return await api.getAuthHeaders();
	} catch {
		// ignore
	}
	return {};
}

function queryArgs(): string {
	try {
		const state = redux.store.getState();
		const cc = (state as unknown as { session?: { countryCode?: string } })?.session?.countryCode ?? "US";
		const locale = (state as unknown as { settings?: { language?: string } })?.settings?.language ?? "en_US";
		return `countryCode=${cc}&deviceType=DESKTOP&locale=${locale}`;
	} catch {
		return `countryCode=US&deviceType=DESKTOP&locale=en_US`;
	}
}

/** Extrait récursivement les {item:{id}, type} d'un JSON de page Tidal. */
function deepExtractItems(json: unknown): RawMixItem[] {
	const out: RawMixItem[] = [];
	const seen = new Set<string | number>();
	const visit = (node: unknown) => {
		if (node === null || typeof node !== "object") return;
		if (Array.isArray(node)) {
			for (const e of node) visit(e);
			return;
		}
		const rec = node as Record<string, unknown>;
		const item = rec.item as { id?: unknown } | undefined;
		const type = rec.type as unknown;
		if (item !== undefined && typeof item === "object" && item !== null && (type === "track" || type === "video")) {
			const id = (item as { id?: unknown }).id;
			if ((typeof id === "number" || typeof id === "string") && !seen.has(id)) {
				seen.add(id);
				out.push({ item: { id: id as redux.ItemId }, type: type as redux.ContentType });
			}
		}
		// Forme piste nue {id, title, duration...} (mixes/:id/items peut renvoyer ça)
		if ((type === undefined || type === "track") && (typeof rec.id === "number" || typeof rec.id === "string") && typeof rec.title === "string") {
			const id = rec.id as string | number;
			if (!seen.has(id)) {
				seen.add(id);
				out.push({ item: { id: id as redux.ItemId }, type: "track" });
			}
		}
		for (const v of Object.values(rec)) visit(v);
	};
	visit(json);
	return out;
}

/** Repli HTTP direct (aucun event redux requis). */
async function loadViaApi(mixId: redux.ItemId): Promise<RawMixItem[] | null> {
	const id = encodeURIComponent(String(mixId));
	const headers = await authHeaders();
	const args = queryArgs();
	const urls = [
		// REST classique (comme playlists/:id/items) + pagination
		`https://desktop.tidal.com/v1/mixes/${id}/items?${args}&limit=100&offset=0`,
		// Page mix (même source que python-tidal : pages/mix?mixId=..)
		`https://desktop.tidal.com/v1/pages/mix?mixId=${id}&deviceType=BROWSER&${args}`,
		`https://desktop.tidal.com/v1/pages/mix?mixId=${id}&${args}`,
	];
	for (const base of urls) {
		try {
			if (base.includes("/mixes/") && base.includes("/items")) {
				// Pagination offset/limit
				const all: RawMixItem[] = [];
				let offset = 0;
				for (let page = 0; page < 20; page++) {
					const url = base.replace("offset=0", `offset=${offset}`);
					const res = await fetch(url, { headers });
					if (res.status === 403 || res.status === 404) break;
					if (!res.ok) break;
					const json = (await res.json()) as { items?: unknown[]; totalNumberOfItems?: number };
					const found = deepExtractItems(json);
					// Déduplique au fil des pages
					const known = new Set(all.map((e) => String(e.item.id)));
					for (const f of found) {
						if (!known.has(String(f.item.id))) {
							known.add(String(f.item.id));
							all.push(f);
						}
					}
					const total = typeof json.totalNumberOfItems === "number" ? json.totalNumberOfItems : null;
					if (total !== null && all.length >= total) break;
					if (found.length < 100) break;
					offset += 100;
				}
				if (all.length > 0) return all;
				continue;
			}
			const res = await fetch(base, { headers });
			if (res.status === 403 || res.status === 404) continue;
			if (!res.ok) continue;
			const found = deepExtractItems(await res.json());
			if (found.length > 0) return found;
		} catch (err) {
			trace.msg.warn.withContext(`Mix ${mixId} API fallback failed (${base.split("?")[0]})`)(err);
		}
	}
	return null;
}
