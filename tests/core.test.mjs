import test from "node:test";
import assert from "node:assert/strict";
import {
  initialData,
  id,
  validateData,
  nights,
  allowance,
  tripNet,
  householdRows,
  summary,
  proposeBudget,
  sum,
  allocate,
  backupJSON,
  backupCSV,
  restoreData,
  validDate,
  moveMonth,
} from "../core.js";
function fixture() {
  const d = initialData(),
    g = d.groups[0];
  const cat = (name, gid = g.id) =>
    d.categories.find((c) => c.groupId === gid && c.name === name);
  const tx = (name, n, date, extra = {}) => {
    const c = cat(name);
    const t = {
      id: id(),
      groupId: g.id,
      categoryId: c.id,
      type: c.type,
      amount: n,
      date,
      memo: "",
      tripId: null,
      advance: false,
      settled: false,
      createdAt: new Date().toISOString(),
      ...extra,
    };
    d.transactions.push(t);
    return t;
  };
  const trip = (start = "2026-09-30", end = "2026-10-03", extra = {}) => {
    const t = {
      id: id(),
      groupId: g.id,
      name: "福岡出張",
      destination: "宮若市",
      departure: start,
      returnDate: end,
      dailyRate:0, lodgingRate:3800,
      amountOverride: null,
      createdAt: new Date().toISOString(),
      ...extra,
    };
    d.trips.push(t);
    return t;
  };
  return { d, g, cat, tx, trip };
}
test("初期データは架空の取引を含まず、グループ・カテゴリが分離される", () => {
  const { d } = fixture();
  validateData(d);
  assert.equal(d.transactions.length, 0);
  assert.equal(d.groups.length, 2);
  assert.equal(d.categories.length, 34);
  assert.equal(new Set(d.categories.map((c) => c.id)).size, 34);
});
test("泊数は月・年・うるう日をまたいでも正しく日付差を使う", () => {
  assert.equal(nights("2026-12-30", "2027-01-02"), 3);
  assert.equal(nights("2028-02-28", "2028-03-01"), 2);
  assert.equal(nights("2026-10-01", "2026-10-01"), 0);
  assert.throws(() => nights("2026-10-03", "2026-10-01"));
  assert.equal(validDate("2026-99-99"), false);
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(moveMonth("2027-01", -1), "2026-12");
});
test("3泊×3800円の支給額・手動0円・手動上書き", () => {
  const { trip } = fixture();
  const t = trip();
  assert.equal(allowance(t), 11400);
  t.amountOverride = 0;
  assert.equal(allowance(t), 0);
  t.amountOverride = 18000;
  assert.equal(allowance(t), 18000);
});
test("差額反映は出張の全実費を差し引いて帰着月に一度だけ計上", () => {
  const { d, g, tx, trip } = fixture();
  const t = trip();
  tx("交通", 2000, "2026-09-30", { tripId: t.id });
  tx("食費", 1000, "2026-10-01", { tripId: t.id });
  tx("食費", 500, "2026-10-02");
  assert.equal(tripNet(d, t), 8400);
  assert.deepEqual(summary(householdRows(d, g.id, "2026-09")), {
    income: 0,
    expense: 0,
    balance: 0,
  });
  assert.deepEqual(summary(householdRows(d, g.id, "2026-10")), {
    income: 8400,
    expense: 500,
    balance: 7900,
  });
});
test("全額反映は帰着月の収入と記録日の実費で、2か月合計は差額反映と一致", () => {
  const { d, g, tx, trip } = fixture();
  const t = trip();
  tx("交通", 2000, "2026-09-30", { tripId: t.id });
  tx("食費", 1000, "2026-10-01", { tripId: t.id });
  g.tripMode = "full";
  const sep = summary(householdRows(d, g.id, "2026-09"));
  const oct = summary(householdRows(d, g.id, "2026-10"));
  assert.equal(sep.expense, 2000);
  assert.equal(oct.income, 11400);
  assert.equal(oct.expense, 1000);
  assert.equal(sep.balance + oct.balance, 8400);
});
test("赤字出張は差額を支出に計上し精算状態で金額を変えない", () => {
  const { d, g, tx, trip } = fixture();
  const t = trip();
  const expense = tx("交通", 20000, "2026-10-01", {
    tripId: t.id,
    advance: true,
  });
  assert.equal(summary(householdRows(d, g.id, "2026-10")).expense, 8600);
  expense.settled = true;
  assert.equal(summary(householdRows(d, g.id, "2026-10")).expense, 8600);
});
test("出張や取引はほかのグループへ漏れない", () => {
  const { d, g, tx, trip } = fixture();
  const t = trip();
  tx("交通", 2000, "2026-10-01", { tripId: t.id });
  assert.equal(householdRows(d, d.groups[1].id, "2026-10").length, 0);
  assert.notEqual(g.id, d.groups[1].id);
});
test("給与のみを基準に固定費と15%貯蓄を引き、3か月比率で配分する", () => {
  const { d, g, tx, cat } = fixture();
  tx("給与", 300000, "2026-09-25");
  tx("賞与", 100000, "2026-09-25");
  tx("住居", 80000, "2026-09-01");
  tx("通信", 5000, "2026-09-02");
  tx("食費", 30000, "2026-07-01");
  tx("娯楽", 10000, "2026-08-01");
  tx("貯蓄", 15000, "2026-09-01");
  const b = proposeBudget(d, g.id, "2026-10");
  assert.equal(b.salary, 300000);
  assert.equal(b.fixed, 85000);
  assert.equal(b.savingGoal, 45000);
  assert.equal(b.limit, 170000);
  assert.equal(b.allocations[cat("食費").id], 127500);
  assert.equal(b.allocations[cat("娯楽").id], 42500);
  assert.equal(sum(Object.values(b.allocations)), 170000);
});
test("過去3か月より古い支出と別グループの給与は提案に入れない", () => {
  const { d, g, tx, cat } = fixture();
  tx("給与", 200000, "2026-09-25");
  tx("食費", 999999, "2026-06-30");
  const other = cat("給与", d.groups[1].id);
  d.transactions.push({
    ...tx("給与", 1, "2026-05-25"),
    id: id(),
    amount: 500000,
    date: "2026-09-25",
    groupId: other.groupId,
    categoryId: other.id,
  });
  const b = proposeBudget(d, g.id, "2026-10");
  assert.equal(b.salary, 200000);
  assert.equal(b.hasHistory, false);
  assert.ok(b.allocations[cat("食費").id] > b.allocations[cat("医療").id]);
});
test("初月は入力した収入から標準比率で提案し端数まで合計一致", () => {
  const { d, g } = fixture();
  const b = proposeBudget(d, g.id, "2026-10", 255555, 15);
  assert.equal(b.salary, 255555);
  assert.equal(b.savingGoal, 38333);
  assert.equal(sum(Object.values(b.allocations)), 217222);
  assert.equal(b.hasHistory, false);
});
test("給与不足でも負の予算は作らず不足額を返す", () => {
  const { d, g, tx } = fixture();
  tx("住居", 100000, "2026-09-01");
  const b = proposeBudget(d, g.id, "2026-10", 50000, 15);
  assert.equal(b.limit, 0);
  assert.equal(b.shortfall, 57500);
  assert.ok(Object.values(b.allocations).every((n) => n === 0));
});
test("最大剰余法は1円や同率の配分でも金額を保存", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(allocate(2, items, [1, 1, 1]), { a: 1, b: 1, c: 0 });
  assert.equal(sum(Object.values(allocate(1001, items, [0, 0, 0]))), 1001);
});
test("非表示・削除された自由費は新規提案から除き、給与履歴は維持", () => {
  const { d, g, tx, cat } = fixture();
  tx("給与", 200000, "2026-09-25");
  cat("給与").archived = true;
  cat("食費").hidden = true;
  cat("娯楽").archived = true;
  const b = proposeBudget(d, g.id, "2026-10");
  assert.equal(b.salary, 200000);
  assert.equal(b.allocations[cat("食費").id], undefined);
  assert.equal(b.allocations[cat("娯楽").id], undefined);
});
test("JSONとCSVはメモの改行・引用符・日本語を含め全データ復元可能", () => {
  const { d, g, tx, trip } = fixture();
  const t = trip();
  tx("食費", 890, "2026-10-01", {
    memo: '="カフェ,ことり"\n2人分\r\nテスト',
    tripId: t.id,
    advance: true,
  });
  d.budgets.push(proposeBudget(d, g.id, "2026-10", 250000));
  const clean = JSON.parse(JSON.stringify(d));
  for (const [format, body] of [
    ["json", backupJSON(d)],
    ["csv", backupCSV(d)],
  ]) {
    const restored = restoreData(body, format);
    delete restored.exportedAt;
    assert.deepEqual(restored, clean);
  }
});
test("不正なバックアップ・参照・金額・重複IDは復元前に拒否する", () => {
  const { d, tx } = fixture();
  const t = tx("食費", 100, "2026-10-01");
  const bad = (patch) => {
    const n = structuredClone(d);
    patch(n);
    assert.throws(() => validateData(n));
  };
  bad((n) => (n.transactions[0].amount = -1));
  bad((n) => (n.transactions[0].categoryId = "missing"));
  bad((n) => (n.transactions[0].groupId = n.groups[1].id));
  bad((n) => n.transactions.push({ ...t }));
  bad((n) => (n.groups[0].color = "red;display:none"));
  bad((n) => (n.version = 99));
  bad((n) => (n.groups[0].id = "__proto__"));
  assert.throws(() => restoreData("a,b,c", "csv"));
  assert.throws(() => restoreData('"kotori-backup-v1"\n"unterminated', "csv"));
});
