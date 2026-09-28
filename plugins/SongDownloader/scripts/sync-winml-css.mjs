// Syncs the winml stylesheet into the plugin so the luna file:// loader
// (relative paths only) can inline it. Resolved via node so it works with
// any manager layout (pnpm symlinks, npm hoisting, ...).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginDir = join(here, "..");
const require = createRequire(join(pluginDir, "package.json"));

const src = require.resolve("win10ml/style.css");
const destDir = join(pluginDir, "src", "vendor");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "win10-shell.css"));
console.log(`[sync-winml-css] ${src} -> src/vendor/win10-shell.css`);
