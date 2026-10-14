import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData,STORES,id,allowance,validateData} from '../core.js';
import {initialize,openDB} from '../db.js';
test('IndexedDB v1からv2へデータを保ったまま単価フィールドを移行する',async()=>{
 const d=initialData();for(const g of d.groups){delete g.dailyRate;delete g.lodgingRate;g.nightlyRate=4200;}
 const t={id:id(),groupId:d.groups[0].id,name:'旧出張',destination:'国内',departure:'2026-10-01',returnDate:'2026-10-03',nightlyRate:4200,amountOverride:null};d.trips.push(t);
 await new Promise((resolve,reject)=>{const req=indexedDB.open('kotori-budget-v1',1);req.onupgradeneeded=()=>{for(const name of STORES){const s=req.result.createObjectStore(name,{keyPath:'id'});for(const r of d[name])s.put(r);}};req.onerror=()=>reject(req.error);req.onsuccess=()=>{req.result.close();resolve();};});
 const migrated=await initialize();validateData(migrated);assert.equal((await openDB()).version,2);assert.deepEqual(migrated.groups.map(g=>g.id).sort(),d.groups.map(g=>g.id).sort());assert.equal(migrated.groups[0].lodgingRate,4200);assert.equal(migrated.trips[0].dailyRate,0);assert.equal(allowance(migrated.trips[0]),8400);assert.equal(migrated.categories.length,34);
});
