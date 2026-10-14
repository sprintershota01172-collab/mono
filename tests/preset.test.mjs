import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData,validateData,backupJSON,backupCSV,restoreData,sum} from '../core.js';
import {PHOTO_BUDGET,seedPhotoBudget,makePhotoBudget} from '../preset.js';
test('画像の10項目・250000円を初期登録し架空の支出は作らない',()=>{
 const d=initialData();assert.equal(seedPhotoBudget(d,'2026-10'),true);validateData(d);
 const b=d.budgets[0];assert.equal(b.mode,'manual');assert.equal(b.limit,250000);assert.equal(sum(Object.values(b.allocations)),250000);
 assert.deepEqual(Object.entries(b.allocations).map(([cid,n])=>[d.categories.find(c=>c.id===cid).name,n]),PHOTO_BUDGET.map(([name,n])=>[name,n]));
 assert.equal(d.transactions.length,0);assert.equal(d.trips.length,0);assert.equal(d.budgets.length,1);assert.equal(b.groupId,d.groups[0].id);
});
test('再起動で編集した予算を元に戻さず、既存月の予算も上書きしない',()=>{
 const d=initialData();seedPhotoBudget(d,'2026-10');const b=d.budgets[0];b.allocations[Object.keys(b.allocations)[0]]=70000;
 const before=JSON.stringify(d);assert.equal(seedPhotoBudget(d,'2026-10'),false);assert.equal(JSON.stringify(d),before);
 const existing=initialData();existing.budgets.push(makePhotoBudget(existing,existing.groups[0].id,'2026-10'));existing.budgets[0].limit=260000;
 seedPhotoBudget(existing,'2026-10');assert.equal(existing.budgets[0].limit,260000);assert.equal(existing.budgets.length,1);
});
test('同名項目を再利用し、手動予算と初期化済みフラグがJSON/CSVで復元される',()=>{
 const d=initialData(),gid=d.groups[0].id;makePhotoBudget(d,gid,'2026-10');const n=d.categories.length;seedPhotoBudget(d,'2026-10');assert.equal(d.categories.length,n);
 for(const restored of [restoreData(backupJSON(d)),restoreData(backupCSV(d),'csv')]){assert.equal(restored.budgets[0].mode,'manual');assert.equal(restored.settings[0].photoBudgetSeed,1);assert.equal(seedPhotoBudget(restored),false);validateData(restored);}
});
