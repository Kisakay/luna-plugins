# @kisakay/win10-shell

Framework-agnostic **Windows 10 desktop HUD for the web**: draggable windows, a taskbar with Start button and pinned apps, context menus, Settings-style controls and a Markdown renderer. **Zero dependencies, pure DOM** — works with vanilla JS, React, Vue, or anything else.

```bash
npm install @kisakay/win10-shell
```

```ts
import { createDesktop, WIN10_LOGO, renderMarkdown } from "@kisakay/win10-shell";
import "@kisakay/win10-shell/style.css";

const desktop = createDesktop({
	start: { iconHTML: WIN10_LOGO, title: "About", onClick: () => about.focus() },
});

const about = desktop.createApp({
	id: "about",
	label: "About",
	titleHTML: `About <span class="w10-credit">my app</span>`,
	width: 420,
	height: 480,
});
about.body.appendChild(renderMarkdown("# Hello\n\nA **Win10 window** on a blank page."));
about.setRunning(true);
about.show();
```

Run the local demo: `npm run build && npm run demo` (http://localhost:8080).

## API

### `createDesktop(opts): Win10Desktop`

Builds the whole environment: taskbar + window manager + theme broadcast.

| Option    | Type                              | Description                                              |
| --------- | --------------------------------- | -------------------------------------------------------- |
| `mount`   | `HTMLElement`                     | Where to mount taskbar + windows (default `document.body`) |
| `theme`   | `"light" \| "dark"`               | Initial theme (default `"light"`)                        |
| `accent`  | `string`                          | Hex accent color, e.g. `#0078d7`                         |
| `start`   | `{ iconHTML, title?, onClick }`   | Start button (Windows logo). Omit for no Start button    |
| `clock`   | `{ onClick?, intervalMs? } \| false` | Taskbar clock. `false` hides it                       |
| `taskbarId` | `string`                        | DOM id of the taskbar (default `"w10-taskbar"`)          |

Desktop methods: `createApp`, `getApp`, `setTheme`, `setAccent` (broadcast to every window), `setStatus(html | null)` (taskbar status text), `setStartOpen`, `destroy`.

### `desktop.createApp(opts): DesktopApp`

| Option         | Type                  | Description                                            |
| -------------- | --------------------- | ------------------------------------------------------ |
| `id`           | `string`              | Unique id (taskbar button + window)                    |
| `label`        | `string`              | Taskbar button label                                   |
| `appTitle`     | `string`              | Taskbar tooltip (default = label)                      |
| `appIconHTML`  | `string`              | Taskbar icon HTML (SVG string)                         |
| `titleHTML`    | `string`              | Window title HTML                                      |
| `avatarUrl`    | `string`              | Small avatar left of the title                         |
| `width/height` | `number`              | Initial size (default 520×560)                         |
| `x/y`          | `number \| null`      | Initial position (default centered)                    |
| `closeMode`    | `"hide" \| "destroy"` | Close button behavior (default `"hide"`)               |
| `onGeometry`   | `(geom) => void`      | Persist position/size after drag/resize                |
| `onDestroy`    | `() => void`          | Cleanup hook                                           |

App methods: `show`, `hide`, `toggle`, `focus` (show + bring to front), `minimize`, `close`, `setRunning` (accent underline in taskbar), `setAppTitle`, `destroy`, plus `window`, `body`, `isOpen`, `isRunning`.

### À-la-carte classes

- `Win10Window` — standalone window (drag/resize/min/max/close, `addNav`, `applyGeometry`, `setTheme`, `setAccent`).
- `Win10Taskbar` — standalone taskbar (`addStartButton`, `addApp`, `setAppState`, `setStatus`, `startClock`).
- Controls: `w10Button`, `w10Toggle`, `w10TextRow`, `w10TextareaRow`, `w10ComboRow`, `w10GroupTitle`, `w10Desc`, `w10Hero`.
- Menus: `showWin10Menu`, `w10MenuItem`, `w10MenuHeader`, `w10Separator`, `closeWin10Menu`.
- `renderMarkdown(md)` — `#/##/###`, `**bold**`, `*italic*`, `` `code` ``, `[text](url)`, `- lists`, `---`.
- Icons: `WIN10_LOGO`, `DOWNLOAD_ICON`, `GLYPH_MIN/MAX/RESTORE/CLOSE`.

## Stylesheet

```ts
import "@kisakay/win10-shell/style.css";
```

Self-contained, every rule scoped to `.w10-*` — no global resets, no element selectors. Accent via `--w10-accent`, dark mode via `.w10-dark`.

## Build outputs

`dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` (types), `dist/win10-shell.css`.

## License

AGPL-3.0-only.
