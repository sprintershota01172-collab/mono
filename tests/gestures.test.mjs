import test from 'node:test';
import assert from 'node:assert/strict';
import {swipeDirection,bindGroupSwipe} from '../gestures.js';
import {parseHTML} from 'linkedom';
test('左右のスワイプのみを認識し、縦・短い移動・画面端・長押しを除外',()=>{
 const s={x:190,y:200,time:0,width:390};
 assert.equal(swipeDirection(s,{x:90,y:208,time:200}),1);
 assert.equal(swipeDirection(s,{x:290,y:208,time:200}),-1);
 for(const e of [{x:160,y:200,time:200},{x:90,y:300,time:200},{x:90,y:200,time:800}])assert.equal(swipeDirection(s,e),0);
 assert.equal(swipeDirection({...s,x:10},{x:100,y:200,time:200}),0);
});
test('スワイプ後の誤タップ、フォーム操作、キャンセルを除外',()=>{
 const {window,document}=parseHTML('<main><button>1</button><input></main>');
 Object.assign(globalThis,{window,document});window.innerWidth=390;
 const root=document.querySelector('main'),button=root.querySelector('button');let switches=0,clicks=0;
 bindGroupSwipe(root,()=>switches++);root.addEventListener('click',()=>clicks++);
 const fire=(target,type,x,y=200)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerType:'touch',pointerId:1,isPrimary:true});target.dispatchEvent(e);};
 fire(button,'pointerdown',200);fire(button,'pointerup',100);button.click();assert.equal(switches,1);assert.equal(clicks,0);
 fire(root.querySelector('input'),'pointerdown',200);fire(root,'pointerup',100);assert.equal(switches,1);
 fire(button,'pointerdown',200);fire(button,'pointercancel',160);fire(button,'pointerup',100);assert.equal(switches,1);
});
