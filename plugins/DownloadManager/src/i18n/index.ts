/**
 * i18n du plugin : 5 langues (en, zh, ru, ja, es), détection système,
 * réglage manuel ("auto" par défaut). Zéro dépendance.
 *
 * Usage : `t("nav.downloads")`, `t("ctx.tracks", { n: 3 })`.
 * Les textes manquants retombent sur l'anglais, puis sur la clé.
 */
import { en } from "./en";
import { zh } from "./zh";
import { ru } from "./ru";
import { ja } from "./ja";
import { es } from "./es";

export type Locale = "en" | "zh" | "ru" | "ja" | "es";
export type LangSetting = "auto" | Locale;

export const LOCALES: Locale[] = ["en", "zh", "ru", "ja", "es"];

/** Nom natif affiché dans le sélecteur. */
export const LOCALE_NAMES: Record<Locale, string> = {
	en: "English",
	zh: "中文（简体）",
	ru: "Русский",
	ja: "日本語",
	es: "Español",
};

/** Tag BCP47 pour les dates (jours/mois localisés). */
export const LOCALE_TAGS: Record<Locale, string> = {
	en: "en-US",
	zh: "zh-CN",
	ru: "ru-RU",
	ja: "ja-JP",
	es: "es-ES",
};

const DICTS: Record<Locale, Record<string, string>> = { en, zh, ru, ja, es };

// Résolu par le plugin (branché sur settings.language). "auto" par défaut.
let override: LangSetting = "auto";

export function setLocaleOverride(v: LangSetting): void {
	override = v;
	notifyLanguageChanged();
}

export function getLocaleOverride(): LangSetting {
	return override;
}

function detectLocale(): Locale {
	const nav = (navigator.language || "en").toLowerCase();
	if (nav.startsWith("zh")) return "zh";
	if (nav.startsWith("ru")) return "ru";
	if (nav.startsWith("ja")) return "ja";
	if (nav.startsWith("es")) return "es";
	return "en";
}

export function currentLocale(): Locale {
	return override === "auto" ? detectLocale() : override;
}

export function dateLocaleTag(): string {
	return LOCALE_TAGS[currentLocale()];
}

export function t(key: string, vars?: Record<string, string | number>): string {
	const dict = DICTS[currentLocale()];
	let text = dict[key] ?? en[key as keyof typeof en] ?? key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
	}
	return text;
}

// #region Abonnés (le plugin repeint fenêtres/taskbar/menus au changement)
const listeners = new Set<() => void>();

export function onLanguageChange(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

/** Repeint tout le monde (appelé après changement de settings.language). */
export function notifyLanguageChanged(): void {
	for (const cb of [...listeners]) {
		try {
			cb();
		} catch {
			// ignore
		}
	}
}
// #endregion
