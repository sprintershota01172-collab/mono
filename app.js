import { bindGroupSwipe } from './gestures.js';
import {
  PALETTE,
  MAX_MONEY,
  VERSION,
  id,
  sum,
  yen,
  today,
  monthOf,
  moveMonth,
  validDate,
  nights,
  tripDays,
  tripAmounts,
  graphData,
  spendingAdvice,
  allowance,
  expenseOfTrip,
  tripNet,
  makeGroup,
  makeCategories,
  householdRows,
  summary,
  proposeBudget,
  backupJSON,
  backupCSV,
  restoreData,
} from "./core.js";
import { initialize, loadData, saveData } from "./db.js";
import { icon, ICON_CHOICES } from "./icons.js";
import {refreshBooks, resetBooks, fade} from "./folio.js";
import {illustration} from "./visuals.js";
import {seedPhotoBudget,makePhotoBudget} from "./preset.js";
const $ = (s) => document.querySelector(s);
const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const amount = (n) => `¥${yen(n)}`;
let data,
  page = "home",
  month = monthOf(today()),
  historyView = "list",
  historyFilter = "all",
  selectedDate = null,
  budgetDraft = null,
  budgetTouched = false,
  entry = null,
  categoryPage = 0,
  pendingRestore = null,
  busy = false,
  toastTimer,
  installPrompt = null,
  offlineReady = false,
  restoreFocus = null;
const pageNumbers={history:0,budget:0,trips:0,categories:0,tripRows:0,groups:0,homeBudget:0,graphCategories:0};
let homeSection='quick', budgetEditing=false;
const quick={amount:'',categoryId:'',type:'expense'};
let settingsSection='general', categoryKind='expense', graphKind='trend', graphMonths=6, graphSelected=null, currentTripDetail=null;
function pageItems(items,key,size){const max=Math.max(0,Math.ceil(items.length/size)-1);pageNumbers[key]=Math.min(Math.max(0,pageNumbers[key]||0),max);return items.slice(pageNumbers[key]*size,(pageNumbers[key]+1)*size);}
function pager(key,total,size){const pages=Math.ceil(total/size);if(pages<=1)return '';return `<div class="pager" aria-label="ページ切替"><button class="btn outline" data-action="page-step" data-page-key="${key}" data-step="-1" ${!pageNumbers[key]?'disabled':''}>${icon('back')} 前へ</button><span>${pageNumbers[key]+1} / ${pages}<small>${total}件</small></span><button class="btn outline" data-action="page-step" data-page-key="${key}" data-step="1" ${pageNumbers[key]>=pages-1?'disabled':''}>次へ ${icon('chevron')}</button></div>`;}
function budgetControls(){const entries=Object.entries(budgetDraft.allocations);return pageItems(entries,'budget',4).map(([cid,n])=>budgetControl(cid,n,budgetDraft.limit)+(budgetDraft.mode==='manual'?`<button class="text-btn budget-remove" data-action="budget-remove-item" data-id="${cid}" aria-label="${e(category(cid)?.name)}を予算から外す">予算から外す</button>`:'')).join('')+pager('budget',entries.length,4);}
const sheet = $("#sheet");
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("kotori-budget-changes")
    : null;
const group = () =>
  data.groups.find((g) => g.id === data.settings[0].activeGroup) ||
  data.groups[0];
const category = (cid) => data.categories.find((c) => c.id === cid);
const categories = (type, includeHidden = false) =>
  data.categories
    .filter(
      (c) =>
        c.groupId === group().id &&
        (!type || c.type === type) &&
        !c.archived &&
        (includeHidden || !c.hidden),
    )
    .sort((a, b) => a.order - b.order);
const tripById = (tid) => data.trips.find((t) => t.id === tid);
const setting = () => data.settings[0];
const activeBudget = () =>
  data.budgets.find((b) => b.groupId === group().id && b.month === month);
function toast(message, undo, label = "元に戻す") {
  clearTimeout(toastTimer);
  $("#toast").innerHTML =
    `${e(message)}${undo ? `<button type="button" id="undo-button">${e(label)}</button>` : ""}`;
  $("#toast").classList.add("show");
  if (undo)
    $("#undo-button").onclick = async () => {
      await undo();
      $("#toast").classList.remove("show");
    };
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("show"),
    undo ? 8000 : 4200,
  );
}
function formError(message) {
  const node = sheet.querySelector(".form-error");
  if (node) node.textContent = message;
  toast(message);
}
async function mutate(fn, opts = {}) {
  if (busy) return false;
  busy = true;
  try {
    const next = structuredClone(data);
    fn(next);
    await saveData(next, setting().revision || 0);
    data = next;
    channel?.postMessage("changed");
    if (opts.render !== false) render();
    return true;
  } catch (err) {
    toast(err.message || "保存できませんでした。空き容量をご確認ください。");
    try {
      data = await loadData();
      if (opts.render !== false) render();
    } catch {}
    return false;
  } finally {
    busy = false;
  }
}
function setTheme() {
  const theme = setting().theme;
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light"
      : theme;
  const dark = document.documentElement.dataset.theme === "dark";
  document.documentElement.style.setProperty(
    "--accent",
    accessibleColor(group().color, dark),
  );
  document.documentElement.style.setProperty(
    "--accent-soft",
    dark ? "#33473d" : `${group().color}12`,
  );
  $("meta[name=theme-color]").content = dark ? "#141e2a" : "#f3f0e9";
}
function accessibleColor(hex, dark = false) {
  let rgb = [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
  if (dark) rgb = rgb.map((n) => Math.round(n * 0.35 + 165));
  else {
    const luminance = () =>
      rgb
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((s, n, i) => s + n * [0.2126, 0.7152, 0.0722][i], 0);
    while (luminance() > 0.18) rgb = rgb.map((n) => Math.floor(n * 0.92));
  }
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
}
function navHTML(desktop = false) {
  const links = [
    ["home", "home", "ホーム"],
    ["history", "history", "履歴"],
    ["entry", "plus", "入力"],
    ["budget", "pie", "予算"],
    ["trips", "suitcase", "出張"],
  ];
  return links
    .map(
      ([key, ico, label]) =>
        `<button class="nav-item ${key === "entry" ? "add-nav" : ""} ${page === key ? "active" : ""}" data-nav="${key}" ${page === key ? 'aria-current="page"' : ""} aria-label="${key === "entry" ? "収支を入力" : label}">${icon(ico)}<span>${key === "entry" && desktop ? "入力" : label}</span></button>`,
    )
    .join("");
}
function render() {
  if (!data) return;
  setTheme();
  $("#brand-icon").innerHTML = '<span class="mono-mark">m.</span>';
  $("#settings-button").innerHTML = icon("settings");
  $("#add-group").innerHTML = icon("plus");
  $("#desktop-nav").innerHTML = navHTML(true);
  $("#bottom-nav").innerHTML = navHTML();
  const sortedGroups=[...data.groups].sort((a,b)=>a.order-b.order);
  const groupStart=Math.floor(sortedGroups.findIndex(g=>g.id===group().id)/2)*2;
  const firstGroups=sortedGroups.length>3?sortedGroups.slice(groupStart,groupStart+2):sortedGroups;
  $('#groups').style.setProperty('--group-columns',Math.min(3,sortedGroups.length));
  $("#groups").innerHTML=firstGroups.map(g=>`<button role="tab" class="group-tab" data-group="${g.id}" aria-selected="${g.id===group().id}" style="--group-color:${g.color}"><span class="group-dot"></span>${e(g.name)}</button>`).join('')+(sortedGroups.length>3?`<select id="group-select" aria-label="すべてのグループ">${sortedGroups.map(g=>`<option value="${g.id}" ${g.id===group().id?'selected':''}>${e(g.name)}</option>`).join('')}</select>`:'');
  const views = {
    home: renderHome,
    history: renderHistory,
    budget: renderBudget,
    trips: renderTrips,
    settings: renderSettings,
    categories: renderCategories,
    graphs: renderGraphs,
  };
  $("#main").innerHTML =
    `<div id="main-viewport" class="folio-viewport"><div class="page">${(views[page] || renderHome)()}</div></div><nav id="main-folio" class="folio-nav" aria-label="画面のページ切替"></nav>`;
  if((page==='home'&&homeSection!=='quick')||page==='graphs')$('#main').insertAdjacentHTML('afterbegin',`<div class="return-bar"><button class="btn outline" data-action="return-input">${icon('back')} 入力に戻る</button></div>`);
  $('#main').classList.toggle('fixed-overview',page==='budget'&&!budgetEditing);
  $('#main').classList.toggle('quick-home',page==='home'&&homeSection==='quick');
  if(page==='budget'&&budgetEditing){$('#main .page').insertAdjacentHTML('afterbegin','<button class="text-btn" data-action="budget-overview">‹ 一覧に戻る</button>');}
  if(page==='budget'&&budgetEditing&&budgetDraft?.mode!=='manual')$('#main .page').insertAdjacentHTML('beforeend','<div class="budget-mode-links"><button class="text-btn" data-action="budget-manual">金額を自由に設定する</button><button class="text-btn" data-action="budget-photo">画像の25万円予算を使う</button></div>');
  if (page === "budget") updateBudgetUI();
  updateStatus();
  refreshBooks();
  fade($("#main .page"));
}
function updateStatus() {
  $("#local-status").textContent = !navigator.onLine
    ? "オフライン"
    : offlineReady
      ? "オフライン準備完了"
      : "端末に保存";
}
function navigate(next) {
  if (next === "entry") {
    openEntry();
    return;
  }
  resetBooks();
  budgetEditing=false;
  if(next==='home')homeSection='quick';
  page = next;
  for(const key of Object.keys(pageNumbers))pageNumbers[key]=0;
  graphSelected=null;
  selectedDate = null;
  budgetDraft = null;
  history.replaceState(null, "", `#${next}`);
  render();

}
function monthSwitch() {
  const [y, m] = month.split("-");
  return `<div class="month-switch"><button class="icon-btn" data-action="month-prev" aria-label="前の月">${icon("back")}</button><span>${y}年 ${Number(m)}月</span><button class="icon-btn" data-action="month-next" aria-label="次の月">${icon("chevron")}</button></div>`;
}
function header(title, en, extra = "") {
  return `<div class="page-header"><h1>${title}</h1>${extra || monthSwitch()}</div>`;
}
function empty(ico, title, copy, button = "") {
  return `<div class="empty">${illustration(ico==="suitcase"?"journey":ico==="leaf"?"grow":"nest")}<h3>${title}</h3><p>${copy}</p>${button}</div>`;
}
function btn(text, action, cls = "primary", extra = "") {
  return `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
}
function catIcon(c) {
  return `<span class="category-icon" style="--cat-color:${c?.color || group().color}">${icon(c?.icon || "suitcase")}</span>`;
}
function rowHTML(t, withActions = false) {
  const c = category(t.categoryId);
  const trip = t.tripId && tripById(t.tripId);
  const title = t.synthetic
    ? group().tripMode === "net"
      ? "出張の差額"
      : "出張の支給額"
    : c?.name || "項目なし";
  const meta = [
    t.synthetic ? trip?.name : t.memo,
    trip && !t.synthetic ? trip.name : null,
    t.advance ? (t.settled ? "精算済" : "未精算") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = `<button class="entry-row ${withActions ? "editable-row" : ""}" data-action="${t.synthetic ? "trip-detail" : "edit-entry"}" data-id="${t.synthetic ? t.tripId : t.id}">${catIcon(c)}<span class="entry-info"><span class="entry-title">${e(title)}</span><span class="entry-meta">${e(meta || t.date.replaceAll("-", "."))}</span></span><span class="entry-amount number ${t.type === "income" ? "income-text" : ""}">${t.type === "income" ? "+" : "−"}${amount(t.amount)}</span>${withActions ? icon("edit", "row-edit-icon") : ""}</button>`;
  return withActions
    ? `<div class="history-record">${body}<button class="icon-btn row-delete" data-action="delete-entry" data-id="${t.id}" aria-label="${e(title)} ${amount(t.amount)}の記録を削除">${icon("trash")}</button></div>`
    : body;
}
function saveAmountLabel(value,editing=false){return Number(value)?`${yen(Number(value))}円を${editing?'保存':'記録'}`:'金額を入力';}
function updateQuick(){
 if(!$('#quick-amount'))return;
 $('#quick-amount').textContent=amount(Number(quick.amount)||0);
 $('#quick-save').disabled=!Number(quick.amount)||!quick.categoryId;
 $('#quick-save').textContent=saveAmountLabel(quick.amount);
 $('#quick-amount').classList.toggle('long-amount',Number(quick.amount)>=1000000);
 const badge=$('#quick-selected-icon'),selected=category(quick.categoryId);
 if(badge){badge.innerHTML=selected?catIcon(selected):icon('dots');}
 document.querySelectorAll('[data-action="quick-category"]').forEach(b=>{b.classList.toggle('selected',b.dataset.id===quick.categoryId);b.setAttribute('aria-pressed',String(b.dataset.id===quick.categoryId));});
}
function recentQuick(){
 const valid=new Set(categories(quick.type).map(c=>c.id)),seen=new Set();
 return data.transactions.filter(t=>t.groupId===group().id&&t.type===quick.type&&!t.tripId&&valid.has(t.categoryId)).sort((a,b)=>(b.createdAt||b.date).localeCompare(a.createdAt||a.date)).filter(t=>{const key=t.categoryId+':'+t.amount;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,2);
}
function quickShortcuts(){
 const recent=recentQuick();
 return recent.length?`<div class="quick-repeat" aria-label="最近の入力を呼び出す">${recent.map(t=>`<button data-action="quick-repeat" data-id="${t.id}" aria-label="${e(category(t.categoryId).name)} ${amount(t.amount)}を入力欄にセット">${icon(category(t.categoryId).icon)}<span>${e(category(t.categoryId).name)}</span><b class="number">${amount(t.amount)}</b></button>`).join('')}</div>`:'';
}
function renderQuick(){
 const cats=categories(quick.type);
 if(!cats.some(c=>c.id===quick.categoryId))quick.categoryId=recentQuick()[0]?.categoryId||'';
 const common=cats.slice(0,10),rest=cats.slice(10);
 return `<div class="quick-top"><div class="segmented"><button data-action="quick-type" data-type="expense" class="${quick.type==='expense'?'selected':''}">支出</button><button data-action="quick-type" data-type="income" class="${quick.type==='income'?'selected':''}">収入</button></div><button class="text-btn" data-action="home-section" data-section="overview">今月の集計 ${icon('chevron')}</button></div><div class="quick-amount-row"><div class="quick-amount number ${Number(quick.amount)>=1000000?'long-amount':''}" id="quick-amount" aria-live="polite">${amount(Number(quick.amount)||0)}</div>${rest.length?`<div class="quick-other-line"><span id="quick-selected-icon" aria-hidden="true"></span><select id="quick-other" aria-label="その他の項目"><option value="">その他の項目</option>${rest.map(c=>`<option value="${c.id}" ${quick.categoryId===c.id?'selected':''}>${e(c.name)}</option>`).join('')}</select></div>`:''}</div><div class="quick-categories">${common.map(c=>`<button data-action="quick-category" data-id="${c.id}" class="${quick.categoryId===c.id?'selected':''}" aria-pressed="${quick.categoryId===c.id}" style="--cat-color:${c.color};--cat-ink:${accessibleColor(c.color,document.documentElement.dataset.theme==='dark')}">${icon(c.icon)}<span>${e(c.name)}</span></button>`).join('')}</div><div class="quick-keypad">${['1','2','3','back','4','5','6','00','7','8','9','0'].map(k=>`<button data-action="quick-key" data-value="${k}" aria-label="${k==='back'?'1桁消す':k}">${k==='back'?'⌫':k}</button>`).join('')}</div><div class="quick-bottom"><button class="text-btn" data-action="quick-details">${today().slice(5).replace('-','/')}・詳細</button><button id="quick-save" class="btn primary" data-action="quick-save" ${!Number(quick.amount)||!quick.categoryId?'disabled':''}>${saveAmountLabel(quick.amount)}</button></div><div class="quick-reuse" id="quick-reuse">${quickShortcuts()}</div>`;
}
function renderBudgetOverview(b){
 const rows=householdRows(data,group().id,month),entries=Object.entries(b.allocations);
 const spent=sum(rows.filter(t=>t.type==='expense').map(t=>t.amount));
 return `<div class="budget-overview"><div class="budget-overview-heading"><h1>予算</h1>${monthSwitch()}<button class="text-btn" data-action="budget-edit">編集</button></div><div class="budget-overview-total"><span>合計 <b class="number">${amount(b.limit)}</b></span><span>支出 <b class="number">${amount(spent)}</b></span></div><div class="budget-all-grid" style="--budget-rows:${Math.max(1,Math.ceil(entries.length/2))}">${entries.map(([cid,limit])=>{const c=category(cid),used=sum(rows.filter(t=>t.type==='expense'&&t.categoryId===cid).map(t=>t.amount)),left=limit-used;return `<div class="budget-mini"><div class="budget-mini-name"><span class="budget-mini-icon" style="--cat-color:${c?.color||'#788aba'};color:${accessibleColor(c?.color||'#788aba',document.documentElement.dataset.theme==='dark')}">${icon(c?.icon||'dots')}</span>${e(c?.name||'項目')}</div><div class="budget-mini-numbers"><b class="number">${amount(limit)}</b><span class="${left<0?'over-text':''}">残 ${amount(left)}</span></div><div class="bar"><span style="width:${limit?Math.min(100,used/limit*100):used?100:0}%;background:${c?.color||'#788aba'}"></span></div></div>`;}).join('')}</div>${entries.length?'':'<p class="small">編集から予算を設定できます。</p>'}</div>`;
}
function renderHome() {
 if(homeSection==='quick')return renderQuick();
 const rows=householdRows(data,group().id,month),totals=summary(rows),budget=activeBudget();
 const tabs=`<div class="segmented home-tabs">${[['overview','今月'],['plan','予算'],['advice','アドバイス']].map(([key,label])=>`<button data-action="home-section" data-section="${key}" class="${homeSection===key?'selected':''}">${label}</button>`).join('')}</div>`;
 let body='';
 if(homeSection==='overview')body=`<section class="card hero"><div class="hero-top"><div><p class="hero-label">${Number(month.slice(5))}月の残り</p><div class="hero-balance number">${amount(totals.balance)}</div><p class="small">収入 − 支出</p></div>${illustration('nest')}</div><div class="hero-totals"><div class="mini-total"><div><small>収入</small><span class="number">${amount(totals.income)}</span></div></div><div class="mini-total"><div><small>支出</small><span class="number">${amount(totals.expense)}</span></div></div></div></section><button class="card graph-link" data-nav="graphs">${icon('pie')}<span>グラフを見る<small>月別収支・項目別の割合</small></span>${icon('chevron')}</button><section class="card home-recent"><div class="section-line"><h2>最近の記録</h2><button class="text-btn" data-nav="history">すべて見る</button></div>${rows.length?rows.slice(0,2).map(t=>rowHTML(t)).join(''):empty('history','記録なし','')}</section>`;
 else if(homeSection==='plan')body=`<div class="chapter-art">${illustration('grow')}<div><h2>予算</h2><p class="small"></p></div></div><section class="card home-budget"><div class="section-line"><h2>予算</h2><button class="text-btn" data-nav="budget">予算へ ${icon('chevron')}</button></div>${budget?renderBudgetBars(budget,rows):empty('leaf','予算未設定','',btn('予算をつくる','go-budget','secondary'))}</section>`;
 else body=renderAdvice();
 return `${header('今月の家計','MONO / MONTHLY OVERVIEW')}${tabs}<div class="home-chapter">${body}</div>`;
}
function renderAdvice(){
 const report=spendingAdvice(data,group().id,month);
 const period=`${report.month.replace('-','/')}月1日〜${Number(report.currentEnd.slice(8))}日 と ${report.previous.replace('-','/')}月1日〜${Number(report.previousEnd.slice(8))}日`;
 if(report.future)return `<section class="card advice-card">${illustration('tea')}<h2>この月は、これから。</h2><p>過去の月か今月を選ぶと、支出の変化を確認できます。</p></section>`;
 return `<section class="card advice-card"><div class="chapter-art">${illustration('tea')}<div><span class="eyebrow"></span><h2>前月との比較</h2></div></div><p class="comparison-period">${e(period)}</p><div class="comparison-values"><div><small>今回の支出</small><b class="number">${amount(report.total)}</b></div><div><small>前月の支出</small><b class="number">${report.hasBaseline?amount(report.prior):'記録なし'}</b></div></div><p class="advice-delta">${report.hasBaseline?`${report.difference>0?'＋':report.difference<0?'−':''}${amount(Math.abs(report.difference))}${report.percent!==null?` <span>（${report.percent>0?'+':''}${report.percent}%）</span>`:''}`:'比較する記録を待っています'}</p><p class="advice-copy">${e(report.advice)}</p><p class="small">記録済みの支出から計算。未入力の分や買い物の事情は判断していません。</p></section>${report.hasBaseline&&report.increases.length?`<section class="card"><h2>前月より増えた項目</h2>${report.increases.map(c=>`<div class="increase-row"><span>${e(c.name)}<small>${amount(c.previous)} → ${amount(c.current)}</small></span><b class="number">＋${amount(c.difference)}<small>${c.percent===null?'前月0円':`＋${c.percent}%`}</small></b></div>`).join('')}</section>`:''}`;
}
function renderBudgetBars(b, rows) {
  const entries = Object.entries(b.allocations);
  if (!entries.length)
    return empty(
      "leaf",
      "自由費の項目がありません",
      "設定から項目を追加できます。",
    );
  const items = entries
    .map(([cid, limit]) => {
      const c = category(cid);
      const used = sum(
        rows
          .filter((t) => t.type === "expense" && t.categoryId === cid)
          .map((t) => t.amount),
      );
      const remaining = limit - used;
      const pct = limit ? Math.min(100, (used / limit) * 100) : used ? 100 : 0;
      return `<div class="budget-item"><div class="budget-label"><span>${e(c?.name || "項目")}</span><span class="number ${remaining < 0 ? "over-text" : ""}">${remaining < 0 ? `${amount(-remaining)} 超過` : `残り ${amount(remaining)}`}</span></div><div class="bar ${remaining < 0 ? "over" : ""}" role="meter" aria-label="${e(c?.name)}の使用額" aria-valuemin="0" aria-valuemax="${Math.max(limit, used, 1)}" aria-valuenow="${used}"><span style="width:${pct}%"></span></div><div class="budget-foot"><span>${amount(used)} 使用</span><span>予算 ${amount(limit)}</span></div></div>`;
    });
  return pageItems(items,"homeBudget",3).join("")+pager("homeBudget",items.length,3);
}
function renderChart(rows) {
  const expenses = rows.filter((t) => t.type === "expense");
  const total = sum(expenses.map((t) => t.amount));
  if (!total)
    return empty(
      "pie",
      "記録なし",
      "支出を記録すると、ここに内訳が見えます。",
    );
  const grouped = {};
  for (const t of expenses)
    grouped[t.categoryId] = (grouped[t.categoryId] || 0) + t.amount;
  const parts = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  let angle = 0;
  const stops = parts.map(([cid, n]) => {
    const color = category(cid)?.color || group().color;
    const from = angle;
    angle += (n / total) * 100;
    return `${color} ${from}% ${angle}%`;
  });
  return `<div class="expense-chart"><div class="donut" style="background:conic-gradient(${stops.join(",")})" role="img" aria-label="支出合計 ${amount(total)}。項目別の内訳は右の一覧"><div class="donut-center"><span>今月の支出</span><span class="number">${amount(total)}</span></div></div><div class="legend">${parts.map(([cid, n]) => `<div class="legend-row"><span class="group-dot" style="--group-color:${category(cid)?.color || group().color}"></span><span class="legend-name">${e(category(cid)?.name || "出張差額")}</span><span class="number">${amount(n)}</span></div>`).join("")}</div></div>`;
}
function renderGraphs(){
 const result=graphData(data,group().id,month,graphMonths);
 const selected=result.trend.find(x=>x.month===graphSelected)||result.trend.at(-1);
 const modes=[['trend','月別収支'],['category','項目別'],['buckets','固定・自由']];
 const tabs=`<div class="segmented graph-tabs">${modes.map(([key,label])=>`<button data-action="graph-kind" data-kind="${key}" class="${graphKind===key?'selected':''}">${label}</button>`).join('')}</div>`;
 let body='';
 if(graphKind==='trend'){
  const max=Math.max(...result.trend.flatMap(x=>[x.income,x.expense]),1);
  body=`<div class="section-line"><span class="small">${result.trend[0].month.replace('-','.')} 〜 ${month.replace('-','.')}</span><div class="segmented"><button data-action="graph-range" data-months="3" class="${graphMonths===3?'selected':''}">3か月</button><button data-action="graph-range" data-months="6" class="${graphMonths===6?'selected':''}">6か月</button></div></div><div class="chart-legend"><span><i class="income-dot"></i>収入</span><span><i class="expense-dot"></i>支出</span><small>最大 ${amount(max===1?0:max)}</small></div><div class="monthly-bars" style="--months:${graphMonths}">${result.trend.map(x=>`<button class="month-bar ${selected.month===x.month?'selected':''}" data-action="graph-month" data-month="${x.month}" aria-label="${x.month} 収入${amount(x.income)} 支出${amount(x.expense)} 残り${amount(x.balance)}"><span class="bar-pair"><span class="income-bar" style="height:${x.income/max*100}%"></span><span class="expense-bar" style="height:${x.expense/max*100}%"></span></span><span>${Number(x.month.slice(5))}月</span></button>`).join('')}</div><p class="small chart-hint">月をタップして金額を確認</p><div class="graph-month-detail"><span>${selected.month.replace('-','年 ')}月</span><div class="graph-totals"><div><small>収入</small><b class="number income-text">${amount(selected.income)}</b></div><div><small>支出</small><b class="number">${amount(selected.expense)}</b></div><div><small>残り</small><b class="number ${selected.balance<0?'over-text':''}">${amount(selected.balance)}</b></div></div></div>`;
 }else if(graphKind==='category'){
  let angle=0;const stops=result.categories.map(c=>{const before=angle;angle+=c.amount/result.total*100;return `${c.color} ${before}% ${angle}%`;});
  body=result.total?`<div class="graph-category-summary"><div class="donut" style="background:conic-gradient(${stops.join(',')})" role="img" aria-label="${Number(month.slice(5))}月の項目別支出。合計${amount(result.total)}"><div class="donut-center"><span>支出合計</span><span class="number">${amount(result.total)}</span></div></div><p class="small">支出の割合<br>項目ごとの金額は下の一覧へ</p></div><div class="chart-category-list">${pageItems(result.categories,'graphCategories',4).map(c=>`<div class="chart-category"><div><span><i style="background:${c.color}"></i>${e(c.name)}</span><b class="number">${amount(c.amount)} <small>${Math.round(c.amount/result.total*100)}%</small></b></div><div class="bar"><span style="width:${c.amount/result.total*100}%;background:${c.color}"></span></div></div>`).join('')}</div>${pager('graphCategories',result.categories.length,4)}`:empty('pie','まだ支出の記録がありません','記録するとグラフが表示されます。',btn('記録する','new-entry','secondary'));
 }else{
  const defs=[['fixed','固定費','#6790A5'],['free','自由費','#668C83'],['saving','貯蓄','#B19449'],['trip','出張差額','#AA7A93']];
  body=`<div class="graph-total"><small>この月の支出</small><b class="number">${amount(result.total)}</b></div>${defs.filter(([key])=>key!=='trip'||result.buckets.trip).map(([key,label,color])=>`<div class="bucket-chart"><div><span>${label}</span><b class="number">${amount(result.buckets[key])}</b></div><div class="bar"><span style="width:${result.total?result.buckets[key]/result.total*100:0}%;background:${color}"></span></div><small>${result.total?Math.round(result.buckets[key]/result.total*100):0}%</small></div>`).join('')}<p class="small">項目に設定した区分で集計。貯蓄は支出扱いです。</p>`;
 }
 return `${header('家計をグラフで','YOUR MONEY AT A GLANCE')}<div class="graph-topline">${tabs}<button class="icon-btn" data-nav="home" aria-label="ホームに戻る">${icon('home')}</button></div><section class="card graph-card">${body}</section><p class="small chart-hint">${e(group().name)} · ${group().tripMode==='net'?'出張は差額のみ反映':'出張は支給額・実費を全額反映'}</p>`;
}

function rawHistory() {
  return data.transactions
    .filter(
      (t) =>
        t.groupId === group().id &&
        monthOf(t.date) === month &&
        (historyFilter === "all" ||
          (historyFilter === "advance"
            ? t.advance && !t.settled
            : t.type === historyFilter)),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}
function renderHistory() {
  const rows = rawHistory();
  const selected = selectedDate
    ? rows.filter((t) => t.date === selectedDate)
    : rows;
  const totals = summary(rows);
  return `${header("履歴", "YOUR DAILY NOTES")}<div class="toolbar"><div class="segmented"><button data-action="history-list" class="${historyView === "list" ? "selected" : ""}">一覧</button><button data-action="history-calendar" class="${historyView === "calendar" ? "selected" : ""}">カレンダー</button></div><select class="select-compact" id="history-filter" aria-label="履歴の絞り込み">${[
    ["all", "すべて"],
    ["expense", "支出"],
    ["income", "収入"],
    ["advance", "未精算の立替"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${historyFilter === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select></div><section class="card"><div class="mini-analytics"><span>収入 <b class="number income-text">${amount(totals.income)}</b></span><span>支出 <b class="number">${amount(totals.expense)}</b></span><span>${rows.length}件</span></div><p class="small">出張の自動計算はホームに反映。</p>${historyView === "calendar" ? renderCalendar(rows) : ''}${selectedDate ? `<div class="section-line"><h3>${e(selectedDate.replaceAll("-", "."))}</h3><button class="text-btn" data-action="clear-date">全日を表示</button></div>` : ""}${renderDatedRows(pageItems(selected,"history",historyView==="calendar"?2:5))}${pager("history",selected.length,historyView==="calendar"?2:5)}</section>`;
}
function renderDatedRows(rows) {
  if (!rows.length)
    return empty(
      "history",
      "この月の記録はありません",
      "",
    );
  let previous = "";
  return rows
    .map((t) => {
      const heading =
        t.date !== previous
          ? `<div class="list-date">${Number(t.date.slice(5, 7))}月${Number(t.date.slice(8))}日（${"日月火水木金土"[new Date(t.date + "T12:00:00").getDay()]}）</div>`
          : "";
      previous = t.date;
      return heading + rowHTML(t, true);
    })
    .join("");
}
function renderCalendar(rows) {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate(),
    start = new Date(y, m - 1, 1).getDay();
  return `<div class="calendar-scroll"><div class="calendar">${"日月火水木金土"
    .split("")
    .map((d) => `<span class="weekday">${d}</span>`)
    .join("")}${"<span></span>".repeat(start)}${Array.from(
    { length: count },
    (_, i) => {
      const d = `${month}-${String(i + 1).padStart(2, "0")}`;
      const s = summary(rows.filter((t) => t.date === d));
      return `<button class="calendar-day ${d === today() ? "is-today" : ""} ${d === selectedDate ? "selected" : ""}" data-action="select-date" data-date="${d}" aria-label="${i + 1}日 支出${s.expense}円 収入${s.income}円"><span>${i + 1}</span>${s.expense ? `<small>−${yen(s.expense)}</small>` : ""}${s.income ? `<small class="calendar-income">+${yen(s.income)}</small>` : ""}</button>`;
    },
  ).join(
    "",
  )}</div></div><div class="calendar-caption"><span>− 支出</span><span>+ 収入</span></div>`;
}
function renderManualBudget(b){
 const available=categories('expense').filter(c=>!Object.hasOwn(b.allocations,c.id));
 const total=sum(Object.values(b.allocations));
 return `${header('今月の予算','MONTHLY PLAN')}<section class="card manual-summary"><span class="eyebrow"></span><div class="manual-budget-total number">${amount(b.limit)}</div><p class="small"></p><label class="field">月の予算総額<input id="manual-limit" type="number" inputmode="numeric" min="0" max="${MAX_MONEY}" value="${b.limit}"></label></section><section class="card"><div class="section-line"><h2>項目ごとの予算</h2><button class="text-btn" data-nav="categories">項目を管理</button></div><div id="budget-controls">${budgetControls()}</div><div class="budget-add-line"><select id="budget-add-category" aria-label="予算に追加する項目"><option value="">項目を選ぶ</option>${available.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('')}</select><button class="btn outline" data-action="budget-add-item">追加</button></div><div id="budget-warning" class="warning" ${total>b.limit?'':'hidden'}>合計が予算総額を超えています。金額または総額を調整してください。</div></section><div class="sticky-save"><div><small>未配分</small><span class="number" id="budget-remaining">${amount(b.limit-total)}</span></div><button id="save-budget" class="btn primary" data-action="save-budget">変更を保存</button></div><div class="budget-mode-links"><button class="text-btn" data-action="budget-auto">給与から自動提案する</button><button class="text-btn" data-action="budget-photo">画像の初期予算に戻す</button></div>`;
}
function renderBudget() {
  const saved = activeBudget();
  if (!budgetDraft) {
    budgetDraft = structuredClone(
      saved || proposeBudget(data, group().id, month),
    );
    budgetTouched = !!saved;
  }
  const b = budgetDraft;
  if(!budgetEditing)return renderBudgetOverview(b);
  if(b.mode==='manual')return renderManualBudget(b);
  return `${header("今月の予算", "A LITTLE ROOM TO BREATHE")}<section class="card"><div class="section-line"><h2>${saved ? "予算を見直す" : "予算を設定"}</h2><span class="pill">${saved ? "保存済み" : "提案"}</span></div><div class="budget-form"><label class="field">前月の給与（初月は目安）<input id="budget-salary" type="number" inputmode="numeric" min="0" max="${MAX_MONEY}" value="${b.salary}" aria-label="前月の給与または初月の収入目安 円"></label><label class="field">貯蓄したい割合（%）<input id="budget-rate" type="number" inputmode="numeric" min="0" max="100" step="1" value="${b.savingRate}"></label></div><button class="text-btn" data-action="budget-recalculate">この条件で配分し直す ${icon("chevron")}</button><div class="calculation"><div><small>前月の固定費</small><span id="budget-fixed" class="number">${amount(b.fixed)}</span></div><div><small>貯蓄の目標</small><span id="budget-saving" class="number">${amount(b.savingGoal)}</span></div><div><small>自由費の上限</small><span id="budget-limit" class="number">${amount(b.limit)}</span></div></div><p class="small">${b.hasHistory ? "過去3か月の使い方をもとに配分しています。" : "記録が少ないため、初期の配分をたたき台にしています。"}</p><div id="budget-shortfall" ${b.shortfall ? "" : "hidden"} class="warning">収入が固定費・貯蓄目標を下回っています。金額や割合を見直してください。</div><button type="button" class="text-btn" data-action="toggle-sliders" aria-pressed="false">スライダーで調整</button><div id="budget-controls">${
    budgetControls() ||
    '<p class="warning">自由費の項目を設定から追加・表示してください。</p>'
  }</div><div id="budget-warning" class="warning" ${sum(Object.values(b.allocations)) > b.limit ? "" : "hidden"}>予算の合計が上限を超えています。少し調整しましょう。</div></section><div class="sticky-save"><div><small>まだ配分できるお金</small><span class="number" id="budget-remaining">${amount(b.limit - sum(Object.values(b.allocations)))}</span></div><button class="btn primary" id="save-budget" data-action="save-budget" ${sum(Object.values(b.allocations)) > b.limit ? "disabled" : ""}>この予算で決定 ${icon("check")}</button></div>`;
}
function budgetControl(cid, n, limit) {
  const c = category(cid);
  return `<div class="budget-control"><div class="budget-control-head"><label for="budget-num-${cid}">${icon(c?.icon || "dots")}${e(c?.name)}</label><div class="money-stepper"><button class="icon-btn" data-action="budget-step" data-id="${cid}" data-delta="-1000" aria-label="${e(c?.name)}を1000円減らす">${icon("minus")}</button><input id="budget-num-${cid}" class="budget-number" data-id="${cid}" type="number" inputmode="numeric" min="0" max="${MAX_MONEY}" step="1" value="${n}" aria-label="${e(c?.name)}の予算 円"><button class="icon-btn" data-action="budget-step" data-id="${cid}" data-delta="1000" aria-label="${e(c?.name)}を1000円増やす">${icon("plus")}</button></div></div><input type="range" class="budget-range" data-id="${cid}" min="0" max="${Math.max(limit, n, 1000)}" step="1" value="${n}" aria-label="${e(c?.name)}の予算を調整"></div>`;
}
function updateBudgetUI() {
  if(!$('#budget-remaining'))return;
  const b = budgetDraft;
  if (!b) return;
  const remaining = b.limit - sum(Object.values(b.allocations));
  $("#budget-remaining").textContent = amount(remaining);
  $("#budget-remaining").classList.toggle("over-text", remaining < 0);
  $("#budget-warning").hidden = remaining >= 0;
  if(b.mode==='manual'){
    $('#save-budget').disabled=remaining<0||!Object.keys(b.allocations).length;
    return;
  }
  $("#save-budget").disabled =
    remaining < 0 || b.salary === 0 || !Object.keys(b.allocations).length;
  $("#budget-fixed").textContent = amount(b.fixed);
  $("#budget-saving").textContent = amount(b.savingGoal);
  $("#budget-limit").textContent = amount(b.limit);
  $("#budget-shortfall").hidden = !b.shortfall;
}
function updateBudgetAmount(cid, value) {
  budgetTouched = true;
  budgetDraft.allocations[cid] = Math.min(
    MAX_MONEY,
    Math.max(0, Math.round(Number(value) || 0)),
  );
  const num = $(`#budget-num-${cid}`);
  const range = $(`.budget-range[data-id="${cid}"]`);
  if (num && document.activeElement !== num)
    num.value = budgetDraft.allocations[cid];
  if (range) {
    range.max = Math.max(budgetDraft.limit, budgetDraft.allocations[cid], 1000);
    range.value = budgetDraft.allocations[cid];
  }
  updateBudgetUI();
}
function changeBudgetBase() {
  if(budgetDraft?.mode==='manual'){
    const input=$('#manual-limit');
    if(input)budgetDraft.limit=Math.min(MAX_MONEY,Math.max(0,Math.round(Number(input.value)||0)));
    updateBudgetUI();return;
  }
  const salary = Math.min(
    MAX_MONEY,
    Math.max(0, Math.round(Number($("#budget-salary").value) || 0)),
  );
  const rate = Math.min(
    100,
    Math.max(0, Math.round(Number($("#budget-rate").value) || 0)),
  );
  const updated = proposeBudget(data, group().id, month, salary, rate);
  budgetDraft = {
    ...updated,
    allocations: budgetTouched ? budgetDraft.allocations : updated.allocations,
  };
  if (!budgetTouched)
    $("#budget-controls").innerHTML = budgetControls();
  updateBudgetUI();
}
function renderTrips() {
  const trips = data.trips
    .filter((t) => t.groupId === group().id)
    .sort((a, b) => b.departure.localeCompare(a.departure));
  return `${header("出張", "WORK, TRAVEL & EVERYDAY", btn(`${icon("plus")} 出張を追加`, "new-trip", "secondary"))}<p class="small" style="margin-bottom:18px">家計には${group().tripMode === "net" ? "差額のみ" : "支給額と支出を全額"}反映 · 支給額は帰着月に計上</p>${
    trips.length
      ? pageItems(trips,"trips",2)
          .map((t) => {
            const spent = expenseOfTrip(data, t),
              net = tripNet(data, t);
            const outstanding = sum(
              data.transactions
                .filter((x) => x.tripId === t.id && x.advance && !x.settled)
                .map((x) => x.amount),
            );
            return `<section class="card trip-card"><div class="trip-header"><div><h2>${e(t.name)}</h2><span class="small">${icon("pin")} ${e(t.destination || "行き先未設定")}</span></div><button class="icon-btn" data-action="edit-trip" data-id="${t.id}" aria-label="${e(t.name)}を編集">${icon("edit")}</button></div><p class="trip-meta">${e(t.departure.replaceAll("-", "."))} — ${e(t.returnDate.replaceAll("-", "."))} <span class="pill">${tripDays(t)}日・${nights(t.departure, t.returnDate)}泊</span></p><div class="trip-values"><div><small>支給額</small><span class="number">${amount(allowance(t))}</span></div><div><small>支出</small><span class="number">${amount(spent)}</span></div><div><small>差額</small><span class="number ${net < 0 ? "over-text" : "income-text"}">${amount(net)}</span></div></div><div class="trip-bottom"><span class="small">${outstanding ? `未精算 ${amount(outstanding)}` : "未精算の立替なし"}</span><button class="text-btn" data-action="trip-detail" data-id="${t.id}">記録を見る ${icon("chevron")}</button></div></section>`;
          })
          .join("")
      : `<section class="card">${empty("suitcase", "出張なし", "", btn("出張を追加", "new-trip", "secondary"))}</section>`
  }${pager("trips",trips.length,2)}`;
}
function renderSettings() {
  const g = group();
  const content = `${header("設定", "MAKE YOURSELF AT HOME", `<button class="icon-btn" data-nav="home" aria-label="ホームに戻る">${icon("close")}</button>`)}<section class="card setting-section"><h2>基本設定</h2><button class="setting-row" data-action="manage-groups">${icon("book")}<span class="setting-text">グループ<small>プライベート・家族などを管理</small></span>${icon("chevron")}</button><button class="setting-row" data-nav="categories">${icon("basket")}<span class="setting-text">項目<small>${e(g.name)}の項目・並び順・色</small></span>${icon("chevron")}</button><label class="setting-row">${icon("moon")}<span class="setting-text">見た目</span><select id="theme-setting" aria-label="テーマ">${[
    ["system", "端末に合わせる"],
    ["light", "ライト"],
    ["dark", "ダーク"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${setting().theme === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label></section><section class="card setting-section"><h2>${e(g.name)}の計算ルール</h2><label class="setting-row">${icon("leaf")}<span class="setting-text">貯蓄目標<small>新しく提案する予算に適用</small></span><input id="saving-setting" type="number" min="0" max="100" step="1" inputmode="numeric" value="${g.savingRate}" aria-label="貯蓄目標 パーセント"><span>%</span></label><label class="setting-row">${icon("sun")}<span class="setting-text">日当<small>1日あたり・新しい出張の初期値</small></span><input id="daily-rate-setting" type="number" min="0" max="${MAX_MONEY}" step="1" inputmode="numeric" value="${g.dailyRate}" aria-label="1日あたりの日当 円"><span>円</span></label><label class="setting-row">${icon("suitcase")}<span class="setting-text">宿泊日当<small>1泊あたり・新しい出張の初期値</small></span><input id="lodging-rate-setting" type="number" min="0" max="${MAX_MONEY}" step="1" inputmode="numeric" value="${g.lodgingRate}" aria-label="1泊あたりの宿泊日当 円"><span>円</span></label><label class="setting-row">${icon("wallet")}<span class="setting-text">出張の家計への反映</span><select id="trip-mode-setting" aria-label="出張の反映方法"><option value="net" ${g.tripMode === "net" ? "selected" : ""}>差額のみ反映</option><option value="full" ${g.tripMode === "full" ? "selected" : ""}>全額反映</option></select></label><p class="small">差額のみ：出張支出は家計から除き、支給額−実費を帰着月に反映。全額：支給額を帰着月の収入、実費を記録日の支出に反映。精算状況による追加計上はしません。</p></section><section class="card setting-section"><h2>データを守る</h2><button class="setting-row" data-action="export-json">${icon("download")}<span class="setting-text">JSONでバックアップ<small>全グループ・項目・予算・出張を保存</small></span>${icon("chevron")}</button><button class="setting-row" data-action="export-csv">${icon("download")}<span class="setting-text">CSVでバックアップ<small>表計算ソフトでも開ける全データ形式</small></span>${icon("chevron")}</button><button class="setting-row" data-action="restore">${icon("upload")}<span class="setting-text">バックアップから復元<small>JSON / このアプリで出力したCSV</small></span>${icon("chevron")}</button><p class="small">記録はこの端末・ブラウザだけに保存されます。ブラウザのデータ削除や機種変更に備えて、定期的にバックアップしてください。グループ間・端末間の自動共有はありません。</p></section><section class="card setting-section"><h2>アプリについて</h2><button class="setting-row" data-action="install">${icon("phone")}<span class="setting-text">ホーム画面に追加<small>アプリのように、すぐ開けます</small></span>${icon("chevron")}</button><div class="setting-row">${icon("cloud")}<span class="setting-text">${offlineReady ? "オフラインで使う準備ができました" : "オフライン用の保存を確認中"}<small>初回はオンラインで読み込みを完了してください。</small></span></div><p class="small">MONO 1.9 · フォント：Yomogi / Caveat / SIL OFL</p></section>`;
 const sections=content.match(/<section class="card setting-section">[\s\S]*?<\/section>/g)||[];
 const tabs=[['general','基本'],['rules','出張・予算'],['data','データ'],['app','アプリ']];
 return content.slice(0,content.indexOf('<section'))+`<div class="segmented section-tabs">${tabs.map(([key,label])=>`<button data-action="settings-tab" data-section="${key}" class="${settingsSection===key?'selected':''}">${label}</button>`).join('')}</div>`+sections[Math.max(0,tabs.findIndex(([key])=>key===settingsSection))];
}
function renderCategories() {
  const allRows = categories(categoryKind, true);
  const rows=pageItems(allRows,"categories",5);
  return `${header("項目", "EVERYTHING IN ITS PLACE", `<button class="icon-btn" data-nav="settings" aria-label="設定に戻る">${icon("back")}</button>`)}<div class="segmented section-tabs"><button data-action="category-kind" data-kind="expense" class="${categoryKind==='expense'?'selected':''}">支出</button><button data-action="category-kind" data-kind="income" class="${categoryKind==='income'?'selected':''}">収入</button></div><div class="toolbar"><p class="small">矢印で並べ替え</p>${btn(`${icon("plus")} 追加`, "new-category", "secondary")}</div><section class="card">${[categoryKind]
    .map(
      (type) =>
        `<h2 style="margin:12px 0">${type === "expense" ? "支出の項目" : "収入の項目"}</h2>${rows
          .filter((c) => c.type === type)
          .map(
            (c) =>
              `<div class="category-admin ${c.hidden ? "hidden-item" : ""}">${catIcon(c)}<div class="category-info"><span>${e(c.name)}</span><small>${c.type === "income" ? (c.role === "salary" ? "予算の基準にする給与" : "その他の収入") : { fixed: "固定費", free: "自由費", saving: "貯蓄" }[c.bucket]}${c.hidden ? " · 非表示" : ""}</small></div><div class="category-tools"><button class="icon-btn" data-action="category-up" data-id="${c.id}" aria-label="${e(c.name)}を上へ">${icon("up")}</button><button class="icon-btn" data-action="category-down" data-id="${c.id}" aria-label="${e(c.name)}を下へ">${icon("arrow")}</button><button class="icon-btn" data-action="category-hide" data-id="${c.id}" aria-label="${e(c.name)}を${c.hidden ? "表示" : "非表示"}" aria-pressed="${c.hidden}">${icon("eye")}</button><button class="icon-btn" data-action="edit-category" data-id="${c.id}" aria-label="${e(c.name)}を編集">${icon("edit")}</button></div></div>`,
          )
          .join("")}`,
    )
    .join("")}${pager("categories",allRows.length,5)}</section>`;
}
function showSheet(title, body, cls = "", submit = null) {
  if (!sheet.open) restoreFocus = document.activeElement;
  sheet.className = cls;
  sheet.innerHTML = `<div class="sheet-header"><h2 id="sheet-title">${title}</h2><div class="sheet-header-actions"><button type="button" class="icon-btn" data-action="close-sheet" aria-label="閉じる">${icon("close")}</button></div></div><div id="sheet-viewport" class="folio-viewport"><div class="sheet-body">${body}</div></div><nav id="sheet-folio" class="folio-nav" aria-label="入力画面のページ切替"></nav>`;
  sheet.onsubmit = async (ev) => {
    ev.preventDefault();
    if (submit && !busy) {
      const button = ev.submitter;
      if (button) button.disabled = true;
      try {
        await submit(new FormData(ev.target));
      } catch (err) {
        formError(err.message || "入力内容をご確認ください。");
      } finally {
        if (button?.isConnected) button.disabled = false;
      }
    }
  };
  if (!sheet.open) { resetBooks(); sheet.showModal(); }
  refreshBooks();
  fade(sheet.querySelector(".sheet-body"));
}
function closeSheet() {
  sheet.close();
  sheet.onsubmit = null;
  entry = null;
  categoryPage = 0;
  restoreFocus?.focus?.({ preventScroll: true });
}
function confirmAction(title, copy, onConfirm, requireName = "") {
  showSheet(
    title,
    `<form class="form-stack"><p class="confirm-copy">${copy}</p>${requireName ? `<label class="field">「${e(requireName)}」と入力して確認<input name="name" required autocomplete="off" maxlength="40"></label>` : ""}<div class="form-error" role="alert"></div><div class="sheet-footer">${btn("やめる", "close-sheet", "secondary", 'type="button"')}<button class="btn danger" type="submit">削除する</button></div></form>`,
    "",
    async (f) => {
      if (requireName && f.get("name") !== requireName)
        throw new Error("グループ名が一致しません。");
      await onConfirm();
    },
  );
}
function openEntry(tid = null, tripId = null) {
  const tx = tid && data.transactions.find((t) => t.id === tid);
  entry = tx
    ? {
        ...tx,
        amount: String(tx.amount),
        details: !!(tx.memo || tx.tripId || tx.date !== today()),
      }
    : {
        id: id(),
        groupId: group().id,
        type: "expense",
        amount: "",
        categoryId: "",
        date: today(),
        memo: "",
        tripId: tripId || null,
        advance: false,
        settled: false,
        createdAt: new Date().toISOString(),
        details: !!tripId,
      };
  entry.editing = !!tx;
  categoryPage = 0;
  renderEntry();
}
function syncEntry() {
  if (!entry) return;
  const date = $("#entry-date");
  if (date) entry.date = date.value;
  const memo = $("#entry-memo");
  if (memo) entry.memo = memo.value;
  const trip = $("#entry-trip");
  if (trip) entry.tripId = trip.value || null;
  entry.advance = !!$("#entry-advance")?.checked;
  entry.settled = entry.advance && !!$("#entry-settled")?.checked;
  entry.details = !!sheet.querySelector("details")?.open;
}
function renderEntry() {
  const tx = entry;
  if (!tx) return;
  const counts = {};
  for (const t of data.transactions.filter(
    (t) => t.groupId === group().id && t.type === tx.type,
  ))
    counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
  let cats = categories(tx.type).sort(
    (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.order - b.order,
  );
  const selected = category(tx.categoryId);
  if (selected && !cats.some((c) => c.id === selected.id))
    cats.unshift(selected);
  const pageCount = Math.max(1, Math.ceil(cats.length / 8));
  categoryPage = Math.min(categoryPage, pageCount - 1);
  const visible = cats.slice(categoryPage * 8, categoryPage * 8 + 8);
  const trips = data.trips
    .filter((t) => t.groupId === tx.groupId)
    .sort((a, b) => b.departure.localeCompare(a.departure));
  showSheet(
    tx.editing ? "記録を編集" : "入力",
    `<form id="entry-form"><div class="entry-top"><div class="segmented"><button type="button" data-action="entry-type" data-type="expense" class="${tx.type === "expense" ? "selected" : ""}">支出</button><button type="button" data-action="entry-type" data-type="income" class="${tx.type === "income" ? "selected" : ""}">収入</button></div><button type="button" class="entry-date-button" data-action="entry-details">${tx.date === today() ? "今日" : e(tx.date.slice(5).replace("-", " / "))} ${icon("calendar")}</button></div><div class="amount-entry"><span>¥</span><input id="entry-amount" aria-label="金額。下のテンキーまたはキーボードで入力" value="${yen(Number(tx.amount) || 0)}" readonly inputmode="none"></div><div class="category-caption"><span>項目${selected ? ` · ${e(selected.name)}` : "をえらぶ"}</span>${cats.length > 8 ? `<button type="button" data-action="entry-all" data-pages="${pageCount}">${categoryPage + 1}/${pageCount} · 次の項目</button>` : ""}</div><div class="category-picker">${visible.map((c) => `<button type="button" class="category-pick ${tx.categoryId === c.id ? "selected" : ""}" data-action="entry-category" data-id="${c.id}" aria-pressed="${tx.categoryId === c.id}" style="--cat-color:${c.color}">${icon(c.icon)}<span>${e(c.name)}</span></button>`).join("") || '<p class="small">設定から項目を追加してください。</p>'}</div><div class="keypad" aria-label="金額入力のテンキー">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"].map((k) => `<button type="button" data-key="${k}" class="${k === "back" ? "erase" : ""}" aria-label="${k === "back" ? "1桁消す" : k}">${k === "back" ? "⌫" : k}</button>`).join("")}</div><details class="entry-details" ${tx.details ? "open" : ""}><summary>日付・メモ${tx.type === "expense" ? "・出張" : ""}を追加</summary><div class="form-grid"><label class="field">日付<input id="entry-date" type="date" min="1900-01-01" max="2200-12-31" required value="${e(tx.date)}"></label><label class="field">メモ（任意）<input id="entry-memo" maxlength="300" value="${e(tx.memo)}" placeholder="何に使った？"></label>${tx.type === "expense" ? `<label class="field span-all">出張に紐づける<select id="entry-trip"><option value="">紐づけない</option>${trips.map((t) => `<option value="${t.id}" ${tx.tripId === t.id ? "selected" : ""}>${e(t.name)}（${e(t.departure.slice(5))}〜）</option>`).join("")}</select></label><label class="check-row"><input id="entry-advance" type="checkbox" ${!tx.tripId ? "disabled" : ""} ${tx.advance ? "checked" : ""}>立替のお金</label><label class="check-row"><input id="entry-settled" type="checkbox" ${tx.settled ? "checked" : ""} ${!tx.advance ? "disabled" : ""}>精算済み</label>` : ""}</div></details><div class="form-error" role="alert"></div><button type="submit" class="btn primary entry-save" id="entry-save" ${!tx.categoryId || !Number(tx.amount) ? "disabled" : ""}>${icon("check")} ${saveAmountLabel(tx.amount,tx.editing)}</button>${tx.editing ? `<button type="button" class="text-btn full" style="margin-top:8px" data-action="delete-entry" data-id="${tx.id}">この記録を削除</button>` : ""}</form>`,
    "entry-dialog",
    saveEntry,
  );
}
function enterKey(key) {
  if (!entry) return;
  if (key === "back") entry.amount = entry.amount.slice(0, -1);
  else if (key === "clear") entry.amount = "";
  else if (/^\d{1,2}$/.test(key)) {
    const value = (entry.amount + key).replace(/^0+/, "");
    if (value.length > 9) {
      toast("金額は9桁まで入力できます。");
      return;
    }
    entry.amount = value;
  }
  $("#entry-amount").value = yen(Number(entry.amount) || 0);
  $("#entry-save").disabled = !entry.categoryId || !Number(entry.amount);
  $("#entry-save").textContent = saveAmountLabel(entry.amount,entry.editing);
}
async function saveEntry() {
  syncEntry();
  if (!Number(entry.amount) || !entry.categoryId)
    throw new Error("金額と項目を入力してください。");
  if (!validDate(entry.date)) throw new Error("日付を確認してください。");
  const record = {
    ...entry,
    amount: Number(entry.amount),
    tripId: entry.type === "expense" ? entry.tripId : null,
  };
  delete record.editing;
  delete record.details;
  if (!record.tripId) {
    record.advance = false;
    record.settled = false;
  }
  const editing = entry.editing;
  const ok = await mutate((d) => {
    const i = d.transactions.findIndex((t) => t.id === record.id);
    if (i >= 0) d.transactions[i] = record;
    else d.transactions.push(record);
  });
  if (ok) {
    closeSheet();
    toast(editing ? "記録を更新しました。" : "記録しました");
    navigator.storage?.persist?.().catch(() => {});
  }
}
function deleteEntry(tid) {
  const t = data.transactions.find((x) => x.id === tid);
  if (!t) return;
  confirmAction(
    "この記録を削除しますか？",
    `${e(category(t.categoryId)?.name)} · ${amount(t.amount)}<br>削除後、しばらくは元に戻せます。`,
    async () => {
      if (
        await mutate((d) => {
          d.transactions = d.transactions.filter((x) => x.id !== tid);
        })
      ) {
        closeSheet();
        toast("記録を削除しました。", () =>
          mutate((d) => d.transactions.push(t)),
        );
      }
    },
  );
}
function openGroups() {
  showSheet(
    "グループを管理",
    `${pageItems([...data.groups].sort((a,b)=>a.order-b.order),"groups",5)
      .map(
        (g) =>
          `<button class="setting-row" data-action="edit-group" data-id="${g.id}"><span class="group-dot" style="--group-color:${g.color}"></span><span class="setting-text">${e(g.name)}</span>${icon("edit")}</button>`,
      )
      .join(
        "",
      )}${pager("groups",data.groups.length,5)}<div class="sheet-footer">${btn(`${icon("plus")} グループを追加`, "new-group", "secondary")}</div>`,
  );
}
function editGroup(gid) {
  const g =
    data.groups.find((x) => x.id === gid) ||
    makeGroup(
      "",
      PALETTE[data.groups.length % PALETTE.length],
      data.groups.length,
    );
  const existing = !!gid;
  showSheet(
    existing ? "グループを編集" : "新しいグループ",
    `<form class="form-stack"><label class="field">名前<input name="name" required maxlength="40" value="${e(g.name)}" placeholder="例：プライベート、家族"></label><label class="field">テーマカラー<input type="color" name="color" value="${g.color}" id="group-color"></label><div class="color-swatches">${PALETTE.map((c) => `<button type="button" class="color-choice" data-action="choose-color" data-color="${c}" aria-label="テーマカラー ${c}" style="--swatch:${c}"></button>`).join("")}</div><div class="form-error" role="alert"></div><button type="submit" class="btn primary full">${existing ? "変更を保存" : "グループをつくる"}</button>${existing ? btn("このグループを削除", "delete-group", "danger", `type="button" data-id="${gid}" ${data.groups.length <= 1 ? "disabled" : ""}`) : ""}</form>`,
    "",
    async (f) => {
      const name = String(f.get("name")).trim();
      if (!name) throw new Error("名前を入力してください。");
      const color = String(f.get("color"));
      if (
        await mutate((d) => {
          if (existing)
            Object.assign(
              d.groups.find((x) => x.id === gid),
              { name, color },
            );
          else {
            d.groups.push({ ...g, name, color });
            d.categories.push(...makeCategories(g.id));
            d.settings[0].activeGroup = g.id;
          }
        })
      ) {
        budgetDraft = null;
        closeSheet();
        render();
        toast("グループを保存しました。");
      }
    },
  );
}
function deleteGroup(gid) {
  const g = data.groups.find((x) => x.id === gid);
  if (data.groups.length <= 1) {
    toast("グループは1つ以上必要です。");
    return;
  }
  confirmAction(
    "グループを削除しますか？",
    `「${e(g.name)}」の記録・項目・予算・出張がすべて削除されます。必要なデータは先にバックアップしてください。`,
    async () => {
      if (
        await mutate((d) => {
          for (const key of ["categories", "transactions", "trips", "budgets"])
            d[key] = d[key].filter((x) => x.groupId !== gid);
          d.groups = d.groups.filter((x) => x.id !== gid);
          if (d.settings[0].activeGroup === gid)
            d.settings[0].activeGroup = d.groups[0].id;
        })
      ) {
        budgetDraft = null;
        closeSheet();
        render();
        toast("グループを削除しました。");
      }
    },
    g.name,
  );
}
function editCategory(cid) {
  const found = cid && category(cid);
  const c = found || {
    id: id(),
    groupId: group().id,
    name: "",
    type: "expense",
    bucket: "free",
    role: "other",
    icon: "basket",
    color: group().color,
    weight: 5,
    order: categories(null, true).length,
    hidden: false,
    archived: false,
  };
  const used = found && data.transactions.some((t) => t.categoryId === cid);
  showSheet(
    found ? "項目を編集" : "新しい項目",
    `<form class="form-stack"><label class="field">項目の名前<input name="name" maxlength="30" required value="${e(c.name)}" placeholder="例：カフェ"></label><div class="form-grid"><label class="field">収入・支出<select name="type" id="category-type" ${used ? "disabled" : ""}><option value="expense" ${c.type === "expense" ? "selected" : ""}>支出</option><option value="income" ${c.type === "income" ? "selected" : ""}>収入</option></select></label><label class="field">支出の区分<select name="bucket"><option value="free" ${c.bucket === "free" ? "selected" : ""}>自由費</option><option value="fixed" ${c.bucket === "fixed" ? "selected" : ""}>固定費</option><option value="saving" ${c.bucket === "saving" ? "selected" : ""}>貯蓄</option></select></label></div><label class="check-row"><input type="checkbox" name="salary" ${c.role === "salary" ? "checked" : ""}>収入の場合、予算の基準にする給与</label><div class="field"><span>アイコン</span><input type="hidden" name="icon" id="category-icon-value" value="${c.icon}"><div class="icon-picker">${ICON_CHOICES.map((i) => `<button type="button" class="icon-choice ${i === c.icon ? "selected" : ""}" data-action="choose-icon" data-icon="${i}" aria-label="${i}" aria-pressed="${i === c.icon}">${icon(i)}</button>`).join("")}</div></div><label class="field">色<input type="color" name="color" value="${c.color}"></label><div class="form-error" role="alert"></div><button type="submit" class="btn primary full">保存する</button>${found ? btn("この項目を削除", "delete-category", "danger", `data-id="${cid}" type="button"`) : ""}</form>`,
    "",
    async (f) => {
      const name = String(f.get("name")).trim();
      if (!name) throw new Error("項目の名前を入力してください。");
      const type = used ? c.type : String(f.get("type"));
      if (
        found &&
        type !== c.type &&
        data.budgets.some((b) => Object.hasOwn(b.allocations, cid))
      )
        throw new Error(
          "予算で使っている項目は収支の種類を変更できません。新しい項目を追加してください。",
        );
      const updated = {
        ...c,
        name,
        type,
        bucket: String(f.get("bucket")),
        role: type === "income" && f.get("salary") ? "salary" : "other",
        icon: String(f.get("icon")),
        color: String(f.get("color")),
      };
      if (
        await mutate((d) => {
          const i = d.categories.findIndex((x) => x.id === c.id);
          if (i >= 0) d.categories[i] = updated;
          else d.categories.push(updated);
        })
      ) {
        budgetDraft = null;
        closeSheet();
        toast("項目を保存しました。");
      }
    },
  );
}
function deleteCategory(cid) {
  const c = category(cid);
  const used =
    data.transactions.some((t) => t.categoryId === cid) ||
    data.budgets.some((b) => Object.hasOwn(b.allocations, cid));
  confirmAction(
    "項目を削除しますか？",
    used
      ? "入力候補から削除します。過去の記録と予算には項目名を残します。"
      : `「${e(c.name)}」を削除します。`,
    async () => {
      if (
        await mutate((d) => {
          if (used) {
            const item = d.categories.find((x) => x.id === cid);
            item.archived = true;
            item.hidden = true;
          } else d.categories = d.categories.filter((x) => x.id !== cid);
        })
      ) {
        budgetDraft = null;
        closeSheet();
        toast("項目を削除しました。");
      }
    },
  );
}
async function reorderCategory(cid, delta) {
  const c = category(cid);
  const rows = categories(c.type, true);
  const i = rows.findIndex((x) => x.id === cid),
    j = i + delta;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await mutate((d) =>
    rows.forEach((x, n) => {
      d.categories.find((c) => c.id === x.id).order = n;
    }),
  );
}
function editTrip(tid) {
  const t = tid
    ? tripById(tid)
    : {
        id: id(),
        groupId: group().id,
        name: "",
        destination: "",
        departure: today(),
        returnDate: today(),
        dailyRate: group().dailyRate,
        lodgingRate: group().lodgingRate,
        amountOverride: null,
        createdAt: new Date().toISOString(),
      };
  showSheet(
    tid ? "出張を編集" : "出張を登録",
    `<form class="form-stack" id="trip-form"><div class="form-grid"><label class="field">出張の名前<input name="name" required maxlength="60" value="${e(t.name)}" placeholder="例：福岡出張"></label><label class="field">行き先<input name="destination" maxlength="60" value="${e(t.destination)}" placeholder="例：宮若市"></label></div><div class="form-grid"><label class="field">出発日<input type="date" min="1900-01-01" max="2200-12-31" name="departure" id="trip-departure" required value="${t.departure}"></label><label class="field">帰着日<input type="date" min="1900-01-01" max="2200-12-31" name="returnDate" id="trip-return" required value="${t.returnDate}"></label></div><div class="form-grid"><label class="field">日当（1日・円）<input type="number" inputmode="numeric" name="dailyRate" id="trip-daily-rate" required min="0" max="${MAX_MONEY}" step="1" value="${t.dailyRate}"></label><label class="field">宿泊日当（1泊・円）<input type="number" inputmode="numeric" name="lodgingRate" id="trip-lodging-rate" required min="0" max="${MAX_MONEY}" step="1" value="${t.lodgingRate}"></label></div><div class="trip-breakdown"><div><span id="trip-days">日当 ${tripDays(t)}日分</span><b class="number" id="trip-daily-total">${amount(tripAmounts(t).daily)}</b></div><div><span id="trip-nights">宿泊日当 ${nights(t.departure,t.returnDate)}泊分</span><b class="number" id="trip-lodging-total">${amount(tripAmounts(t).lodging)}</b></div><div><span>自動計算</span><b class="number" id="trip-auto">${amount(tripAmounts(t).total)}</b></div><div><span>支給額</span><b class="number" id="trip-final">${amount(allowance(t))}</b></div></div><label class="field">支給額の上書き（空欄で自動）<input name="amountOverride" id="trip-override" type="number" inputmode="numeric" min="0" max="${MAX_MONEY}" step="1" value="${t.amountOverride ?? ""}" placeholder="自動計算を使う"></label><p class="small">日当は出発・帰着日を含みます。日帰りは1日・0泊。</p><div class="form-error" role="alert"></div><button type="submit" class="btn primary full">保存する</button>${tid ? btn("この出張を削除", "delete-trip", "danger", `type="button" data-id="${tid}"`) : ""}</form>`,
    "",
    async (f) => {
      const next = {
        ...t,
        name: String(f.get("name")).trim(),
        destination: String(f.get("destination")).trim(),
        departure: String(f.get("departure")),
        returnDate: String(f.get("returnDate")),
        dailyRate: Number(f.get("dailyRate")),
        lodgingRate: Number(f.get("lodgingRate")),
        amountOverride:
          String(f.get("amountOverride")).trim() === ""
            ? null
            : Number(f.get("amountOverride")),
      };
      nights(next.departure, next.returnDate);
      if (!next.name) throw new Error("出張の名前を入力してください。");
      if (allowance(next) > MAX_MONEY)
        throw new Error("支給額は9桁以内で設定してください。");
      if (
        await mutate((d) => {
          const i = d.trips.findIndex((x) => x.id === t.id);
          if (i >= 0) d.trips[i] = next;
          else d.trips.push(next);
        })
      ) {
        closeSheet();
        toast("出張を保存しました。");
      }
    },
  );
}
function updateTripCalculation() {
 try {const t={departure:$('#trip-departure').value,returnDate:$('#trip-return').value,dailyRate:Number($('#trip-daily-rate').value||0),lodgingRate:Number($('#trip-lodging-rate').value||0)};const v=tripAmounts(t);
 $('#trip-days').textContent=`日当 ${v.days}日分`;$('#trip-nights').textContent=`宿泊日当 ${v.nights}泊分`;
 $('#trip-daily-total').textContent=amount(v.daily);$('#trip-lodging-total').textContent=amount(v.lodging);
 $('#trip-auto').textContent=amount(v.total);$('#trip-final').textContent=amount($('#trip-override').value===''?v.total:Number($('#trip-override').value));sheet.querySelector('.form-error').textContent='';
 } catch(err){for(const key of ['days','nights','daily-total','lodging-total','auto','final'])$('#trip-'+key).textContent='—';sheet.querySelector('.form-error').textContent=err.message;}
}
function tripDetail(tid) {
  currentTripDetail=tid;
  const t = tripById(tid);
  if (!t) return;
  const rows = data.transactions
    .filter((x) => x.tripId === tid)
    .sort((a, b) => b.date.localeCompare(a.date));
  showSheet(
    e(t.name),
    `<p class="small">${e(t.destination)} · ${nights(t.departure, t.returnDate)}泊</p><div class="calculation"><div><small>支給額</small><span class="number">${amount(allowance(t))}</span></div><div><small>実費</small><span class="number">${amount(expenseOfTrip(data, t))}</span></div><div><small>差額</small><span class="number">${amount(tripNet(data, t))}</span></div></div>${btn(`${icon("plus")} この出張の支出を記録`, "trip-entry", "secondary full", `data-id="${tid}"`)}<div style="margin-top:16px">${pageItems(rows,"tripRows",4).map((x) => `${rowHTML(x)}${x.advance ? `<label class="check-row small"><input type="checkbox" data-settle="${x.id}" ${x.settled ? "checked" : ""}>${x.settled ? "精算済み" : "未精算"} · ${amount(x.amount)}</label>` : ""}`).join("") || empty("history", "まだ記録がありません", "交通・宿泊・食事などの支出をまとめましょう。")}${pager("tripRows",rows.length,4)}</div>`,
  );
}
function deleteTrip(tid) {
  const t = tripById(tid);
  confirmAction(
    "出張を削除しますか？",
    "支出の記録は残し、出張への紐づけを外します。出張の支給額の計上はなくなります。",
    async () => {
      if (
        await mutate((d) => {
          d.trips = d.trips.filter((x) => x.id !== tid);
          for (const tx of d.transactions)
            if (tx.tripId === tid) {
              tx.tripId = null;
              tx.advance = false;
              tx.settled = false;
            }
        })
      ) {
        closeSheet();
        toast("出張を削除しました。");
      }
    },
  );
}
function downloadBackup(format) {
  const text = format === "json" ? backupJSON(data) : backupCSV(data);
  const blob = new Blob([text], {
    type:
      format === "json"
        ? "application/json;charset=utf-8"
        : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kotori-backup-${today()}.${format}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast("バックアップを作成しました。保存先を確認してください。");
}
async function previewRestore(file) {
  try {
    if (file.size > 25 * 1024 * 1024)
      throw new Error("25MB以内のバックアップを選んでください。");
    pendingRestore = restoreData(
      await file.text(),
      file.name.toLowerCase().endsWith(".csv") ? "csv" : "json",
    );
    showSheet(
      "バックアップを復元",
      `<p class="confirm-copy">現在のデータを、このバックアップで置き換えます。今のデータを残す場合は、先にバックアップしてください。</p><div class="restore-summary">グループ ${pendingRestore.groups.length}個 · 記録 ${pendingRestore.transactions.length}件<br>出張 ${pendingRestore.trips.length}件 · 予算 ${pendingRestore.budgets.length}件</div><div class="form-stack">${btn("今のデータをJSONで保存", "export-json", "secondary")}${btn("この内容で復元する", "confirm-restore", "primary")}</div>`,
    );
  } catch (err) {
    pendingRestore = null;
    toast(err.message || "バックアップを読み込めませんでした。");
  }
}
function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt = null;
  } else
    showSheet(
      "ホーム画面に追加",
      `<div class="form-stack"><p>iPhone・iPadではSafariでこのページを開き、共有メニューから「ホーム画面に追加」を選んでください。</p><p>Android・PCではブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選べます。</p><p class="small">初回の読み込みが完了すると、オフラインでも記録できます。</p>${btn("わかりました", "close-sheet", "primary")}</div>`,
    );
}
const actions = {
 'budget-edit':()=>{budgetEditing=true;resetBooks();render();},
 'budget-overview':()=>{budgetEditing=false;resetBooks();render();},
 'quick-key':b=>{const k=b.dataset.value;quick.amount=k==='back'?quick.amount.slice(0,-1):(quick.amount+k).replace(/^0+/,'').slice(0,9);updateQuick();},
 'return-input':()=>{page='home';homeSection='quick';resetBooks();render();},
 'quick-repeat':b=>{const t=recentQuick().find(t=>t.id===b.dataset.id);if(!t)return;quick.amount=String(t.amount);quick.categoryId=t.categoryId;updateQuick();toast('金額と項目を確認して記録');},
 'quick-category':b=>{quick.categoryId=b.dataset.id;updateQuick();},
 'quick-type':b=>{quick.type=b.dataset.type;quick.categoryId='';render();},
 'quick-details':()=>{openEntry();entry.amount=quick.amount;entry.categoryId=quick.categoryId;entry.type=quick.type;renderEntry();},
 'quick-save':async()=>{if(busy||!Number(quick.amount)||!quick.categoryId)return;const c=category(quick.categoryId);if(c?.groupId!==group().id||c.type!==quick.type)return;const record={id:id(),groupId:group().id,type:quick.type,amount:Number(quick.amount),categoryId:quick.categoryId,date:today(),memo:'',tripId:null,advance:false,settled:false,createdAt:new Date().toISOString()};if(await mutate(d=>d.transactions.push(record),{render:false})){quick.amount='';updateQuick();$('#quick-reuse').innerHTML=quickShortcuts();toast(`${c.name} ${amount(record.amount)} を保存しました`,async()=>{if(await mutate(d=>{d.transactions=d.transactions.filter(t=>t.id!==record.id);},{render:false})){if($('#quick-reuse'))$('#quick-reuse').innerHTML=quickShortcuts();}},'取り消す');}},
 'budget-manual':()=>{budgetDraft={...budgetDraft,mode:'manual',limit:Math.max(budgetDraft.limit,sum(Object.values(budgetDraft.allocations)))};render();},
 'budget-auto':()=>{budgetDraft=proposeBudget(data,group().id,month);budgetTouched=false;render();},
 'budget-photo':()=>{
   showSheet('画像の予算を使う',`<p>この月の予算を10項目・250,000円に置き換えます。収支記録は変更しません。</p><button class="btn primary full" data-action="budget-photo-confirm">この予算に置き換える</button>`);
 },
 'budget-photo-confirm':async()=>{
   const ok=await mutate(d=>{const b=makePhotoBudget(d,group().id,month);const i=d.budgets.findIndex(x=>x.id===b.id);if(i<0)d.budgets.push(b);else d.budgets[i]=b;},{render:false});
   if(ok){budgetDraft=null;closeSheet();render();toast('画像の予算を登録しました。');}
 },
 'budget-add-item':()=>{const cid=$('#budget-add-category').value;if(cid){budgetDraft.allocations[cid]=0;budgetTouched=true;pageNumbers.budget=Math.floor((Object.keys(budgetDraft.allocations).length-1)/4);render();}},
 'budget-remove-item':b=>{delete budgetDraft.allocations[b.dataset.id];budgetTouched=true;render();},
 "home-section":b=>{homeSection=b.dataset.section;resetBooks();render();},
 "page-step": b=>{const key=b.dataset.pageKey;if(!Object.hasOwn(pageNumbers,key))return;pageNumbers[key]+=Number(b.dataset.step);if(key==='tripRows')tripDetail(currentTripDetail);else if(key==='groups')openGroups();else render();},
 "settings-tab":b=>{settingsSection=b.dataset.section;render();},
 "category-kind":b=>{categoryKind=b.dataset.kind;pageNumbers.categories=0;render();},
 "graph-kind":b=>{graphKind=b.dataset.kind;pageNumbers.graphCategories=0;render();},
 "graph-range":b=>{graphMonths=Number(b.dataset.months);graphSelected=null;render();},
 "graph-month":b=>{graphSelected=b.dataset.month;render();},
  "toggle-sliders": (b) => { const shown=$("#budget-controls").classList.toggle("show-sliders"); b.setAttribute("aria-pressed",shown); b.textContent=shown?"スライダーを閉じる":"スライダーで調整"; },
  "month-prev": () => changeMonth(-1),
  "month-next": () => changeMonth(1),
  "new-entry": () => openEntry(),
  "edit-entry": (b) => openEntry(b.dataset.id),
  "delete-entry": (b) => deleteEntry(b.dataset.id),
  "go-budget": () => navigate("budget"),
  "history-list": () => {
    historyView = "list";
    selectedDate = null;
    render();
  },
  "history-calendar": () => {
    historyView = "calendar";
    render();
  },
  "select-date": (b) => {
    selectedDate = b.dataset.date;
    pageNumbers.history=0;
    render();
  },
  "clear-date": () => {
    selectedDate = null;
    render();
  },
  "close-sheet": closeSheet,
  "entry-type": (b) => {
    syncEntry();
    entry.type = b.dataset.type;
    entry.categoryId = "";
    if (entry.type === "income") {
      entry.tripId = null;
      entry.advance = false;
      entry.settled = false;
    }
    categoryPage = 0;
    renderEntry();
  },
  "entry-category": (b) => {
    syncEntry();
    entry.categoryId = b.dataset.id;
    sheet.querySelector(".category-caption > span").textContent="項目 · "+category(entry.categoryId).name;
    sheet.querySelectorAll(".category-pick").forEach((x) => {
      const chosen = x.dataset.id === entry.categoryId;
      x.classList.toggle("selected", chosen);
      x.setAttribute("aria-pressed", chosen);
    });
    $("#entry-save").disabled = !Number(entry.amount);
  },
  "entry-all": (b) => {
    syncEntry();
    categoryPage = (categoryPage + 1) % Number(b.dataset.pages);
    renderEntry();
  },
  "entry-details": () => {
    const d = sheet.querySelector("details");
    d.open = !d.open;
    if (d.open) d.scrollIntoView({ block: "nearest" });
  },
  "new-group": () => editGroup(),
  "edit-group": (b) => editGroup(b.dataset.id),
  "manage-groups": openGroups,
  "delete-group": (b) => deleteGroup(b.dataset.id),
  "choose-color": (b) => {
    $("#group-color").value = b.dataset.color;
    sheet
      .querySelectorAll(".color-choice")
      .forEach((x) => x.classList.toggle("selected", x === b));
  },
  "new-category": () => editCategory(),
  "edit-category": (b) => editCategory(b.dataset.id),
  "delete-category": (b) => deleteCategory(b.dataset.id),
  "choose-icon": (b) => {
    $("#category-icon-value").value = b.dataset.icon;
    sheet.querySelectorAll(".icon-choice").forEach((x) => {
      x.classList.toggle("selected", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
  },
  "category-up": (b) => reorderCategory(b.dataset.id, -1),
  "category-down": (b) => reorderCategory(b.dataset.id, 1),
  "category-hide": (b) =>
    mutate((d) => {
      const c = d.categories.find((x) => x.id === b.dataset.id);
      c.hidden = !c.hidden;
    }),
  "budget-step": (b) =>
    updateBudgetAmount(
      b.dataset.id,
      budgetDraft.allocations[b.dataset.id] + Number(b.dataset.delta),
    ),
  "budget-recalculate": () => {
    changeBudgetBase();
    budgetDraft = proposeBudget(
      data,
      group().id,
      month,
      budgetDraft.salary,
      budgetDraft.savingRate,
    );
    budgetTouched = false;
    render();
    updateBudgetUI();
    toast("配分をつくり直しました。");
  },
  "save-budget": async () => {
    changeBudgetBase();
    if (
      sum(Object.values(budgetDraft.allocations)) > budgetDraft.limit ||
      (budgetDraft.mode!=='manual'&&!budgetDraft.salary)
    ) {
      toast("給与と予算の合計を確認してください。");
      return;
    }
    const b = structuredClone(budgetDraft);
    if (
      await mutate((d) => {
        const i = d.budgets.findIndex((x) => x.id === b.id);
        if (i >= 0) d.budgets[i] = b;
        else d.budgets.push(b);
        if(b.mode!=='manual')d.groups.find((g) => g.id === b.groupId).savingRate = b.savingRate;
      })
    ) {
      toast("今月の予算を決めました。");
    }
  },
  "new-trip": () => editTrip(),
  "edit-trip": (b) => editTrip(b.dataset.id),
  "delete-trip": (b) => deleteTrip(b.dataset.id),
  "trip-detail": (b) => tripDetail(b.dataset.id),
  "trip-entry": (b) => openEntry(null, b.dataset.id),
  "export-json": () => downloadBackup("json"),
  "export-csv": () => downloadBackup("csv"),
  restore: () => {
    $("#restore-file").value = "";
    $("#restore-file").click();
  },
  "confirm-restore": async () => {
    if (!pendingRestore) return;
    const replacement = structuredClone(pendingRestore);
    if (
      await mutate((d) => {
        for (const k of Object.keys(d)) delete d[k];
        Object.assign(d, replacement);
      })
    ) {
      pendingRestore = null;
      budgetDraft = null;
      closeSheet();
      navigate("home");
      toast("バックアップを復元しました。");
    }
  },
  install: installApp,
};
const quickDrafts=new Map();
async function switchGroup(target){
  if(busy||target===group().id||!data.groups.some(g=>g.id===target))return;
  quickDrafts.set(group().id,{...quick});
  const ok=await mutate(d=>{d.settings[0].activeGroup=target;},{render:false});
  if(!ok)return;
  Object.assign(quick,quickDrafts.get(target)||{amount:'',categoryId:'',type:'expense'});
  for(const key of Object.keys(pageNumbers))pageNumbers[key]=0;
  budgetDraft=null;selectedDate=null;graphSelected=null;resetBooks();render();
}
bindGroupSwipe(document.querySelector('.main-wrap'),direction=>{
  if(!data||busy)return;
  const groups=[...data.groups].sort((a,b)=>a.order-b.order);
  const target=groups[groups.findIndex(g=>g.id===group().id)+direction];
  if(target)switchGroup(target.id);
});
function changeMonth(delta) {
  for(const key of Object.keys(pageNumbers))pageNumbers[key]=0;
  graphSelected=null;
  const next = moveMonth(month, delta);
  if (next < "1900-01" || next > "2200-12") return;
  month = next;
  budgetDraft = null;
  selectedDate = null;
  render();
  if (page === "budget") updateBudgetUI();
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button,a");
  if (!b || b.disabled || !data) return;
  if (b.dataset.nav) {
    navigate(b.dataset.nav);
    if (page === "budget") updateBudgetUI();
    return;
  }
  if (b.dataset.group) {
    await switchGroup(b.dataset.group);
    return;
  }
  if (b.dataset.key) {
    enterKey(b.dataset.key);
    return;
  }
  if (b.dataset.action && actions[b.dataset.action]) {
    ev.preventDefault();
    try {
      await actions[b.dataset.action](b);
    } catch (err) {
      formError(err.message || "操作を完了できませんでした。");
    }
  }
});
$("#settings-button").onclick = () => navigate("settings");
$("#add-group").onclick = () => editGroup();
document.addEventListener("input", (ev) => {
  const t = ev.target;
  if (
    t.classList.contains("budget-number") ||
    t.classList.contains("budget-range")
  )
    updateBudgetAmount(t.dataset.id, t.value);
  if (["budget-salary", "budget-rate", "manual-limit"].includes(t.id)) changeBudgetBase();
  if (
    ["trip-departure", "trip-return", "trip-daily-rate", "trip-lodging-rate", "trip-override"].includes(
      t.id,
    )
  )
    updateTripCalculation();
});
document.addEventListener("change", async (ev) => {
  if(ev.target.id==='quick-other'){quick.categoryId=ev.target.value;updateQuick();return;}
  const t = ev.target;
  if(t.id==="group-select")await switchGroup(t.value);
  if (t.id === "history-filter") {
    pageNumbers.history=0;
    historyFilter = t.value;
    render();
  }
  if (t.id === "theme-setting")
    await mutate((d) => {
      d.settings[0].theme = t.value;
    });
  if (["saving-setting","daily-rate-setting","lodging-rate-setting"].includes(t.id)) {
    if (!t.checkValidity()) {
      t.reportValidity();
      return;
    }
    const gid = group().id;
    await mutate((d) => {
      d.groups.find((g) => g.id === gid)[
        ({"saving-setting":"savingRate","daily-rate-setting":"dailyRate","lodging-rate-setting":"lodgingRate"})[t.id]
      ] = Number(t.value);
    });
  }
  if (t.id === "trip-mode-setting") {
    const gid = group().id;
    await mutate((d) => {
      d.groups.find((g) => g.id === gid).tripMode = t.value;
    });
    toast("出張の反映方法を変更しました。");
  }
  if (t.id === "entry-advance") {
    $("#entry-settled").disabled = !t.checked;
    if (!t.checked) $("#entry-settled").checked = false;
  }
  if (t.id === "entry-trip") $("#entry-advance").disabled = !t.value;
  if (t.id === "entry-trip" && !t.value) {
    $("#entry-advance").checked = false;
    $("#entry-settled").checked = false;
    $("#entry-settled").disabled = true;
  }
  if (t.dataset.settle) {
    const tx = data.transactions.find((x) => x.id === t.dataset.settle);
    const tid = tx.tripId;
    const checked = t.checked;
    if (
      await mutate((d) => {
        d.transactions.find((x) => x.id === tx.id).settled = checked;
      })
    )
      tripDetail(tid);
  }
  if (t.id === "restore-file" && t.files[0]) await previewRestore(t.files[0]);
});
document.addEventListener("keydown", (ev) => {
  if (!sheet.open || !entry || !sheet.classList.contains("entry-dialog"))
    return;
  const tag = ev.target.tagName;
  if (
    ["SELECT", "TEXTAREA", "INPUT"].includes(tag) &&
    ev.target.id !== "entry-amount"
  )
    return;
  if (/^[0-9]$/.test(ev.key)) {
    ev.preventDefault();
    enterKey(ev.key);
  } else if (ev.key === "Backspace") {
    ev.preventDefault();
    enterKey("back");
  } else if (ev.key === "Delete") {
    ev.preventDefault();
    enterKey("clear");
  } else if (
    ev.key === "Enter" &&
    ev.target.id === "entry-amount" &&
    !$("#entry-save").disabled
  ) {
    ev.preventDefault();
    $("#entry-form").requestSubmit($("#entry-save"));
  }
});
$("#groups").addEventListener("keydown", (ev) => {
  if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
  const tabs = [...$("#groups").querySelectorAll("button")];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  ev.preventDefault();
  const next =
    tabs[(i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  next.click();
});
sheet.addEventListener("cancel", () => {
  entry = null;
  categoryPage = 0;
});
sheet.addEventListener("click", (ev) => {
  if (ev.target === sheet) {
    const r = sheet.getBoundingClientRect();
    if (
      ev.clientY < r.top ||
      ev.clientY > r.bottom ||
      ev.clientX < r.left ||
      ev.clientX > r.right
    )
      closeSheet();
  }
});


window.addEventListener("online", updateStatus);
window.addEventListener("offline", updateStatus);
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  installPrompt = ev;
});
window.addEventListener("hashchange", () => {
  const p = location.hash.slice(1);
  if (
    ["home", "history", "budget", "trips", "settings", "categories", "graphs"].includes(p)
  ) {
    page = p;
    budgetDraft = null;
    render();
  }
});
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => {
  if (data) setTheme();
});
channel?.addEventListener("message", async () => {
  if (sheet.open || busy) {
    toast("別のタブで更新されました。保存時に最新の状態を確認します。");
    return;
  }
  data = await loadData();
  budgetDraft = null;
  render();
});
async function setupOffline() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    toast("オフラインで使うにはHTTPSで開いてください。");
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", {
      scope: "./",
    });
    const ready = await navigator.serviceWorker.ready;
    offlineReady = !!ready.active;
    updateStatus();
    if (page === "settings" && !sheet.open) render();
    const updateNotice = () => {
      if (reg.waiting && navigator.serviceWorker.controller)
        toast(
          "新しいバージョンを使えます。入力を保存してから更新してください。",
          () => {
            reg.waiting.postMessage({ type: "ACTIVATE" });
          },
          "更新する",
        );
    };
    updateNotice();
    reg.addEventListener("updatefound", () => {
      reg.installing?.addEventListener("statechange", updateNotice);
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reg.active && reloaded) return;
      if (offlineReady && navigator.serviceWorker.controller) {
        reloaded = true;
        if (sheet.open)
          toast("更新されました。入力を保存後、アプリを開き直してください。");
        else location.reload();
      }
    });
  } catch {
    offlineReady = false;
    toast("オフライン用の保存に失敗しました。オンラインで開き直してください。");
  }
}
try {
  data = await initialize();
  if(seedPhotoBudget(data))await saveData(data,data.settings[0].revision||0);
  const requested = location.hash.slice(1);
  if (
    ["home", "history", "budget", "trips", "settings", "categories", "graphs"].includes(
      requested,
    )
  )
    page = requested;
  render();
  if (page === "budget") updateBudgetUI();
  setupOffline();
} catch (err) {
  $("#main").innerHTML =
    `<section class="card fatal"><h1>記録を開けませんでした</h1><p>端末の空き容量や、ブラウザの保存設定をご確認ください。</p><p class="small">${e(err.message)}</p><button class="btn primary" id="retry">もう一度開く</button></section>`;
  $("#retry").onclick = () => location.reload();
}
