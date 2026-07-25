'use strict';
/* ---------------- 绘制 ---------------- */
function rrectPath(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawDeco(d){
  const ds=ASSETS.ts.misc.decos;
  const img=(ds&&d.di!==undefined)?ds[d.di]:null;
  if(img){
    const dw=d.s*1.7, dh=dw*img.height/img.width;
    ctx.drawImage(img,d.x-dw/2,d.y-dh+6,dw,dh);
  }else{
    ctx.font=em(d.s);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(d.e,d.x,d.y-d.s*0.3);
  }
}
function drawBase(side){
  const b=side?BASE1:BASE0;
  const era2=G&&(side?G.aiEra:G.era)===2;
  const M=ASSETS.ts.misc;
  const dead=G&&G.over&&G.baseHp[side]<=0;
  const cimg=M&&(dead?M.castle_destroyed:(side?M.castle_red:M.castle_blue));
  let barY=b.y-112;
  if(cimg){
    const w=150,h=Math.round(w*cimg.height/cimg.width);
    ctx.drawImage(cimg,b.x-w/2,b.y+44-h,w,h);
    barY=b.y+44-h-20;
    if(era2){
      ctx.font=em(24);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('👑',b.x,barY-22);
    }
  }else{
    ctx.font=em(84);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(side?'🏯':'🏰',b.x,b.y-26);
    if(era2){
      ctx.font=em(24);
      ctx.fillText('👑',b.x-36,b.y-84);
    }
    ctx.fillStyle=era2?'#ffd76a':(side?'#ff4040':'#2e7dff');
    ctx.beginPath();
    ctx.moveTo(b.x+30,b.y-88); ctx.lineTo(b.x+58,b.y-80); ctx.lineTo(b.x+30,b.y-72);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(b.x+30,b.y-88); ctx.lineTo(b.x+30,b.y-52); ctx.stroke();
  }
  if(G){
    const w=110,h=9,r=G.baseHp[side]/BASE_HP;
    const x=b.x-w/2, y=barY;
    ctx.fillStyle='rgba(0,0,0,.5)';
    rrectPath(x-2,y-2,w+4,h+4,5); ctx.fill();
    ctx.fillStyle=side?'#e04a3a':'#2fbf57';
    ctx.fillRect(x,y,w*r,h);
  }
}
function drawBuilding(u,p,st){
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(p.x,p.y+4,42,12,0,0,TAU); ctx.fill();
  ctx.save();
  ctx.translate(p.x,p.y);
  if(u.dying){const k=Math.min(1,u.dying/0.45);ctx.globalAlpha=1-k;}
  const col=u.side?'red':'blue';
  const M=ASSETS.mech&&ASSETS.mech[col];
  if(st.bk==='tower'&&M&&M.tower_base){
    const w=64,h=w*M.tower_base.height/M.tower_base.width;
    ctx.drawImage(M.tower_base,-w/2,-h+14,w,h);
    const gimg=M.tower_gun;
    if(gimg){
      const n=Math.round(gimg.width/gimg.height), cell=gimg.height;
      const fi=u.atkT<n*0.07?Math.min(n-1,Math.floor(u.atkT/0.07)):0;
      const gw=64;
      ctx.save();
      if(u.side)ctx.scale(-1,1);
      /* 炮管坐落在底座顶部的圆盘中心（底座高 h，圆盘中心约在 0.30h 处） */
      ctx.drawImage(gimg,fi*cell,0,cell,cell,-gw/2,-h+Math.round(h*0.36)-gw*0.5,gw,gw);
      ctx.restore();
    }
  }else if(st.bk==='workshop'&&M&&M.factory){
    const w=68,h=w*M.factory.height/M.factory.width;
    ctx.drawImage(M.factory,-w/2,-h+14,w,h);
  }else if(st.bk==='barricade'){
    /* 机械路障：金属基座 + 能量护栏 */
    const en=u.side?'rgba(255,110,90,':'rgba(120,200,255,';
    ctx.fillStyle='#2b323d';
    for(const bx of [-58,58]){ctx.fillRect(bx-8,-30,16,34);}
    ctx.fillStyle='#454f5e';
    for(const bx of [-58,58]){ctx.fillRect(bx-10,-34,20,7);}
    ctx.fillStyle='#39414f';
    ctx.fillRect(-58,-26,116,8);
    ctx.fillRect(-58,-12,116,8);
    const pulse=0.45+0.25*Math.sin((G?G.t:0)*4+u.s*0.05);
    ctx.fillStyle=en+pulse.toFixed(2)+')';
    ctx.fillRect(-58,-24,116,4);
    ctx.fillRect(-58,-10,116,4);
    ctx.fillStyle=en+'0.9)';
    for(const bx of [-58,58]){ctx.fillRect(bx-3,-33,6,4);}
  }else{
    const img=(ASSETS.bldg&&ASSETS.bldg[col])?ASSETS.bldg[col][st.bk==='tower'?'tower':'house']:null;
    if(img){
      const w=st.bk==='tower'?64:78, h=w*img.height/img.width;
      ctx.drawImage(img,-w/2,-h+10,w,h);
    }else{
      ctx.font=em(44);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(st.emoji,0,-18);
    }
  }
  ctx.restore();
  if(!u.dying){
    const w=64,h=6,r=Math.max(0,u.hp/u.max);
    const by=st.bk==='tower'?128:(st.bk==='workshop'?126:52);
    ctx.fillStyle='rgba(0,0,0,.45)';
    ctx.fillRect(p.x-w/2-1,p.y-by,w+2,h+2);
    ctx.fillStyle=u.side?'#ff5a5a':'#43d675';
    ctx.fillRect(p.x-w/2,p.y-by+1,w*r,h);
    if(u.type==='b_workshop'){
      const t='+'+Math.round(wsYield(u))+'/秒';
      const ty=p.y-by-14;
      ctx.font='bold 13px system-ui,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(20,20,20,.7)';
      ctx.strokeText(t,p.x,ty);
      ctx.fillStyle='#ffd76a';ctx.fillText(t,p.x,ty);
    }
  }
}
/* 机械单位：帧尺寸随动画不同（例如 Droid01 射击帧 48px、待机 32px），
   按 每源像素固定屏幕尺寸(mpx) 缩放并底部对齐，保证机体大小一致 */
function drawMechUnit(u,p,st,dir){
  const set=ASSETS.mech[u.side?'red':'blue'];
  const runImg=set[st.mech+'_run'];
  if(!runImg)return false;
  const atkImg=set[st.mech+'_atk'], idleImg=set[st.mech+'_idle'];
  const px=st.mpx||1.3;
  let img,fi;
  const aFr=atkImg?Math.round(atkImg.width/atkImg.height):0;
  if(atkImg&&u.atkT<aFr*0.055){
    img=atkImg;
    fi=Math.min(aFr-1,Math.floor(u.atkT/0.055));
  }else if(u.moving){
    img=runImg;
    const n=Math.round(img.width/img.height);
    fi=Math.floor(u.animT*10)%n;
  }else{
    img=idleImg||runImg;
    const n=Math.round(img.width/img.height);
    fi=((Math.floor((G?G.t:0)*8+u.off))%n+n)%n;
  }
  if(p.tx*dir<-0.05)ctx.scale(-1,1);
  const cell=img.height, dw=cell*px;
  ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw+8,dw,dw);
  return true;
}
function drawUnit(u,p){
  const st=UNITS[u.type], dir=u.side?-1:1;
  if(st.cls==='bldg'){drawBuilding(u,p,st);return;}
  ctx.fillStyle='rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(p.x,p.y+3,13,5,0,0,TAU); ctx.fill();
  ctx.strokeStyle=u.side?'rgba(255,64,64,.75)':'rgba(46,125,255,.75)';
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(p.x,p.y+3,13,5,0,0,TAU); ctx.stroke();
  if(st.era===2){
    ctx.strokeStyle='rgba(255,215,106,.9)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(p.x,p.y+3,16,6.5,0,0,TAU); ctx.stroke();
  }
  ctx.save();
  ctx.translate(p.x+p.tx*dir*u.lunge*10, p.y+p.ty*dir*u.lunge*10);
  if(u.dying){
    const k=Math.min(1,u.dying/0.45);
    ctx.globalAlpha=1-k;
    ctx.rotate(dir*k*1.5);
  }else if(u.moving){
    ctx.translate(0,-Math.abs(Math.sin(u.walk))*3.5);
  }
  const gobSheet=st.gob?(ASSETS.gob[(G&&G.stage)?G.stage.gobColor:'red']||{})[st.gob]:null;
  const set=st.ts?ASSETS.ts[unitColor(u.side,st)]:null;
  const runImg=set?set[TS_UNITS[st.ts].run]:null;
  if(st.mech&&drawMechUnit(u,p,st,dir)){
    /* 机械单位已绘制 */
  }else if(gobSheet){
    const meta=GOB_META[st.gob];
    let row,n,fi;
    if(u.atkT<meta.atk[1]*0.1){row=meta.atk[0];n=meta.atk[1];fi=Math.min(n-1,Math.floor(u.atkT*10));}
    else if(u.moving){row=meta.run[0];n=meta.run[1];fi=Math.floor(u.animT*10)%n;}
    else{row=meta.idle[0];n=meta.idle[1];fi=((Math.floor((G?G.t:0)*8+u.off))%n+n)%n;}
    if(p.tx*dir<-0.05)ctx.scale(-1,1);
    const dw=66;
    ctx.drawImage(gobSheet,fi*192,row*192,192,192,-dw/2,-dw*0.74,dw,dw);
  }else if(runImg){
    const atkImg=set[TS_UNITS[st.ts].atk], idleImg=set[TS_UNITS[st.ts].idle];
    let img,fi;
    const aFr=atkImg?Math.round(atkImg.width/atkImg.height):0;
    if(atkImg&&u.atkT<aFr*0.1){
      img=atkImg;
      fi=Math.min(aFr-1,Math.floor(u.atkT*10));
    }else if(u.moving){
      img=runImg;
      const n=Math.round(img.width/img.height);
      fi=Math.floor(u.animT*10)%n;
    }else{
      img=idleImg||runImg;
      const n=Math.round(img.width/img.height);
      fi=((Math.floor((G?G.t:0)*8+u.off))%n+n)%n;
    }
    if(p.tx*dir<-0.05)ctx.scale(-1,1);
    const cell=img.height;
    const dw=68*cell/192;
    ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw*0.74,dw,dw);
  }else{
    if(p.tx*dir>0.05)ctx.scale(-1,1);
    ctx.font=em(38);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(st.emoji,0,-16);
  }
  ctx.restore();
  if(!u.dying){
    const w=34,h=5,r=Math.max(0,u.hp/u.max);
    /* 血条跟随精灵实际高度：机械单位按 mpx 缩放，高度差异很大 */
    let by=45;
    if(st.mech){
      /* 用内容高度而非图集格高，否则血条会飘到单位头顶很远的空白处 */
      const mm=MECH_META[st.mech];
      if(mm)by=Math.round(mm.ch*(st.mpx||1.3))+7;
    }
    ctx.fillStyle='rgba(0,0,0,.45)';
    ctx.fillRect(p.x-w/2-1,p.y-by,w+2,h+2);
    ctx.fillStyle=u.side?'#ff5a5a':'#43d675';
    ctx.fillRect(p.x-w/2,p.y-by+1,w*r,h);
    if(u.star){
      ctx.font=em(13);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⭐',p.x+22,p.y-by-1);
    }
  }
}
function drawTurretBody(x,y,ang,flash){
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(0,5,24,10,0,0,TAU); ctx.fill();
  ctx.fillStyle='#191c24';
  ctx.beginPath(); ctx.arc(0,0,21,0,TAU); ctx.fill();
  ctx.fillStyle='#2c313d';
  ctx.beginPath(); ctx.arc(0,0,16,0,TAU); ctx.fill();
  ctx.fillStyle='#0d0f14';
  for(let i=0;i<6;i++){
    const a=i/6*TAU;
    ctx.beginPath(); ctx.arc(Math.cos(a)*18.5,Math.sin(a)*18.5,2,0,TAU); ctx.fill();
  }
  ctx.rotate(ang);
  const rec=flash*5;
  ctx.fillStyle='#14161c'; ctx.fillRect(6-rec,-6,26,12);
  ctx.fillStyle='#3a3f4d'; ctx.fillRect(6-rec,-6,26,3);
  ctx.fillStyle='#05070a'; ctx.fillRect(28-rec,-7,7,14);
  if(flash>0.5){
    ctx.fillStyle='rgba(255,220,120,'+(flash-0.5).toFixed(2)+')';
    ctx.beginPath(); ctx.arc(38-rec,0,10*flash,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawTurret(t){
  ctx.strokeStyle='rgba(25,28,36,0.22)'; ctx.lineWidth=2; ctx.setLineDash([5,9]);
  ctx.beginPath(); ctx.arc(t.x,t.y,TURRET.range,0,TAU); ctx.stroke();
  ctx.setLineDash([]);
  drawTurretBody(t.x,t.y,t.ang,t.flash);
  const r=clamp(t.life/TURRET.life,0,1);
  ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(t.x,t.y,25,-Math.PI/2,-Math.PI/2+TAU*r); ctx.stroke();
}
function drawFlag(f){
  const p=pathPos(f.s);
  const col=f.owner===0?'#2e7dff':f.owner===1?'#ff4040':'#cfcfcf';
  if(Math.abs(f.prog)<1){
    ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(p.x,p.y,16,0,TAU); ctx.stroke();
    ctx.strokeStyle=f.prog>=0?'#2e7dff':'#ff4040';
    ctx.beginPath(); ctx.arc(p.x,p.y,16,-Math.PI/2,-Math.PI/2+TAU*Math.abs(f.prog)); ctx.stroke();
  }
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(p.x,p.y+2,10,4,0,0,TAU); ctx.fill();
  ctx.strokeStyle='#6a4a28'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x,p.y-40); ctx.stroke();
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(p.x,p.y-40); ctx.lineTo(p.x+24,p.y-32); ctx.lineTo(p.x,p.y-24);
  ctx.closePath(); ctx.fill();
}
function drawProj(p){
  ctx.save();
  ctx.translate(p.x,p.y);
  if(p.kind==='shell'){
    ctx.fillStyle='#14161c';
    ctx.beginPath(); ctx.arc(0,0,6,0,TAU); ctx.fill();
    ctx.strokeStyle='#4a5060'; ctx.lineWidth=2; ctx.stroke();
    ctx.restore();
    return;
  }
  /* 机械激光弹道 */
  if(p.kind==='laser_a'||p.kind==='laser_b'||p.kind==='laser_t'){
    const MM=ASSETS.mech&&ASSETS.mech[p.side?'red':'blue'];
    const key=p.kind==='laser_a'?'proj_a':(p.kind==='laser_b'?'proj_b':'proj_tower');
    const img=MM&&MM[key];
    if(img){
      ctx.rotate(p.ang);
      if(p.kind==='laser_t'){
        /* 66x40 是 3 帧非方形表（每帧 22x40），不能套用 cell=height 的切法 */
        const n=3, cw=Math.floor(img.width/n), ch=img.height;
        const fi=Math.floor((G?G.t:0)*12)%n;
        const dh=30, dw=dh*cw/ch;
        ctx.rotate(Math.PI/2);
        ctx.drawImage(img,fi*cw,0,cw,ch,-dw/2,-dh/2,dw,dh);
      }else{
        const cell=img.height, n=Math.round(img.width/cell);
        const fi=Math.floor((G?G.t:0)*14)%n;
        const dw=30;
        ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw/2,dw,dw);
      }
      ctx.restore();
      return;
    }
    ctx.rotate(p.ang);
    ctx.fillStyle=p.side?'#ff8a6a':'#7ad4ff';
    ctx.fillRect(-9,-2.5,18,5);
    ctx.restore();
    return;
  }
  const M=ASSETS.ts.misc;
  if(M&&M.arrow&&p.kind==='arrow'){
    ctx.rotate(p.ang);
    ctx.drawImage(M.arrow,-17,-17,34,34);
    ctx.restore();
    return;
  }
  if(M&&M.dynamite&&p.kind==='dynamite'){
    ctx.rotate((p.x+p.y)*0.04);
    const fi=Math.floor((G?G.t:0)*10)%6;
    ctx.drawImage(M.dynamite,fi*64,0,64,64,-16,-16,32,32);
    ctx.restore();
    return;
  }
  if(p.kind==='arrow'){
    ctx.rotate(p.ang);
    ctx.strokeStyle='#5a3a17'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(8,0); ctx.stroke();
    ctx.fillStyle='#e8e2d0';
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(5,-3.5); ctx.lineTo(5,3.5);
    ctx.closePath(); ctx.fill();
  }else{
    ctx.fillStyle='rgba(183,107,255,.35)';
    ctx.beginPath(); ctx.arc(0,0,11,0,TAU); ctx.fill();
    ctx.fillStyle='#c78bff';
    ctx.beginPath(); ctx.arc(0,0,6,0,TAU); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(0,0,2.5,0,TAU); ctx.fill();
  }
  ctx.restore();
}
function drawFloat(f){
  ctx.globalAlpha=clamp(f.a,0,1);
  ctx.font='bold '+(f.sz||22)+'px system-ui,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.lineWidth=4; ctx.strokeStyle='rgba(20,20,20,.8)';
  ctx.strokeText(f.txt,f.x,f.y);
  ctx.fillStyle=f.c||'#ffd76a';
  ctx.fillText(f.txt,f.x,f.y);
  ctx.globalAlpha=1;
}
/* ---------------- 天气可视化（屏幕空间：色调 + 粒子） ---------------- */
let WPARTS=[], wpKind='';
function drawWeather(){
  const w=G.weather;
  if(!w)return;
  if(w.tint){
    ctx.fillStyle=w.tint;
    ctx.fillRect(0,0,cssW,cssH);
  }
  if(!w.part){WPARTS=[];wpKind='';return;}
  if(wpKind!==w.part){
    wpKind=w.part;
    WPARTS=[];
    for(let i=0;i<70;i++)WPARTS.push({x:Math.random()*cssW,y:Math.random()*cssH,v:0.5+Math.random()});
  }
  if(w.part==='snow'){
    ctx.fillStyle='rgba(255,255,255,0.8)';
    for(const p of WPARTS){
      p.y+=p.v*0.9; p.x+=Math.sin(p.y*0.02)*0.4;
      if(p.y>cssH){p.y=-4;p.x=Math.random()*cssW;}
      ctx.fillRect(p.x,p.y,2.5,2.5);
    }
  }else if(w.part==='rain'){
    ctx.strokeStyle='rgba(180,200,255,0.45)';
    ctx.lineWidth=1.5;
    ctx.beginPath();
    for(const p of WPARTS){
      p.y+=p.v*8; p.x-=p.v*1.6;
      if(p.y>cssH){p.y=-10;p.x=Math.random()*(cssW+80);}
      ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+2.5,p.y+10);
    }
    ctx.stroke();
  }else if(w.part==='storm'){
    /* 沙暴：横向疾走的沙粒 */
    ctx.fillStyle='rgba(225,195,130,0.55)';
    for(const p of WPARTS){
      p.x-=p.v*9; p.y+=Math.sin(p.x*0.03)*0.8;
      if(p.x<-6){p.x=cssW+6;p.y=Math.random()*cssH;}
      ctx.fillRect(p.x,p.y,7,2);
    }
  }
}
function drawMinimap(){
  const mw=64, mh=Math.round(mw*WORLD_H/WORLD_W);
  const mx=cssW-mw-10-safeR, my=Math.max(52,(cssH-mh)/2);
  const k=mw/WORLD_W;
  mmRect={x:mx,y:my,w:mw,h:mh,k};
  ctx.fillStyle='rgba(43,30,16,.8)';
  rrectPath(mx-4,my-4,mw+8,mh+8,8); ctx.fill();
  ctx.strokeStyle='#8a6b45'; ctx.lineWidth=3; ctx.stroke();
  ctx.strokeStyle='#c2a36b'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath();
  for(let i=0;i<PATH.table.length;i+=6){
    const p=PATH.table[i];
    if(i===0)ctx.moveTo(mx+p.x*k,my+p.y*k);
    else ctx.lineTo(mx+p.x*k,my+p.y*k);
  }
  const pe=PATH.table[PATH.table.length-1];
  ctx.lineTo(mx+pe.x*k,my+pe.y*k);
  ctx.stroke();
  ctx.fillStyle='#2e7dff';
  ctx.beginPath(); ctx.arc(mx+BASE0.x*k,my+BASE0.y*k,4,0,TAU); ctx.fill();
  ctx.fillStyle='#ff4040';
  ctx.beginPath(); ctx.arc(mx+BASE1.x*k,my+BASE1.y*k,4,0,TAU); ctx.fill();
  if(G)for(const f of G.flags){
    const p=pathPos(f.s);
    ctx.fillStyle=f.owner===0?'#2e7dff':f.owner===1?'#ff4040':'#e5d9a8';
    ctx.fillRect(mx+p.x*k-2,my+p.y*k-2,4,4);
  }
  if(G)for(const u of G.units){
    if(u.dying)continue;
    const p=pathPos(u.s);
    ctx.fillStyle=u.side?'#ff8080':'#7db3ff';
    ctx.fillRect(mx+p.x*k-1.5,my+p.y*k-1.5,3,3);
  }
  const vw=Math.min(cssW/cam.z*k,mw), vh=Math.min(cssH/cam.z*k,mh);
  const rx=clamp(mx+cam.x*k-vw/2,mx,mx+mw-vw), ry=clamp(my+cam.y*k-vh/2,my,my+mh-vh);
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1;
  ctx.strokeRect(rx,ry,vw,vh);
}

function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#48632f';
  ctx.fillRect(0,0,cssW,cssH);
  let sx=0, sy=0;
  if(G&&G.shake>0){sx=rand(-6,6)*G.shake;sy=rand(-6,6)*G.shake;}
  const z=cam.z;
  ctx.setTransform(dpr*z,0,0,dpr*z,dpr*(cssW/2-(cam.x+sx)*z),dpr*(cssH/2-(cam.y+sy)*z));
  ctx.drawImage(ground,0,0);
  const vx0=cam.x-cssW/2/z-60, vx1=cam.x+cssW/2/z+60;
  const vy0=cam.y-cssH/2/z-80, vy1=cam.y+cssH/2/z+80;
  const spr=[];
  for(const d of DECOS)
    if(d.x>vx0&&d.x<vx1&&d.y>vy0&&d.y<vy1)spr.push({y:d.y,k:0,o:d,p:null});
  spr.push({y:BASE0.y,k:1,o:0,p:null},{y:BASE1.y,k:1,o:1,p:null});
  if(G)for(const f of G.flags){
    const fp=pathPos(f.s);
    if(fp.x>vx0&&fp.x<vx1&&fp.y>vy0&&fp.y<vy1)spr.push({y:fp.y,k:3,o:f,p:null});
  }
  if(G)for(const t of G.turrets){
    if(t.x>vx0&&t.x<vx1&&t.y>vy0&&t.y<vy1)spr.push({y:t.y,k:4,o:t,p:null});
  }
  if(G)for(const u of G.units){
    const p=unitPos(u);
    if(p.x>vx0&&p.x<vx1&&p.y>vy0&&p.y<vy1)spr.push({y:p.y,k:2,o:u,p});
  }
  spr.sort((a,b)=>a.y-b.y);
  for(const s of spr){
    if(s.k===0)drawDeco(s.o);
    else if(s.k===1)drawBase(s.o);
    else if(s.k===3)drawFlag(s.o);
    else if(s.k===4)drawTurret(s.o);
    else drawUnit(s.o,s.p);
  }
  if(placing&&placePos&&G&&mode==='play'){
    if(placingType==='turret'){
      ctx.globalAlpha=0.55;
      drawTurretBody(placePos.x,placePos.y,-Math.PI/2,0);
      ctx.globalAlpha=1;
      ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=2; ctx.setLineDash([8,8]);
      ctx.beginPath(); ctx.arc(placePos.x,placePos.y,TURRET.range,0,TAU); ctx.stroke();
      ctx.setLineDash([]);
    }else{
      /* 建筑虚影：吸附到道路中心，绿=可建 红=不可建 */
      const P=PLACEABLES[placingType];
      const pr=nearestPath(placePos.x,placePos.y);
      const ok=pr&&pr.d<=76*pr.wf&&pr.sep<=5&&pr.s<=L-260;
      const gp=pr?pathPos(pr.s):placePos;
      ctx.globalAlpha=0.65;
      ctx.font=em(46);ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(P.emoji,gp.x,gp.y-20);
      ctx.globalAlpha=1;
      ctx.strokeStyle=ok?'rgba(120,255,140,.85)':'rgba(255,90,90,.85)';
      ctx.lineWidth=3;ctx.setLineDash([6,6]);
      ctx.beginPath();ctx.arc(gp.x,gp.y,34,0,TAU);ctx.stroke();
      ctx.setLineDash([]);
      if(placingType==='tower'){
        ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=2;ctx.setLineDash([8,8]);
        ctx.beginPath();ctx.arc(gp.x,gp.y,UNITS.b_tower.range,0,TAU);ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  if(G){
    for(const p of G.projs)drawProj(p);
    for(const pl of G.piles){
      const pp=pathPos(pl.s);
      ctx.font=em(28+Math.sin(G.t*6)*3);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('💰',pp.x,pp.y-12);
    }
    const EX=ASSETS.ts.misc.explosion;
    if(EX){
      const n=Math.round(EX.width/EX.height), cell=EX.height;
      for(const bm of G.booms){
        if(bm.t<0)continue;
        const fi=Math.min(n-1,Math.floor(bm.t*10));
        ctx.drawImage(EX,fi*cell,0,cell,cell,bm.x-55,bm.y-66,110,110);
      }
    }
    for(const f of G.floats)drawFloat(f);
    /* PvP 表情气泡（世界坐标，城堡旁弹出） */
    if(G.emotes){
      for(const eb of G.emotes)eb.t+=1/60;
      G.emotes=G.emotes.filter(x=>x.t<2.6);
      for(const eb of G.emotes){
        const k=eb.t<0.22?eb.t/0.22:1;
        const a=eb.t>2.1?Math.max(0,(2.6-eb.t)/0.5):1;
        const y=eb.y-eb.t*10;
        ctx.globalAlpha=a;
        ctx.fillStyle='#fdf6e3';
        ctx.strokeStyle='#a97f4b';
        ctx.lineWidth=3;
        rrectPath(eb.x-26*k,y-26*k,52*k,52*k,10*k);
        ctx.fill();ctx.stroke();
        ctx.font=em(34*k);
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(eb.e,eb.x,y+2);
      }
      ctx.globalAlpha=1;
    }
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(G)drawWeather();
  drawMinimap();
  if(G&&G.banner){
    const k=clamp(G.banner.a,0,1);
    ctx.globalAlpha=k;
    ctx.font='bold '+Math.round(30+(1.6-G.banner.a)*8)+'px system-ui,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.lineWidth=6; ctx.strokeStyle='rgba(20,10,0,.75)';
    ctx.strokeText(G.banner.txt,cssW/2,cssH*0.3);
    ctx.fillStyle='#ffd76a';
    ctx.fillText(G.banner.txt,cssW/2,cssH*0.3);
    ctx.globalAlpha=1;
  }
  if(G&&G.flash>0){
    ctx.fillStyle='rgba(255,220,130,'+(0.35*G.flash).toFixed(3)+')';
    ctx.fillRect(0,0,cssW,cssH);
  }
}
