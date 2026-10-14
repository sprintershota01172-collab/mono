export const VERSION = 2;
export const STORES = [
  "groups",
  "categories",
  "transactions",
  "trips",
  "budgets",
  "settings",
];
export const PALETTE = [
  "#527D6D",
  "#8A719F",
  "#A86C57",
  "#537D9A",
  "#A17C37",
  "#8A6C80",
];
export const MAX_MONEY = 999999999;
export const id = () => crypto.randomUUID();
export const sum = (a) => a.reduce((s, n) => s + n, 0);
export const yen = (n) =>
  new Intl.NumberFormat("ja-JP").format(Math.round(n || 0));
export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const monthOf = (d) => d.slice(0, 7);
export function moveMonth(m, delta) {
  const [y, n] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, n - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function validDate(s) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= "1900-01-01" &&
    s <= "2200-12-31" &&
    Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function nights(start, end) {
  if (!validDate(start) || !validDate(end) || end < start)
    throw new Error("帰着日は出発日以降にしてください。");
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
}
export const tripDays = (t) => nights(t.departure, t.returnDate) + 1;
export function tripAmounts(t) {
 const n = nights(t.departure,t.returnDate);
 const daily = (n+1)*(t.dailyRate ?? 0);
 const lodging = n*(t.lodgingRate ?? t.nightlyRate ?? 0);
 return {days:n+1,nights:n,daily,lodging,total:daily+lodging};
}
export const allowance = t => t.amountOverride !== null && t.amountOverride !== undefined ? t.amountOverride : tripAmounts(t).total;
// The old rate was per night. Keep the exact old allowance when upgrading.
export function upgradeRateRecord(r) {
 if(r.dailyRate === undefined && r.lodgingRate === undefined) return {...r,dailyRate:0,lodgingRate:r.nightlyRate ?? 0};
 return r;
}
export function upgradeBackup(d) {
 if(d?.version!==1)return d;
 if(!Array.isArray(d.groups)||!Array.isArray(d.trips))throw new Error('バックアップの形式が不正です。');
 return {...d,version:VERSION,groups:d.groups.map(upgradeRateRecord),trips:d.trips.map(upgradeRateRecord)};
}
export const expenseOfTrip = (data, t) =>
  sum(
    data.transactions
      .filter((x) => x.tripId === t.id && x.type === "expense")
      .map((x) => x.amount),
  );
export const tripNet = (data, t) => allowance(t) - expenseOfTrip(data, t);
const defaults = [
  ["食費", "utensils", "#A07847", "free", 30],
  ["日用品", "basket", "#668C83", "free", 10],
  ["交通", "train", "#6790A5", "free", 10],
  ["住居", "home", "#998572", "fixed", 0],
  ["光熱費", "sun", "#B19449", "fixed", 0],
  ["通信", "phone", "#7A80AC", "fixed", 0],
  ["娯楽", "music", "#AA7A93", "free", 15],
  ["美容", "sparkles", "#AC7986", "free", 5],
  ["衣服", "shirt", "#8C84A5", "free", 8],
  ["医療", "heart", "#AA7770", "free", 5],
  ["教育", "book", "#738E79", "free", 5],
  ["交際", "gift", "#B48961", "free", 7],
  ["貯蓄", "leaf", "#658C6A", "saving", 0],
  ["その他", "dots", "#8E8B84", "free", 5],
];
export function makeGroup(
  name = "プライベート",
  color = PALETTE[0],
  order = 0,
) {
  return {
    id: id(),
    name,
    color,
    order,
    savingRate: 15,
    tripMode: "net",
    dailyRate: 0,
    lodgingRate: 0,
  };
}
export function makeCategories(groupId) {
  const expenses = defaults.map(
    ([name, icon, color, bucket, weight], order) => ({
      id: id(),
      groupId,
      name,
      icon,
      color,
      bucket,
      weight,
      order,
      type: "expense",
      role: "other",
      hidden: false,
      archived: false,
    }),
  );
  return [
    ...expenses,
    ...["給与", "賞与", "副収入"].map((name, i) => ({
      id: id(),
      groupId,
      name,
      icon: ["wallet", "gift", "leaf"][i],
      color: PALETTE[0],
      type: "income",
      role: i === 0 ? "salary" : "other",
      bucket: "free",
      weight: 0,
      order: i,
      hidden: false,
      archived: false,
    })),
  ];
}
export function initialData() {
  const g = makeGroup();
  const f = makeGroup("家族", PALETTE[1], 1);
  return {
    version: VERSION,
    groups: [g, f],
    categories: [...makeCategories(g.id), ...makeCategories(f.id)],
    transactions: [],
    trips: [],
    budgets: [],
    settings: [{ id: "app", theme: "system", activeGroup: g.id }],
  };
}
export function householdRows(data, groupId, month) {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return [];
  const rows = data.transactions
    .filter(
      (t) =>
        t.groupId === groupId &&
        monthOf(t.date) === month &&
        (group.tripMode === "full" || !t.tripId),
    )
    .map((t) => ({ ...t, synthetic: false }));
  for (const t of data.trips.filter(
    (t) => t.groupId === groupId && monthOf(t.returnDate) === month,
  )) {
    const n = group.tripMode === "net" ? tripNet(data, t) : allowance(t);
    if (n !== 0)
      rows.push({
        id: "trip:" + t.id,
        groupId,
        type: n >= 0 ? "income" : "expense",
        amount: Math.abs(n),
        date: t.returnDate,
        categoryId: "trip",
        tripId: t.id,
        memo: t.name,
        synthetic: true,
      });
  }
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
  );
}
export function summary(rows) {
  const income = sum(
    rows.filter((r) => r.type === "income").map((r) => r.amount),
  );
  const expense = sum(
    rows.filter((r) => r.type === "expense").map((r) => r.amount),
  );
  return { income, expense, balance: income - expense };
}
export function allocate(total, items, weights) {
  if (!items.length) return {};
  const ws = items.map((x, i) => Math.max(0, Number(weights[i]) || 0));
  const weight = sum(ws) || items.length;
  const fractions = items.map((x, i) => ({
    id: x.id,
    n: total * ((sum(ws) ? ws[i] : 1) / weight),
  }));
  const result = Object.fromEntries(
    fractions.map((x) => [x.id, Math.floor(x.n)]),
  );
  let rest = total - sum(Object.values(result));
  for (const x of [...fractions].sort((a, b) => (b.n % 1) - (a.n % 1))) {
    if (rest-- <= 0) break;
    result[x.id]++;
  }
  return result;
}
export function proposeBudget(
  data,
  groupId,
  month,
  salaryOverride = null,
  savingRateOverride = null,
) {
  const group = data.groups.find((g) => g.id === groupId);
  const prev = moveMonth(month, -1);
  const cats = data.categories.filter((c) => c.groupId === groupId);
  const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
  const prior = householdRows(data, groupId, prev);
  const salaryActual = sum(
    prior
      .filter(
        (x) => x.type === "income" && byId[x.categoryId]?.role === "salary",
      )
      .map((x) => x.amount),
  );
  const salary = salaryOverride === null ? salaryActual : salaryOverride;
  const fixed = sum(
    prior
      .filter(
        (x) => x.type === "expense" && byId[x.categoryId]?.bucket === "fixed",
      )
      .map((x) => x.amount),
  );
  const rate =
    savingRateOverride === null ? group.savingRate : savingRateOverride;
  const savingGoal = Math.floor((salary * rate) / 100);
  const rawLimit = salary - fixed - savingGoal;
  const limit = Math.max(0, rawLimit);
  const free = cats
    .filter(
      (c) =>
        c.type === "expense" && c.bucket === "free" && !c.hidden && !c.archived,
    )
    .sort((a, b) => a.order - b.order);
  const past = [1, 2, 3].flatMap((n) =>
    householdRows(data, groupId, moveMonth(month, -n)),
  );
  const weights = free.map((c) =>
    sum(
      past
        .filter((x) => x.type === "expense" && x.categoryId === c.id)
        .map((x) => x.amount),
    ),
  );
  const hasHistory = sum(weights) > 0;
  return {
    id: `${groupId}:${month}`,
    groupId,
    month,
    salary,
    salaryActual,
    fixed,
    savingRate: rate,
    savingGoal,
    limit,
    shortfall: Math.max(0, -rawLimit),
    allocations: allocate(
      limit,
      free,
      hasHistory ? weights : free.map((c) => c.weight || 5),
    ),
    hasHistory,
    createdAt: new Date().toISOString(),
  };
}
function check(condition, message) {
  if (!condition) throw new Error(message);
}
const money = (n) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_MONEY;
const textOk = (s, max) => typeof s === "string" && s.length <= max;
const identifier = (s) =>
  typeof s === "string" &&
  /^[a-zA-Z0-9:_-]{1,160}$/.test(s) &&
  !["__proto__", "prototype", "constructor"].includes(s);
const color = (s) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
export function validateData(d) {
  check(d && d.version === VERSION, "対応していないバックアップ形式です。");
  for (const store of STORES) {
    check(
      Array.isArray(d[store]) && d[store].length <= 100000,
      "データの件数または形式が不正です。",
    );
    const seen = new Set();
    for (const r of d[store]) {
      check(
        r && identifier(r.id) && !seen.has(r.id),
        "IDが重複しているか、不正です。",
      );
      seen.add(r.id);
    }
  }
  check(
    d.groups.length > 0 && d.groups.length <= 100,
    "グループは1〜100個必要です。",
  );
  const groups = new Map(d.groups.map((g) => [g.id, g]));
  const cats = new Map(d.categories.map((c) => [c.id, c]));
  const trips = new Map(d.trips.map((t) => [t.id, t]));
  for (const g of d.groups)
    check(
      textOk(g.name, 40) &&
        g.name.trim() &&
        color(g.color) &&
        Number.isFinite(g.order) &&
        ["net", "full"].includes(g.tripMode) &&
        Number.isInteger(g.savingRate) &&
        g.savingRate >= 0 &&
        g.savingRate <= 100 &&
        money(g.dailyRate) && money(g.lodgingRate),
      "グループの内容が不正です。",
    );
  for (const c of d.categories)
    check(
      groups.has(c.groupId) &&
        textOk(c.name, 30) &&
        c.name.trim() &&
        color(c.color) &&
        textOk(c.icon, 30) &&
        Number.isFinite(c.order) &&
        Number.isFinite(c.weight) &&
        c.weight >= 0 &&
        ["expense", "income"].includes(c.type) &&
        ["fixed", "free", "saving"].includes(c.bucket) &&
        ["salary", "other"].includes(c.role) &&
        typeof c.hidden === "boolean" &&
        typeof c.archived === "boolean",
      "項目の内容が不正です。",
    );
  for (const t of d.trips) {
    check(
      groups.has(t.groupId) &&
        textOk(t.name, 60) &&
        t.name.trim() &&
        textOk(t.destination, 60) &&
        validDate(t.departure) &&
        validDate(t.returnDate) &&
        t.returnDate >= t.departure &&
        money(t.dailyRate) && money(t.lodgingRate) &&
        (t.amountOverride === null || money(t.amountOverride)),
      "出張の内容が不正です。",
    );
    check(money(allowance(t)), "出張の支給額が上限を超えています。");
  }
  for (const t of d.transactions)
    check(
      groups.has(t.groupId) &&
        cats.get(t.categoryId)?.groupId === t.groupId &&
        cats.get(t.categoryId)?.type === t.type &&
        money(t.amount) &&
        t.amount > 0 &&
        validDate(t.date) &&
        textOk(t.memo, 300) &&
        textOk(t.createdAt, 40) &&
        typeof t.advance === "boolean" &&
        typeof t.settled === "boolean" &&
        (!t.tripId ||
          (t.type === "expense" && trips.get(t.tripId)?.groupId === t.groupId)),
      "収支の内容または紐づけが不正です。",
    );
  for (const b of d.budgets) {
    check(
      groups.has(b.groupId) &&
        /^\d{4}-\d{2}$/.test(b.month) &&
        validDate(b.month + "-01") &&
        b.id === `${b.groupId}:${b.month}` &&
        money(b.salary) &&
        money(b.fixed) &&
        money(b.savingGoal) &&
        money(b.limit) &&
        Number.isInteger(b.savingRate) &&
        b.savingRate >= 0 &&
        b.savingRate <= 100 &&
        b.allocations &&
        typeof b.allocations === "object" &&
        !Array.isArray(b.allocations),
      "予算の内容が不正です。",
    );
    for (const [k, v] of Object.entries(b.allocations))
      check(
        identifier(k) &&
          cats.get(k)?.groupId === b.groupId &&
          cats.get(k)?.type === "expense" &&
          money(v),
        "予算の項目または金額が不正です。",
      );
  }
  for (const s of d.settings)
    check(
      s.id === "app" &&
        ["system", "light", "dark"].includes(s.theme) &&
        groups.has(s.activeGroup),
      "設定の内容が不正です。",
    );
  check(d.settings.length === 1, "設定は1件必要です。");
  return d;
}
export function backupJSON(data) {
  return JSON.stringify(
    { ...data, exportedAt: new Date().toISOString() },
    null,
    2,
  );
}
// Each CSV row holds a typed entity. The payload preserves every field for a lossless round trip.
const csvCell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
export function backupCSV(data) {
  const rows = [
    [
      "kotori-backup-v2",
      "id",
      "groupId",
      "name_or_memo",
      "date",
      "amount",
      "payload",
    ],
  ];
  for (const type of STORES)
    for (const r of data[type])
      rows.push([
        type,
        r.id,
        r.groupId || "",
        String(r.name || r.memo || "").replace(/^[=+\-@\t\r]/, "'$&"),
        r.date || r.month || "",
        r.amount ?? "",
        JSON.stringify(r),
      ]);
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') {
      check(cell === "", "CSVの引用符が不正です。");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  check(!quoted, "CSVが途中で切れています。");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
export function restoreData(text, format = "json") {
  let d;
  if (format === "csv") {
    const rows = parseCSV(text);
    check(
      ["kotori-backup-v1", "kotori-backup-v2"].includes(rows[0]?.[0]),
      "ことり家計簿の全データCSVを選んでください。",
    );
    d = { version: rows[0][0].endsWith("v1")?1:VERSION, ...Object.fromEntries(STORES.map((s) => [s, []])) };
    for (const row of rows.slice(1)) {
      if (row.every((x) => !x)) continue;
      check(STORES.includes(row[0]) && row.length === 7, "CSVの行が不正です。");
      const r = JSON.parse(row[6]);
      check(
        r.id === row[1] && (r.groupId || "") === row[2],
        "CSVのIDが一致しません。",
      );
      d[row[0]].push(r);
    }
  } else d = JSON.parse(text);
  return validateData(upgradeBackup(d));
}

export function graphData(data,groupId,endMonth,count=6) {
 const trend=Array.from({length:count},(_,i)=>{const month=moveMonth(endMonth,i-count+1);return {month,...summary(householdRows(data,groupId,month))};});
 const rows=householdRows(data,groupId,endMonth).filter(t=>t.type==='expense');
 const cats=new Map(data.categories.filter(c=>c.groupId===groupId).map(c=>[c.id,c]));
 const amounts=new Map();const buckets={fixed:0,free:0,saving:0,trip:0};
 for(const t of rows){amounts.set(t.categoryId,(amounts.get(t.categoryId)||0)+t.amount);const bucket=t.synthetic?'trip':cats.get(t.categoryId)?.bucket||'free';buckets[bucket]+=t.amount;}
 const categories=[...amounts].map(([id,amount])=>({id,amount,name:cats.get(id)?.name||'出張差額',color:cats.get(id)?.color||'#8A719F'})).sort((a,b)=>b.amount-a.amount);
 return {trend,categories,buckets,total:sum(rows.map(t=>t.amount))};
}

// Compare equal elapsed periods for the current month, full periods for past months.
export function spendingAdvice(data, groupId, month, asOf=today()) {
 const previous=moveMonth(month,-1), currentMonth=monthOf(asOf);
 const partial=month===currentMonth;
 const day=partial?Number(asOf.slice(8)):31;
 const end=(m)=>{const [y,n]=m.split('-').map(Number);return `${m}-${String(Math.min(day,new Date(y,n,0).getDate())).padStart(2,'0')}`;};
 const filter=m=>householdRows(data,groupId,m).filter(t=>t.type==='expense'&&t.date<=end(m));
 const current=filter(month), before=filter(previous);
 const cats=new Map(data.categories.filter(c=>c.groupId===groupId).map(c=>[c.id,c]));
 const total=sum(current.map(t=>t.amount)), prior=sum(before.map(t=>t.amount));
 const ids=new Set([...current,...before].map(t=>t.categoryId));
 const increases=[...ids].map(id=>{const c=cats.get(id);const now=sum(current.filter(t=>t.categoryId===id).map(t=>t.amount)),last=sum(before.filter(t=>t.categoryId===id).map(t=>t.amount));return {id,name:c?.name||'出張差額',bucket:c?.bucket||'trip',current:now,previous:last,difference:now-last,percent:last?Math.round((now-last)/last*100):null};}).filter(c=>c.difference>0).sort((a,b)=>b.difference-a.difference);
 const hasBaseline=data.transactions.some(t=>t.groupId===groupId&&t.type==='expense'&&monthOf(t.date)===previous&&t.date<=end(previous))||before.length>0;
 const first=increases[0];
 let advice='前月の記録がそろうと、増えた項目を比較できます。';
 if(hasBaseline && !first)advice='前月より増えた項目はありません。今のペースを目安にしましょう。';
 else if(hasBaseline && first){
 const hint={fixed:'契約や請求額が変わっていないか確認してみましょう。',free:`同じ水準を目指すなら、次の同じ期間の目安は${yen(first.previous)}円。大きな買い物があったか振り返ってみましょう。`,saving:'貯蓄への積立が増えています。使いすぎとは分けて考えて大丈夫です。',trip:'出張の支給額と実費、帰着日を確認してみましょう。'};
 advice=`${first.name}が${yen(first.difference)}円増えています。${hint[first.bucket]||hint.free}`;
 }
 return {previous,month,currentEnd:end(month),previousEnd:end(previous),partial,total,prior,difference:total-prior,percent:prior?Math.round((total-prior)/prior*100):null,hasBaseline,increases,advice,future:month>currentMonth};
}
