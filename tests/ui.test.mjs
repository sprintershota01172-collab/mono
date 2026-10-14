import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { parseHTML } from "linkedom";
import "fake-indexeddb/auto";
import { loadData } from "../db.js";
import { monthOf, today, allowance } from "../core.js";
// DOM simulation checks event wiring and persistence. It does not replace real-browser layout/touch testing.
test("入力・グループ切替・出張登録・予算保存のDOM操作がIndexedDBに反映される", async () => {
  const { window, document } = parseHTML(
    await readFile(new URL("../index.html", import.meta.url), "utf8"),
  );
  Object.assign(globalThis, {
    window,
    document,
    location: { hash: "", reload() {} },
    history: { replaceState() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  });
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, storage: { persist: async () => true } },
    configurable: true,
  });
  globalThis.BroadcastChannel = class {
    postMessage() {}
    addEventListener() {}
  };
  globalThis.FormData = class {
    constructor(form) {
      this.values = new Map(
        [...form.querySelectorAll("[name]")]
          .filter((x) => !x.disabled && (x.type !== "checkbox" || x.checked))
          .map((x) => [x.name, x.value]),
      );
    }
    get(k) {
      return this.values.get(k) ?? null;
    }
  };
  window.scrollTo = () => {};
  window.isSecureContext = false;
  const dialog = document.querySelector("#sheet");
  dialog.open = false;
  dialog.showModal = () => (dialog.open = true);
  dialog.close = () => (dialog.open = false);
  const click = (sel) => {
    const el = document.querySelector(sel);
    assert.ok(el, `missing ${sel}`);
    el.click();
  };
  const input = (sel, value) => {
    const el = document.querySelector(sel);
    assert.ok(el, `missing ${sel}`);
    el.value = value;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const submit = () => {
    const form = dialog.querySelector("form");
    assert.ok(form);
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  };
  const until = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (await predicate()) return;
      await wait(10);
    }
    assert.fail("Timed out waiting for state");
  };
  await import("../app.js");
  assert.ok(document.querySelector('#quick-save'));
  assert.ok(document.querySelector('.quick-keypad'));
  assert.equal(dialog.open,false);
  for (const [route, label] of [
    ["history", "履歴"],
    ["budget", "予算"],
    ["trips", "出張"],
    ["settings", "設定"],
  ]) {
    if (route === "settings") click("#settings-button");
    else click(`[data-nav="${route}"]`);
    assert.match(
      document.querySelector("#main").textContent,
      new RegExp(label),
    );
  }
  click('[data-nav="home"]');
  for (const digit of ["1", "2", "3"]) click(`[data-action="quick-key"][data-value="${digit}"]`);
  click('[data-action="quick-category"]');
  assert.equal(document.querySelector("#quick-save").disabled, false);
  click('#quick-save');
  await until(async () => (await loadData()).transactions.length === 1);
  await until(() => !dialog.open);
  let d = await loadData();
  assert.equal(d.transactions[0].amount, 123);
  assert.equal(d.transactions[0].date, today());
  // Reuse fills a draft only; overview navigation preserves that draft.
  await until(() => document.querySelector('[data-action="quick-repeat"]'));
  click('[data-action="quick-repeat"]');
  assert.match(document.querySelector('#quick-amount').textContent,/123/);
  assert.equal((await loadData()).transactions.length,1);
  click('[data-action="home-section"][data-section="overview"]');
  assert.ok(document.querySelector('#main > .return-bar'));
  click('[data-action="return-input"]');
  assert.match(document.querySelector('#quick-amount').textContent,/123/);
  assert.equal(document.querySelector('#quick-save').disabled,false);
  // Save and undo affect only the newly created record.
  click('#quick-save');
  await until(async()=>(await loadData()).transactions.length===2);
  await until(()=>document.querySelector('#undo-button'));
  click('#undo-button');
  await until(async()=>(await loadData()).transactions.length===1);
  const originalGroup = d.settings[0].activeGroup;
  const other = d.groups.find(g => g.id !== originalGroup).id;
  click(`[data-group="${other}"]`);
  await until(async () => (await loadData()).settings[0].activeGroup === other);
  await until(() => document.querySelector('#quick-save')?.disabled);
  click(`[data-group="${originalGroup}"]`);
  await until(
    async () => (await loadData()).settings[0].activeGroup === originalGroup,
  );
  await wait(10);
  click('[data-nav="trips"]');
  click('[data-action="new-trip"]');
  input('[name="name"]', "福岡出張");
  input('[name="destination"]', "宮若市");
  input("#trip-departure", "2026-10-01");
  input("#trip-return", "2026-10-04");
  input("#trip-daily-rate", "1800");
  input("#trip-lodging-rate", "2000");
  assert.equal(document.querySelector("#trip-nights").textContent, "宿泊日当 3泊分");
  assert.match(document.querySelector("#trip-auto").textContent, /13,200/);
  submit();
  await until(async () => (await loadData()).trips.length === 1);
  await until(() => !dialog.open);
  d = await loadData();
  assert.equal(allowance(d.trips[0]), 13200);
  click('[data-nav="budget"]');
  assert.equal(document.querySelectorAll('.budget-mini').length,10);
  assert.ok(document.querySelector('#main').classList.contains('fixed-overview'));
  assert.equal(document.querySelectorAll('.budget-mini.folio-off').length,0);
  click('[data-action="budget-edit"]');
  assert.equal(document.querySelector("#manual-limit").value,"250000");
  const manualInput=document.querySelector('.budget-number');
  input('#'+manualInput.id,'76000');
  assert.equal(document.querySelector('#save-budget').disabled,true);
  input('#manual-limit','251000');
  assert.equal(document.querySelector('#save-budget').disabled,false);
  click('[data-action="save-budget"]');
  await until(async()=>(await loadData()).budgets.some(b=>b.mode==='manual'&&b.limit===251000));
  await wait(10);
  click('[data-action="budget-auto"]');
  input("#budget-salary", "250000");
  click('[data-action="budget-recalculate"]');
  assert.match(document.querySelector("#budget-limit").textContent, /212,500/);
  const firstBudgetInput=document.querySelector('.budget-number');
  const firstBudgetId=firstBudgetInput.dataset.id;
  input('#'+firstBudgetInput.id,'1000');
  click('[data-page-key="budget"][data-step="1"]');
  assert.ok(!document.querySelector('#budget-num-'+firstBudgetId));
  click('[data-page-key="budget"][data-step="-1"]');
  assert.equal(document.querySelector('#budget-num-'+firstBudgetId).value,'1000');
  click('[data-action="save-budget"]');
  await until(async () => (await loadData()).budgets.some(b=>b.limit===212500));
  d = await loadData();
  assert.equal(d.budgets[0].month, monthOf(today()));
  assert.equal(d.budgets[0].limit, 212500);
  click('[data-nav="home"]');
  click('[data-action="home-section"][data-section="overview"]');
  click('[data-action="home-section"][data-section="advice"]');
  assert.match(document.querySelector('#main').textContent,/前月/);
  assert.ok(document.querySelector('.editorial-art'));
  click('[data-action="home-section"][data-section="overview"]');
  click('[data-nav="graphs"]');
  assert.equal(document.querySelectorAll('.month-bar').length,6);
  click('[data-kind="category"]');assert.match(document.querySelector('#main').textContent,/生活費/);
  click('[data-kind="buckets"]');assert.match(document.querySelector('#main').textContent,/自由費/);
  click('#settings-button');assert.equal(document.querySelectorAll('.setting-section').length,1);
  click('[data-section="rules"]');assert.ok(document.querySelector('#daily-rate-setting'));
  click('[data-section="data"]');assert.ok(document.querySelector('[data-action="export-json"]'));
  click('[data-section="general"]');click('[data-nav="categories"]');
  assert.equal(document.querySelectorAll('.category-admin').length,5);
  click('[data-page-key="categories"][data-step="1"]');assert.equal(document.querySelectorAll('.category-admin').length,5);
});
