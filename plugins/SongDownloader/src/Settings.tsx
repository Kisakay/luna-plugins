import { ReactiveStore } from "@luna/core";
import { MediaItem, Quality, type redux } from "@luna/lib";
import { LunaButtonSetting, LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting } from "@luna/ui";
import { store as obyStore } from "oby";

import React from "react";
import { clearDownloaded, countDownloaded } from "./downloadHistory";
import { getDownloadFolder } from "./helpers";

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
};
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
});

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
				},
			),
		[],
	);

	return (
		<LunaSettings>
			<LunaSelectSetting
				title="Download quality"
				value={downloadQuality}
				onChange={(e) => setDownloadQuality((settings.downloadQuality = e.target.value))}
			>
				{Object.values(Quality.lookups.audioQuality).map((quality) => {
					if (typeof quality !== "string" && quality.audioQuality !== Quality.MQA.audioQuality)
						return <LunaSelectItem key={quality.name} value={quality.audioQuality} children={quality.name} />;
				})}
			</LunaSelectSetting>
			<LunaSwitchSetting
				title="Use RealMAX to find the highest quality"
				value={useRealMAX}
				onChange={(_, checked) => setUseRealMAX((settings.useRealMAX = checked))}
			/>
			<LunaSwitchSetting
				title="Download lyrics file next to track"
				desc={<>Saves a text file with the lyrics next to each downloaded track</>}
				value={downloadLyrics}
				onChange={(_, checked) => setDownloadLyrics((settings.downloadLyrics = checked))}
			/>
			<LunaTextSetting
				title="Lyrics file suffix"
				desc={
					<>
						Appended to the audio filename.
						<br />
						For example with <b>.lyrics</b>: <b>Title.flac</b> → <b>Title.flac.lyrics</b> (plain text).
					</>
				}
				value={lyricsSuffix}
				onChange={(e) => setLyricsSuffix((settings.lyricsSuffix = e.target.value))}
			/>
			<LunaSwitchSetting
				title="Download metadata file next to track"
				desc={
					<>
						Saves a customizable text file next to each track (edit the template in the download window → Settings).
						<br />
						For example with <b>.meta</b>: <b>Title.flac</b> → <b>Title.flac.meta</b>.
					</>
				}
				value={downloadMeta}
				onChange={(_, checked) => setDownloadMeta((settings.downloadMeta = checked))}
			/>
			<LunaTextSetting
				title="Metadata file suffix"
				desc={<>Appended to the audio filename.</>}
				value={metaSuffix}
				onChange={(e) => setMetaSuffix((settings.metaSuffix = e.target.value))}
			/>
			<LunaButtonSetting
				title="Default save path"
				desc={
					<>
						Set a default folder to save files to (will disable prompting for path on download)
						<br />
						Required for auto-download of played tracks.
						{defaultPath && (
							<>
								<br />
								Using {defaultPath}
							</>
						)}
					</>
				}
				children={defaultPath === undefined ? "Set default folder" : "Clear default folder"}
				onClick={async () => {
					if (defaultPath !== undefined) return setDefaultPath((settings.defaultPath = undefined));
					setDefaultPath((settings.defaultPath = await getDownloadFolder()));
				}}
			/>
			<LunaSwitchSetting
				title="Auto-download every played track"
				desc={
					<>
						Watches playback and automatically saves each played track (+ lyrics) to the default folder.
						<br />
						Already-downloaded files are skipped. No prompt, no click needed.
					</>
				}
				value={autoDownloadPlayed}
				onChange={(_, checked) => setAutoDownloadPlayed((settings.autoDownloadPlayed = checked))}
			/>
			<LunaButtonSetting
				title="Downloaded history"
				desc={<>Remembered tracks are skipped automatically. {countDownloaded()} tracks remembered.</>}
				children="Clear history"
				onClick={() => clearDownloaded()}
			/>
			<LunaSwitchSetting
				title="Dark window theme"
				desc={<>Dark mode for the download manager window (light by default, like Windows 10).</>}
				value={winTheme === "dark"}
				onChange={(_, checked) => setWinTheme((settings.winTheme = checked ? "dark" : "light"))}
			/>
			<LunaTextSetting
				title="Path format"
				desc={
					<>
						Define subfolders using <b>/</b>.
						<br />
						For example: {"{artist}/{album}/{title}"}
						<br />
						Saves in subfolder artist/album/ named <b>title.flac</b>.
						<div style={{ marginTop: 8 }} />
						You can use the following tags (one per line):
						<div style={{ marginTop: 4 }} />
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
