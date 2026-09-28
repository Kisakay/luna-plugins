/** Official Windows 8/10/11 logo path (Microsoft / Pentagram, Wikimedia "Windows logo - 2012.svg"). */
export const WIN10_LOGO = `<svg width="19" height="19" viewBox="0 0 88 88" fill="currentColor" aria-hidden="true"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z"/></svg>`;

/**
 * "Download" icon in the Windows 10 style (Segoe MDL2 / Fluent):
 * down arrow + tray, in currentColor. Inlined so the package
 * never depends on a network resource.
 */
export const DOWNLOAD_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/><path d="M6.8 7.4L10 10.6l3.2-3.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="square" stroke-linejoin="miter"/><path d="M4 12.6v2.2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2.2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3.5 17.5h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>`;

export const GLYPH_MIN = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1"/></svg>`;
export const GLYPH_MAX = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor"/></svg>`;
export const GLYPH_RESTORE = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" y="1" width="5" height="5" fill="none" stroke="currentColor"/><rect x="1" y="4" width="5" height="5" fill="none" stroke="currentColor"/></svg>`;
export const GLYPH_CLOSE = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1"/></svg>`;

/**
 * Official Windows 10 / Segoe MDL2 Assets icon pack, redrawn as inline SVG
 * (20px grid, currentColor, square caps — the MDL2 aesthetic).
 * Zero network dependency, usable anywhere (taskbar, nav, buttons, lists).
 */
const MDL2 = (inner: string) =>
	`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">${inner}</svg>`;

/** Official blue "Information" icon (white "i"), 16px for titlebars/taskbar. */
export const INFO_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="#0078D7"/><circle cx="8" cy="8" r="7" fill="none" stroke="#005A9E" stroke-width="1"/><rect x="7.1" y="7.2" width="1.8" height="5" fill="#fff"/><circle cx="8" cy="4.9" r="1.2" fill="#fff"/></svg>`;

/** Segoe MDL2 Globe (languages). Follows currentColor, i.e. the accent. */
export const GLOBE_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 8h13M2.8 4.8h10.4M2.8 11.2h10.4" stroke="currentColor" stroke-width="1.2"/></svg>`;

/** Official Win32 MessageBox icons (32px): blue i, yellow triangle, red X, blue ?. */
export const MSGBOX_INFO = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#0078D7"/><circle cx="16" cy="16" r="14" fill="none" stroke="#005A9E" stroke-width="1.5"/><rect x="14.2" y="14.4" width="3.6" height="10" fill="#fff"/><circle cx="16" cy="9.8" r="2.4" fill="#fff"/></svg>`;
export const MSGBOX_WARNING = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5L29.5 27.5H2.5Z" fill="#FFC83D" stroke="#7A6200" stroke-width="1.5" stroke-linejoin="round"/><rect x="14.9" y="12" width="2.2" height="8" fill="#000"/><circle cx="16" cy="23" r="1.4" fill="#000"/></svg>`;
export const MSGBOX_ERROR = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#E81123"/><circle cx="16" cy="16" r="14" fill="none" stroke="#A50B18" stroke-width="1.5"/><path d="M11 11l10 10M21 11l-10 10" stroke="#fff" stroke-width="3"/></svg>`;
export const MSGBOX_QUESTION = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#0078D7"/><circle cx="16" cy="16" r="14" fill="none" stroke="#005A9E" stroke-width="1.5"/><path d="M12.5 12.5c0-2 1.6-3.5 3.7-3.5 2 0 3.6 1.4 3.6 3.3 0 2.6-3 2.7-3.2 5.1" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="16.5" cy="21.6" r="1.5" fill="#fff"/></svg>`;

/** Navigation: back / forward arrows. */
export const ICON_BACK = MDL2(`<path d="M12 4.5L5.5 10l6.5 5.5M5.5 10H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_FORWARD = MDL2(`<path d="M8 4.5l6.5 5.5L8 15.5M14.5 10H5" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);

/** Chevrons. */
export const ICON_CHEVRON_UP = MDL2(`<path d="M4.5 12L10 6.5 15.5 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_CHEVRON_DOWN = MDL2(`<path d="M4.5 8l5.5 5.5L15.5 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_CHEVRON_LEFT = MDL2(`<path d="M12 4.5L6.5 10l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_CHEVRON_RIGHT = MDL2(`<path d="M8 4.5l5.5 5.5L8 15.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);

/** Directional arrows (with shaft). */
export const ICON_ARROW_UP = MDL2(`<path d="M10 16.5V3.5M4.8 8.7L10 3.5l5.2 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_ARROW_DOWN = MDL2(`<path d="M10 3.5v13M4.8 11.3L10 16.5l5.2-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_ARROW_LEFT = MDL2(`<path d="M16.5 10h-13M8.7 4.8L3.5 10l5.2 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_ARROW_RIGHT = MDL2(`<path d="M3.5 10h13M11.3 4.8l5.2 5.2-5.2 5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);

/** Basic shapes: check, plus, minus, record dot. */
export const ICON_CHECK = MDL2(`<path d="M4 10.2l4.4 4.4L16 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_PLUS = MDL2(`<path d="M10 4.5v11M4.5 10h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_MINUS = MDL2(`<path d="M4.5 10h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_DOT = MDL2(`<circle cx="10" cy="10" r="4" fill="currentColor" stroke="none"/>`);

/** Media transport: play, pause, stop. */
export const ICON_PLAY = MDL2(`<path d="M7 4.5l9 5.5-9 5.5z" fill="currentColor" stroke="none"/>`);
export const ICON_PAUSE = MDL2(
	`<rect x="6.5" y="4.5" width="2.8" height="11" fill="currentColor" stroke="none"/><rect x="10.7" y="4.5" width="2.8" height="11" fill="currentColor" stroke="none"/>`,
);
export const ICON_STOP = MDL2(`<rect x="6" y="6" width="8" height="8" fill="currentColor" stroke="none"/>`);

/** Audio speaker with waves. */
export const ICON_VOLUME = MDL2(
	`<path d="M3.5 8H7l4-3.2v10.4L7 12H3.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13.5 7.5a4 4 0 0 1 0 5M15.8 5.5a7 7 0 0 1 0 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`,
);

/** Music note. */
export const ICON_MUSIC = MDL2(
	`<ellipse cx="7" cy="14" rx="2.6" ry="2.1" stroke="currentColor" stroke-width="1.6"/><path d="M9.6 13.6V4.2c2 0 3.5.8 4.4 2.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`,
);

/** Actions: search, refresh, save, trash, edit, share-less basics. */
export const ICON_SEARCH = MDL2(`<circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M13.2 13.2L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_REFRESH = MDL2(`<path d="M16.8 10a6.8 6.8 0 1 1-2-4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/><path d="M15 2.5h4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_SAVE = MDL2(
	`<path d="M5 3h8.5L17 6.5V17H5V3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 3v4h6V3M7.5 17v-5h5v5" stroke="currentColor" stroke-width="1.4"/>`,
);
export const ICON_TRASH = MDL2(
	`<path d="M6 5.5h8M8.5 5.5V3.8h3v1.7M7 5.5l.6 11h4.8L13 5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/><path d="M9.2 8.5v6M10.8 8.5v6" stroke="currentColor" stroke-width="1.4"/>`,
);
export const ICON_EDIT = MDL2(`<path d="M13.5 3.5l3 3L8 15H5v-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`);

/** Objects: folder, file, home, star, heart, user, lock, calendar, clock, mail. */
export const ICON_FOLDER = MDL2(`<path d="M2.5 5.5h5l1.6 2h8.4V15h-15z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`);
export const ICON_FILE = MDL2(`<path d="M5.5 2.8h5.5l4 4v10.4H5.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 2.8v4h4" stroke="currentColor" stroke-width="1.4"/>`);
export const ICON_HOME = MDL2(`<path d="M3.5 9.8L10 4l6.5 5.8M6 8.8V16h8V8.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);
export const ICON_STAR = MDL2(
	`<path d="M10 3.2l2 4.8 5.2.2-4 3.2 1.3 5.1-4.5-2.9-4.5 2.9 1.3-5.1-4-3.2L8 8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
);
export const ICON_HEART = MDL2(
	`<path d="M10 17c-4-4-7-6.5-7-9.2C3 5.7 4.6 4 6.7 4c1.3 0 2.5.8 3.3 2 .8-1.2 2-2 3.3-2C15.4 4 17 5.7 17 7.8 17 10.5 14 13 10 17z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
);
export const ICON_USER = MDL2(
	`<circle cx="10" cy="6.8" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M3.8 16.8c.6-3.4 3-5.2 6.2-5.2s5.6 1.8 6.2 5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`,
);
export const ICON_LOCK = MDL2(
	`<rect x="6" y="9" width="8" height="7" stroke="currentColor" stroke-width="1.6"/><path d="M7.8 9V6.8a2.2 2.2 0 0 1 4.4 0V9" stroke="currentColor" stroke-width="1.6"/>`,
);
export const ICON_CALENDAR = MDL2(
	`<rect x="3.5" y="5" width="13" height="11" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9h13M7 2.8V6M13 2.8V6" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`,
);
export const ICON_CLOCK = MDL2(`<circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 6.5V10l2.6 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`);
export const ICON_MAIL = MDL2(
	`<rect x="3" y="5.5" width="14" height="9" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 6.2L10 11l6.5-4.8" stroke="currentColor" stroke-width="1.6"/>`,
);

/** Windows Security shield with check (NT security). */
export const ICON_SHIELD = MDL2(
	`<path d="M10 2.8l6 2.4v4.6c0 3.8-2.6 6-6 7.2-3.4-1.2-6-3.4-6-7.2V5.2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.3 9.8l1.9 1.9 3.3-3.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>`,
);

/** Power button. */
export const ICON_POWER = MDL2(`<path d="M10 3v6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/><path d="M6.3 6.2a6.8 6.8 0 1 0 7.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`);

/** WiFi radiating arcs. */
export const ICON_WIFI = MDL2(
	`<path d="M3.5 11.5a9 9 0 0 1 13 0M6 14a5.5 5.5 0 0 1 8 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/><circle cx="10" cy="16.6" r="1.3" fill="currentColor" stroke="none"/>`,
);

/** Battery. */
export const ICON_BATTERY = MDL2(
	`<rect x="2.5" y="7" width="12" height="6" stroke="currentColor" stroke-width="1.6"/><path d="M16.8 9v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`,
);

/** Settings cog (simplified official gear). */
export const ICON_SETTINGS = MDL2(
	`<circle cx="10" cy="10" r="2.6" stroke="currentColor" stroke-width="1.6"/><path d="M14.6 10h2.8M2.6 10h2.8M10 14.6v2.8M10 2.6v2.8M13.2 13.2l2 2M4.8 4.8l2 2M13.2 6.8l2-2M4.8 15.2l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>`,
);
