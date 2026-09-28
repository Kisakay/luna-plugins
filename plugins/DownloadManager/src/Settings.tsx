import { ReactiveStore } from "@luna/core";
import { MediaItem, Quality, type redux } from "@luna/lib";
import { LunaButtonSetting, LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";
import { store as obyStore } from "oby";

import React from "react";
import { clearDownloaded, countDownloaded } from "./downloadHistory";
import { getDownloadFolder } from "./helpers";
import { LOCALES, LOCALE_NAMES, setLocaleOverride, t, type LangSetting } from "./i18n";
import type { SavedJob } from "./downloadQueue";

const defaultFilenameFormat = "{artist} - {album} - {title}";

type Settings = {
	downloadQuality: redux.AudioQuality;
	defaultPath?: string;
	pathFormat: string;
	useRealMAX: boolean;
	downloadLyrics: boolean;
	lyricsSuffix: string;
	downloadMeta: boolean;
	metaSuffix: string;
	metaTemplate: string;
	autoDownloadPlayed: boolean;
	downloadedIds: (number | string)[];
	winPos: { x: number; y: number } | null;
	winSize: { w: number; h: number } | null;
	winTheme: "light" | "dark";
	accent: string;
	language: LangSetting;
	/** Queue persistée (jobs en attente/actifs) pour restore au restart. */
	savedQueue?: SavedJob[];
};
export const DEFAULT_ACCENT = "#0078d7";
export const isValidAccent = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
// NOTE: la clé de stockage reste "SongDownloader" (nom historique) pour ne
// pas perdre les réglages ni l'historique des installs existantes.
export const settings = await ReactiveStore.getPluginStorage<Settings>("SongDownloader", {
	downloadQuality: Quality.Max.audioQuality,
	pathFormat: defaultFilenameFormat,
	useRealMAX: true,
	downloadLyrics: true,
	lyricsSuffix: ".lyrics",
	downloadMeta: true,
	metaSuffix: ".meta",
	metaTemplate: "Title: {title}\nArtist: {artist}\nAlbum: {album}\nYear: {year}\nISRC: {isrc}",
	autoDownloadPlayed: false,
	downloadedIds: [],
	winPos: null,
	winSize: null,
	winTheme: "light",
	accent: DEFAULT_ACCENT,
	language: "auto",
});

// L'i18n suit le réglage persisté (et notifie fenêtres/taskbar/menus)
setLocaleOverride(settings.language);

// Sanitize accent (hex) + download quality
if (!isValidAccent(settings.accent)) settings.accent = DEFAULT_ACCENT;

// Sanitize download quality
if (Quality.fromAudioQuality(settings.downloadQuality) === undefined) settings.downloadQuality = Quality.Max.audioQuality;

export const Settings = () => {
	const [downloadQuality, setDownloadQuality] = React.useState(settings.downloadQuality);
	const [defaultPath, setDefaultPath] = React.useState(settings.defaultPath);
	const [pathFormat, setPathFormat] = React.useState(settings.pathFormat);
	const [useRealMAX, setUseRealMAX] = React.useState(settings.useRealMAX);
	const [downloadLyrics, setDownloadLyrics] = React.useState(settings.downloadLyrics);
	const [lyricsSuffix, setLyricsSuffix] = React.useState(settings.lyricsSuffix);
	const [downloadMeta, setDownloadMeta] = React.useState(settings.downloadMeta);
	const [metaSuffix, setMetaSuffix] = React.useState(settings.metaSuffix);
	const [autoDownloadPlayed, setAutoDownloadPlayed] = React.useState(settings.autoDownloadPlayed);
	const [winTheme, setWinTheme] = React.useState(settings.winTheme);
	const [accent, setAccent] = React.useState(settings.accent);
	const [language, setLanguage] = React.useState(settings.language);

	// Reste synchronisé avec les valeurs persistées (reload, fenêtre Win10, etc.)
	React.useEffect(
		() =>
			obyStore.on(
				() => {
					void settings.downloadQuality;
					void settings.defaultPath;
					void settings.pathFormat;
					void settings.useRealMAX;
					void settings.downloadLyrics;
					void settings.lyricsSuffix;
					void settings.downloadMeta;
					void settings.metaSuffix;
					void settings.autoDownloadPlayed;
					void settings.winTheme;
					void settings.accent;
					void settings.language;
				},
				() => {
					setDownloadQuality(settings.downloadQuality);
					setDefaultPath(settings.defaultPath);
					setPathFormat(settings.pathFormat);
					setUseRealMAX(settings.useRealMAX);
					setDownloadLyrics(settings.downloadLyrics);
					setLyricsSuffix(settings.lyricsSuffix);
					setDownloadMeta(settings.downloadMeta);
					setMetaSuffix(settings.metaSuffix);
					setAutoDownloadPlayed(settings.autoDownloadPlayed);
					setWinTheme(settings.winTheme);
					setAccent(settings.accent);
					setLanguage(settings.language);
				},
			),
		[],
	);

	return (
		<LunaSettings>
			<LunaSelectSetting
				title={t("ls.lang")}
				desc={t("ls.langD")}
				value={language}
				onChange={(e) => {
					const v = e.target.value as LangSetting;
					setLanguage(v);
					settings.language = v;
					setLocaleOverride(v);
				}}
			>
				<LunaSelectItem key="auto" value="auto" children={t("lg.auto")} />
				{LOCALES.map((l) => (
					<LunaSelectItem key={l} value={l} children={LOCALE_NAMES[l]} />
				))}
			</LunaSelectSetting>
			<LunaSelectSetting
				title={t("ls.quality")}
				value={downloadQuality}
				onChange={(e) => setDownloadQuality((settings.downloadQuality = e.target.value))}
			>
				{Object.values(Quality.lookups.audioQuality).map((quality) => {
					if (typeof quality !== "string" && quality.audioQuality !== Quality.MQA.audioQuality)
						return <LunaSelectItem key={quality.name} value={quality.audioQuality} children={quality.name} />;
				})}
			</LunaSelectSetting>
			<LunaSwitchSetting title={t("ls.realmax")} value={useRealMAX} onChange={(_, checked) => setUseRealMAX((settings.useRealMAX = checked))} />
			<LunaSwitchSetting title={t("ls.lyrics")} desc={<>{t("ls.lyricsD")}</>} value={downloadLyrics} onChange={(_, checked) => setDownloadLyrics((settings.downloadLyrics = checked))} />
			<LunaTextSetting title={t("ls.lyricsSfx")} desc={<>{t("ls.lyricsSfxD")}</>} value={lyricsSuffix} onChange={(e) => setLyricsSuffix((settings.lyricsSuffix = e.target.value))} />
			<LunaSwitchSetting
				title={t("ls.meta")}
				desc={<>{t("ls.metaD")}</>}
				value={downloadMeta}
				onChange={(_, checked) => setDownloadMeta((settings.downloadMeta = checked))}
			/>
			<LunaTextSetting title={t("ls.metaSfx")} desc={<>{t("ls.metaSfxD")}</>} value={metaSuffix} onChange={(e) => setMetaSuffix((settings.metaSuffix = e.target.value))} />
			<LunaButtonSetting
				title={t("ls.folder")}
				desc={
					<>
						{t("ls.folderD")}
						{defaultPath && (
							<>
								<br />
								{t("ls.using", { p: defaultPath })}
							</>
						)}
					</>
				}
				children={defaultPath === undefined ? t("ls.setFolder") : t("ls.clearFolder")}
				onClick={async () => {
					if (defaultPath !== undefined) return setDefaultPath((settings.defaultPath = undefined));
					setDefaultPath((settings.defaultPath = await getDownloadFolder()));
				}}
			/>
			<LunaSwitchSetting title={t("ls.auto")} desc={<>{t("ls.autoD")}</>} value={autoDownloadPlayed} onChange={(_, checked) => setAutoDownloadPlayed((settings.autoDownloadPlayed = checked))} />
			<LunaButtonSetting
				title={t("ls.hist")}
				desc={<>{t("ls.histD", { n: countDownloaded() })}</>}
				children={t("ls.clearHist")}
				onClick={() => clearDownloaded()}
			/>
			<LunaSwitchSetting
				title={t("ls.dark")}
				desc={<>{t("ls.darkD")}</>}
				value={winTheme === "dark"}
				onChange={(_, checked) => setWinTheme((settings.winTheme = checked ? "dark" : "light"))}
			/>
			<LunaTextSetting
				title={t("ls.accent")}
				desc={<>{t("ls.accentD")}</>}
				value={accent}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
					const v = e.target.value.trim();
					if (isValidAccent(v)) setAccent((settings.accent = v));
					else setAccent(v);
				}}
			/>
			<LunaTextSetting
				title={t("ls.path")}
				desc={
					<>
						{t("ls.pathD")}
						<div style={{ marginTop: 8 }} />
						{MediaItem.availableTags.map((tag, i, arr) => (
							<span key={tag}>
								{`{${tag}}`}
								{i < arr.length - 1 && <br />}
							</span>
						))}
					</>
				}
				value={pathFormat}
				onChange={(e) => setPathFormat((settings.pathFormat = e.target.value))}
			/>
		</LunaSettings>
	);
};
