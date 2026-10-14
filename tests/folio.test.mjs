import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {setTimeout as wait} from 'node:timers/promises';
import {partition} from '../folio.js';
test('高さを超える内容を、順序・件数を保ってページに分ける',()=>{assert.deepEqual(partition([40,60,80,20],xs=>xs.reduce((s,x)=>s+x,0)<=100),[[40,60],[80,20]]);assert.deepEqual(partition([],()=>true),[[]]);});
test('画面の切替と高さ変更でフォームの値・DOMを保持し全項目へ到達する（高さはシミュレーション）',async()=>{
 const {window,document}=parseHTML('<html><body><main id="main"><div id="main-viewport"><div class="page"><h1 data-height="70">見出し</h1><form><label data-height="100">名前<input value="入力済み"></label><button data-height="90" type="submit">保存</button></form></div></div><nav id="main-folio"></nav></main></body></html>');
 Object.assign(globalThis,{window,document,matchMedia:()=>({matches:true}),requestAnimationFrame:cb=>setTimeout(cb,0)});
 const host=document.querySelector('#main-viewport');let height=150;Object.defineProperty(host,'clientHeight',{get:()=>height});
 const visible=n=>!n.closest('.folio-off');
 const measure=n=>!visible(n)?0:n.dataset.height?Number(n.dataset.height):[...n.children].reduce((s,c)=>s+measure(c),0);
 for(const n of document.querySelectorAll('*')){n.getClientRects=()=>visible(n)?[{}]:[];n.getBoundingClientRect=()=>({height:measure(n)});}
 const {refreshBooks}=await import('../folio.js');refreshBooks();await wait(20);
 const input=document.querySelector('input');input.value='途中の入力';
 assert.match(document.querySelector('#main-folio').textContent,/1.*3/);
 document.querySelector('#main-folio button:last-child').click();assert.ok(visible(input));assert.equal(input.value,'途中の入力');
 document.querySelector('#main-folio button:last-child').click();assert.ok(visible(document.querySelector('form button')));assert.equal(input.value,'途中の入力');
 height=400;refreshBooks();await wait(20);assert.equal(document.querySelector('input'),input);assert.ok(visible(input));assert.equal(document.querySelector('#main-folio').dataset.single,'true');
 height=150;document.querySelector('#main').classList.add('quick-home');refreshBooks();await wait(20);
 assert.equal(document.querySelector('#main-folio').hidden,true);assert.equal(document.querySelectorAll('.folio-off').length,0);
});
