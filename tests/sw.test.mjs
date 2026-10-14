import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import vm from "node:vm";
const root = new URL("../", import.meta.url);
async function harness() {
  const scope = "https://example.test/261012TODO/";
  const handlers = {},
    banks = new Map();
  let requested = [];
  const caches = {
    keys: async () => [...banks.keys()],
    delete: async (k) => banks.delete(k),
    open: async (key) => {
      if (!banks.has(key)) banks.set(key, new Map());
      const b = banks.get(key);
      return {
        addAll: async (files) => {
          requested = files;
          for (const f of files) {
            const file = f === "./" ? "index.html" : f.slice(2);
            const content = await readFile(new URL(file, root));
            b.set(
              new URL(f === "./" ? "./index.html" : f, scope).href,
              content.toString("base64"),
            );
          }
        },
        match: async (req) => {
          const url = new URL(typeof req === "string" ? req : req.url);
          url.search = "";
          return b.get(url.href);
        },
      };
    },
  };
  const context = {
    URL,
    caches,
    fetch: async () => {
      throw new Error("OFFLINE");
    },
    self: {
      registration: { scope },
      location: { origin: "https://example.test" },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (type, fn) => (handlers[type] = fn),
    },
  };
  vm.runInNewContext(await readFile(new URL("sw.js", root), "utf8"), context);
  return {
    handlers,
    banks,
    get requested() {
      return requested;
    },
    install: async () => {
      let p;
      handlers.install({ waitUntil: (x) => (p = x) });
      await p;
    },
    fetch: async (path, mode = "cors") => {
      let p;
      handlers.fetch({
        request: { url: new URL(path, scope).href, method: "GET", mode },
        respondWith: (x) => (p = x),
      });
      return p;
    },
  };
}
test("Service Workerはアプリと日本語フォントをすべて事前保存", async () => {
  const h = await harness();
  await h.install();
  for (const f of [
    "app.js",
    "core.js",
    "preset.js",
    "visuals.js",
    "db.js",
    "icons.js",
    "folio.js",
    "illustrations.js",
    "style.css",
    "assets/fonts/ZenKurenaido-Regular.woff2",
  ])
    assert.ok(h.requested.includes("./" + f));
  assert.ok(h.requested.length >= 13);
});
test("オフライン再起動とサブディレクトリ配置でも保存済み画面・モジュールを返す", async () => {
  const h = await harness();
  await h.install();
  assert.ok(await h.fetch("./", "navigate"));
  assert.ok(await h.fetch("./app.js"));
  assert.ok(await h.fetch("./style.css?v=1"));
  assert.ok(await h.fetch("./assets/fonts/ZenKurenaido-Regular.woff2"));
});
test("キャッシュ更新では別アプリ・別スコープを消さない", async () => {
  const h = await harness();
  await h.install();
  h.banks.set("kotori:/261012TODO/:old", new Map());
  h.banks.set("kotori:/different/:old", new Map());
  h.banks.set("other-app", new Map());
  let p;
  h.handlers.activate({ waitUntil: (x) => (p = x) });
  await p;
  assert.equal(h.banks.has("kotori:/261012TODO/:old"), false);
  assert.equal(h.banks.has("kotori:/different/:old"), true);
  assert.equal(h.banks.has("other-app"), true);
});
test("PWAのマニフェストに宣言したアイコンは実在する", async () => {
  const m = JSON.parse(
    await readFile(new URL("manifest.webmanifest", root), "utf8"),
  );
  assert.equal(m.scope, "./");
  assert.equal(m.display, "standalone");
  for (const icon of m.icons) await access(new URL(icon.src, root));
});
