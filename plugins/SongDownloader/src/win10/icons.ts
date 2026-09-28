// Mini-framework Win10 — icônes (indépendant de Tidal, pur DOM/SVG).
// Le logo Windows est le tracé officiel 2012 (Microsoft / Pentagram, Wikimedia).

/** Vrai logo officiel Windows 8/10/11 — blanc (currentColor) comme le bouton Démarrer Win10. */
export const WIN10_LOGO = `<svg width="19" height="19" viewBox="0 0 88 88" fill="currentColor" aria-hidden="true"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z"/></svg>`;

/**
 * Icône "Download" façon Windows 10 (Segoe MDL2 / Fluent) :
 * flèche vers le bas + plateau, en currentColor.
 * Dessinée inline pour ne dépendre d'aucune ressource réseau.
 */
export const DOWNLOAD_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5v7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/><path d="M6.8 7.4L10 10.6l3.2-3.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="square" stroke-linejoin="miter"/><path d="M4 12.6v2.2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2.2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3.5 17.5h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>`;

export const GLYPH_MIN = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1"/></svg>`;
export const GLYPH_MAX = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor"/></svg>`;
export const GLYPH_RESTORE = `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="4" y="1" width="5" height="5" fill="none" stroke="currentColor"/><rect x="1" y="4" width="5" height="5" fill="none" stroke="currentColor"/></svg>`;
export const GLYPH_CLOSE = `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1"/></svg>`;

/**
 * Icône "Information" officielle façon Windows (cercle bleu + "i" blanc),
 * en 16px pour titlebars et taskbar. Même DA que MSGBOX_INFO (32px).
 */
export const INFO_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="#0078D7"/><circle cx="8" cy="8" r="7" fill="none" stroke="#005A9E" stroke-width="1"/><rect x="7.1" y="7.2" width="1.8" height="5" fill="#fff"/><circle cx="8" cy="4.9" r="1.2" fill="#fff"/></svg>`;

/**
 * Globe façon Segoe MDL2 (langues) : suit currentColor, donc la couleur
 * d'accent via .sd-win-navglyph — DA Win10 conservée, zéro emoji.
 */
export const GLOBE_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 8h13M2.8 4.8h10.4M2.8 11.2h10.4" stroke="currentColor" stroke-width="1.2"/></svg>`;

// #region Icônes officielles des MessageBox Win32 (info / avertissement / erreur / question)
// Tracés fidèles aux icônes système : cercle bleu + "i" blanc, triangle
// jaune + "!" noir, cercle rouge + croix blanche, cercle bleu + "?" blanc.
export const MSGBOX_INFO = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#0078D7"/><circle cx="16" cy="16" r="14" fill="none" stroke="#005A9E" stroke-width="1.5"/><rect x="14.2" y="14.4" width="3.6" height="10" fill="#fff"/><circle cx="16" cy="9.8" r="2.4" fill="#fff"/></svg>`;
export const MSGBOX_WARNING = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5L29.5 27.5H2.5Z" fill="#FFC83D" stroke="#7A6200" stroke-width="1.5" stroke-linejoin="round"/><rect x="14.9" y="12" width="2.2" height="8" fill="#000"/><circle cx="16" cy="23" r="1.4" fill="#000"/></svg>`;
export const MSGBOX_ERROR = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#E81123"/><circle cx="16" cy="16" r="14" fill="none" stroke="#A50B18" stroke-width="1.5"/><path d="M11 11l10 10M21 11l-10 10" stroke="#fff" stroke-width="3"/></svg>`;
export const MSGBOX_QUESTION = `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#0078D7"/><circle cx="16" cy="16" r="14" fill="none" stroke="#005A9E" stroke-width="1.5"/><path d="M12.5 12.5c0-2 1.6-3.5 3.7-3.5 2 0 3.6 1.4 3.6 3.3 0 2.6-3 2.7-3.2 5.1" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="16.5" cy="21.6" r="1.5" fill="#fff"/></svg>`;
// #endregion
