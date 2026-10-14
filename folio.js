// Content is paged, never scrolled. Existing form nodes stay mounted, preserving values.
const books = new Map();
let scheduled = false;
export function fade(node) {
  if (!node?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  node.getAnimations?.().forEach(a => a.cancel());
  node.animate([{opacity:.25},{opacity:1}], {duration:480,easing:'ease-out'});
}
export function partition(items, fits) {
  const pages=[]; let current=[];
  for(const item of items){
    const trial=[...current,item];
    if(current.length && !fits(trial)){pages.push(current);current=[item];}
    else current=trial;
  }
  if(current.length)pages.push(current);
  return pages.length?pages:[[]];
}
export function resetBooks(){for(const book of books.values())book.index=0;}
function viewport(){
  const h=window.visualViewport?.height || window.innerHeight;
  if(h)document.documentElement.style.setProperty('--app-height',`${Math.round(h)}px`);
}
function setup(host, content, nav){
  if(!host||!content||!nav)return;
  let book=books.get(host.id);
  if(!book){book={index:0};books.set(host.id,book);}
  book.observer?.disconnect();
  content.querySelectorAll('.folio-off').forEach(n=>n.classList.remove('folio-off'));
  if(host.closest('.fixed-overview, .quick-home')){nav.hidden=true;return;}
  nav.hidden=false;
  const available=host.clientHeight;
  if(!available)return; // Non-layout DOM test environments.
  const leaves=[],branches=[];
  const visit=node=>{
    if(node.hidden || node.getClientRects().length===0)return;
    const children=[...node.children].filter(n=>!['SCRIPT','STYLE'].includes(n.tagName));
    if(children.length && node.getBoundingClientRect().height>available-16 && !node.matches('button,label,input,select,textarea,svg')){
      branches.push(node);for(const child of children)visit(child);
    }else leaves.push(node);
  };
  for(const child of content.children)visit(child);
  const branchLeaves=new Map(branches.map(n=>[n,leaves.filter(l=>n.contains(l))]));
  function show(nodes){
    const active=new Set(nodes);
    for(const leaf of leaves)leaf.classList.toggle('folio-off',!active.has(leaf));
    for(const branch of branches)branch.classList.toggle('folio-off',!branchLeaves.get(branch).some(l=>active.has(l)));
  }
  // Nested cards add padding: also test each block inside its actual ancestors.
  for(let i=0;i<leaves.length;i++){
    const leaf=leaves[i];show([leaf]);
    if(content.getBoundingClientRect().height<=available-4 || leaf.matches('button,label,input,select,textarea,svg'))continue;
    const children=[...leaf.children].filter(n=>!n.hidden && n.getClientRects().length>0);
    if(!children.length)continue;
    branches.push(leaf);leaves.splice(i,1,...children);
    branchLeaves.clear();for(const branch of branches)branchLeaves.set(branch,leaves.filter(l=>branch.contains(l)));
    i--;
  }
  const pages=partition(leaves,nodes=>{show(nodes);return content.getBoundingClientRect().height<=available-4;});
  const focused=document.activeElement;
  if(content.contains(focused)){
    const found=pages.findIndex(nodes=>nodes.some(n=>n===focused||n.contains(focused)));
    if(found>=0)book.index=found;
  }
  book.index=Math.min(book.index,pages.length-1);
  book.pages=pages;book.show=show;
  const paint=(animate=false)=>{
    show(pages[book.index]);
    nav.innerHTML=`<button type="button" aria-label="前の画面" ${book.index===0?'disabled':''}>‹ 前へ</button><span aria-live="polite">${book.index+1} <i>/ ${pages.length}</i></span><button type="button" aria-label="次の画面" ${book.index===pages.length-1?'disabled':''}>次へ ›</button>`;
    const buttons=nav.querySelectorAll('button');
    buttons[0].onclick=()=>{book.index--;paint(true);};buttons[1].onclick=()=>{book.index++;paint(true);};
    nav.dataset.single=String(pages.length===1);
    if(animate)fade(content);
  };
  paint();
  book.reveal=target=>{const i=pages.findIndex(nodes=>nodes.some(n=>n===target||n.contains(target)));if(i>=0){book.index=i;paint();}};
  if(typeof MutationObserver!=='undefined'){
    book.observer=new MutationObserver(refreshBooks);
    book.observer.observe(content,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
  }
}
export function refreshBooks(){
  if(scheduled || typeof requestAnimationFrame==='undefined')return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;viewport();
    setup(document.querySelector('#main-viewport'),document.querySelector('#main .page'),document.querySelector('#main-folio'));
    if(document.querySelector('#sheet')?.open)setup(document.querySelector('#sheet-viewport'),document.querySelector('#sheet .sheet-body'),document.querySelector('#sheet-folio'));
  });
}
if(typeof window!=='undefined'){
  window.addEventListener('resize',refreshBooks);
  window.visualViewport?.addEventListener('resize',refreshBooks);
  document.addEventListener('toggle',refreshBooks,true);
  document.addEventListener('click',()=>setTimeout(refreshBooks,0));
  document.addEventListener('invalid',event=>{for(const b of books.values())b.reveal?.(event.target);},true);
  document.fonts?.ready.then(refreshBooks);
}
