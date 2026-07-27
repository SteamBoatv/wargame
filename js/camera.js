'use strict';
/* ---------------- 画布与镜头 ---------------- */
const cv=$('cv'), ctx=cv.getContext('2d');
let dpr=1, cssW=0, cssH=0, safeR=0;
const cam={x:BASE0.x,y:BASE0.y-120,z:0.8,min:0.2,max:1.8};
function resize(){
  dpr=window.devicePixelRatio||1;
  cssW=innerWidth; cssH=innerHeight;
  safeR=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sar'))||0;
  cv.width=Math.round(cssW*dpr); cv.height=Math.round(cssH*dpr);
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  cam.min=Math.max(0.15,Math.min(cssW/WORLD_W,cssH/WORLD_H));
  cam.max=Math.max(1.8,cssW/WORLD_W);
  cam.z=clamp(cam.z,cam.min,cam.max);
  clampCam();
}
function clampCam(){
  const vw=cssW/cam.z, vh=cssH/cam.z;
  cam.x = vw>=WORLD_W? WORLD_W/2 : clamp(cam.x,vw/2,WORLD_W-vw/2);
  cam.y = vh>=WORLD_H? WORLD_H/2 : clamp(cam.y,vh/2,WORLD_H-vh/2);
}
function screenToWorld(px,py){
  return {x:(px-cssW/2)/cam.z+cam.x, y:(py-cssH/2)/cam.z+cam.y};
}
function zoomAt(px,py,nz){
  nz=clamp(nz,cam.min,cam.max);
  const wx=(px-cssW/2)/cam.z+cam.x, wy=(py-cssH/2)/cam.z+cam.y;
  cam.z=nz;
  cam.x=wx-(px-cssW/2)/cam.z;
  cam.y=wy-(py-cssH/2)/cam.z;
  clampCam();
}
addEventListener('resize',resize);

/* ---------------- 输入：拖动 / 双指缩放 / 小地图 ---------------- */
const pointers=new Map();
let mmRect=null, mmDragging=false, dragMoved=0, pinch0=null;
const inRect=(x,y,r)=>r&&x>=r.x-6&&x<=r.x+r.w+6&&y>=r.y-6&&y<=r.y+r.h+6;
function moveByMinimap(px,py){
  if(!mmRect)return;
  cam.x=clamp((px-mmRect.x)/mmRect.k,0,WORLD_W);
  cam.y=clamp((py-mmRect.y)/mmRect.k,0,WORLD_H);
  clampCam(); setFollow(false);
}
cv.addEventListener('pointerdown',e=>{
  try{cv.setPointerCapture(e.pointerId);}catch(err){}
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragMoved=0;
  if(pointers.size===1&&inRect(e.clientX,e.clientY,mmRect)){
    mmDragging=true; moveByMinimap(e.clientX,e.clientY);
  }else if(pointers.size===1&&placing){
    placePos=screenToWorld(e.clientX,e.clientY);
  }
  if(pointers.size===2){
    const it=pointers.values(), a=it.next().value, b=it.next().value;
    pinch0={d:Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),z:cam.z,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};
    mmDragging=false;
    dragMoved=999; /* 双指手势结束时最后一指抬起不能被当成"轻点"（会误开反应堆菜单） */
  }
});
cv.addEventListener('pointermove',e=>{
  const p=pointers.get(e.pointerId);
  if(!p)return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y;
  p.x=e.clientX; p.y=e.clientY;
  if(mmDragging){moveByMinimap(e.clientX,e.clientY);return;}
  if(pointers.size===1){
    if(placing){placePos=screenToWorld(e.clientX,e.clientY);return;}
    cam.x-=dx/cam.z; cam.y-=dy/cam.z; clampCam();
    dragMoved+=Math.abs(dx)+Math.abs(dy);
    if(dragMoved>8)setFollow(false);
  }else if(pointers.size===2&&pinch0){
    const it=pointers.values(), a=it.next().value, b=it.next().value;
    const d=Math.max(20,Math.hypot(a.x-b.x,a.y-b.y));
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    zoomAt(mx,my,pinch0.z*d/pinch0.d);
    cam.x-=(mx-pinch0.mx)/cam.z;
    cam.y-=(my-pinch0.my)/cam.z;
    clampCam();
    pinch0.mx=mx; pinch0.my=my;
    setFollow(false);
  }
});
function endPointer(e){
  pointers.delete(e.pointerId);
  if(pointers.size===2){
    const it=pointers.values(), a=it.next().value, b=it.next().value;
    pinch0={d:Math.max(20,Math.hypot(a.x-b.x,a.y-b.y)),z:cam.z,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};
  }else if(pointers.size<2)pinch0=null;
  if(pointers.size===0&&placing&&placePos&&!mmDragging)placeAt(placePos.x,placePos.y);
  /* 轻点（没拖动、非放置、非小地图、非 pointercancel）→ 试着选中己方反应堆。
     必须走 else：placeAt 会把 placing 置 false，顺序执行会把同一次松手又当成轻点 */
  else if(pointers.size===0&&!mmDragging&&dragMoved<8&&e.type==='pointerup'&&
          typeof tryPickWorkshop==='function')tryPickWorkshop(e.clientX,e.clientY);
  if(pointers.size===0)mmDragging=false;
}
cv.addEventListener('pointerup',endPointer);
cv.addEventListener('pointercancel',endPointer);
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  zoomAt(e.clientX,e.clientY,cam.z*Math.exp(-e.deltaY*0.0012));
  setFollow(false);
},{passive:false});
addEventListener('contextmenu',e=>e.preventDefault());
