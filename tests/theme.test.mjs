import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
test('tabiテーマは最後に読み込み、空白を作る下寄せと自動余白を上書きする',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const css=await readFile(new URL('../tabi-theme.css',import.meta.url),'utf8');
 assert.ok(html.indexOf('tabi-theme.css')>html.indexOf('href="./style.css"'));
 assert.match(css,/\.quick-home \.page\{[^}]*margin:0 auto!important[^}]*display:grid/);
 assert.match(css,/\.quick-home \.quick-top\{[^}]*margin:0!important/);
 assert.match(css,/--navy:#173b61/);assert.match(css,/prefers-reduced-motion/);
});
test('tabiの手書きフォントはローカル実体と事前キャッシュを持つ',async()=>{
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['Yomogi-Regular.woff2','Caveat-Medium.woff2']){
   assert.ok((await stat(new URL('../assets/fonts/'+file,import.meta.url))).size>1000);
   assert.ok(sw.includes('./assets/fonts/'+file));
 }
 assert.ok(sw.includes('./tabi-theme.css'));
});
