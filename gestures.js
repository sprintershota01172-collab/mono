// Horizontal swipes only; leave vertical gestures, slow drags and iOS edges alone.
export function swipeDirection(start, end) {
  const dx=end.x-start.x, dy=end.y-start.y;
  if(start.x<24 || start.x>start.width-24 || end.time-start.time>700 || Math.abs(dx)<64 || Math.abs(dx)<Math.abs(dy)*1.8) return 0;
  return dx<0?1:-1;
}
export function bindGroupSwipe(root, change) {
  let start=null, suppressUntil=0;
  root.addEventListener('pointerdown',ev=>{
    start=null;
    if(ev.pointerType!=='touch'||ev.isPrimary===false||document.querySelector('dialog[open]')||ev.target.closest('input,select,textarea,[role="slider"],.budget-control'))return;
    start={x:ev.clientX,y:ev.clientY,time:Date.now(),width:window.innerWidth,id:ev.pointerId};
  });
  root.addEventListener('pointercancel',()=>{start=null;});
  root.addEventListener('pointerup',ev=>{
    if(!start||start.id!==ev.pointerId)return;
    const direction=swipeDirection(start,{x:ev.clientX,y:ev.clientY,time:Date.now()});start=null;
    if(direction){suppressUntil=Date.now()+450;change(direction);}
  });
  root.addEventListener('click',ev=>{
    if(Date.now()<suppressUntil){ev.preventDefault();ev.stopImmediatePropagation();}
  },true);
}
