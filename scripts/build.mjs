import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const f of [
  "index.html",
  "style.css",
  "tabi-theme.css",
  "app.js",
  "core.js",
  "preset.js",
  "db.js",
  "icons.js",
  "folio.js",
  "gestures.js",
  "illustrations.js",
  "visuals.js",
  "sw.js",
  "manifest.webmanifest",
  "assets",
  ".nojekyll",
])
  await cp(f, `dist/${f}`, { recursive: true });
console.log("Static PWA ready in dist/");
