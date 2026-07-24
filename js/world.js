'use strict';
/* ---------------- 战场世界（每关随机生成：S路 / 岔路 / 隘口 / 哨站） ---------------- */
const WORLD_W=1200;
const FORK_SEP=112;
let WORLD_H=2000;
let PATH=null, L=0, BASE0=null, BASE1=null, DECOS=[], CUR_DEF=null;

/* 生成一张战场定义：控制点(左右交替的S型)、岔路(占L的比例区间)、隘口、哨站 */
function genMapDef(opts){
  opts=opts||{};
  const H=opts.short?1450:2000;
  const n=opts.short?4:(5+(Math.random()<0.4?1:0));
  const ctrl=[];
  let left=Math.random()<0.5;
  for(let i=0;i<n;i++){
    const t=i/(n-1);
    const y=(H-320)*(1-t)+320+((i>0&&i<n-1)?rand(-50,50):0);
    const x=left?rand(300,440):rand(760,900);
    ctrl.push([x,y]);
    left=!left;
  }
  const forks=[];
  if(!opts.short&&!opts.noFork){
    if(Math.random()<0.55){const a=rand(0.2,0.36);forks.push({a,b:a+rand(0.15,0.2)});}
    if(Math.random()<0.25){const a=rand(0.58,0.7);forks.push({a,b:a+rand(0.13,0.17)});}
  }
  const inFork=t=>forks.some(f=>t>f.a-0.06&&t<f.b+0.06);
  const chokes=[];
  for(let k=0;k<12&&chokes.length<2;k++){
    const c=rand(0.18,0.82);
    if(!inFork(c)&&!chokes.some(x=>Math.abs(x.c-c)<0.15))chokes.push({c,w:rand(0.06,0.09)});
  }
  const flags=[];
  for(let k=0;k<20&&flags.length<2;k++){
    const f=rand(0.24,0.76);
    if(!inFork(f)&&!flags.some(x=>Math.abs(x-f)<0.2))flags.push(f);
  }
  while(flags.length<2)flags.push(flags.length?clamp(flags[0]+0.3,0.2,0.8):0.35);
  return {ctrl,H,forks,chokes,flags};
}

function buildPath(def){
  const raw=[], P=[def.ctrl[0],...def.ctrl,def.ctrl[def.ctrl.length-1]];
  for(let i=0;i<P.length-3;i++){
    const p0=P[i],p1=P[i+1],p2=P[i+2],p3=P[i+3];
    for(let t=0;t<1;t+=0.02){
      const t2=t*t,t3=t2*t;
      raw.push([
        0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
      ]);
    }
  }
  raw.push([def.ctrl[def.ctrl.length-1][0],def.ctrl[def.ctrl.length-1][1]]);
  const cum=[0];
  for(let i=1;i<raw.length;i++)
    cum.push(cum[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]));
  const total=cum[cum.length-1], STEP=6, table=[];
  let j=0;
  for(let s=0;s<=total;s+=STEP){
    while(j<raw.length-2&&cum[j+1]<s)j++;
    const seg=cum[j+1]-cum[j]||1e-6, k=(s-cum[j])/seg;
    table.push({
      x:raw[j][0]+(raw[j+1][0]-raw[j][0])*k,
      y:raw[j][1]+(raw[j+1][1]-raw[j][1])*k,
      tx:(raw[j+1][0]-raw[j][0])/seg,
      ty:(raw[j+1][1]-raw[j][1])/seg,
    });
  }
  /* 隘口收窄系数 wf + 岔路分离度 sep */
  for(let i=0;i<table.length;i++){
    const t=(i*STEP)/total;
    let wf=1;
    for(const k of def.chokes)wf-=0.42*Math.exp(-Math.pow((t-k.c)/k.w,2));
    let sep=0;
    for(const f of def.forks){
      if(t>f.a&&t<f.b){
        const e=clamp(Math.min(t-f.a,f.b-t)/0.045,0,1);
        sep=Math.max(sep,FORK_SEP*e*e*(3-2*e));
        wf=1;
      }
    }
    table[i].wf=clamp(wf,0.55,1);
    table[i].sep=sep;
  }
  return {table,STEP,L:total};
}

function pathPos(s){
  s=clamp(s,0,L);
  const f=s/PATH.STEP, i=Math.min(PATH.table.length-1,Math.floor(f)), k=f-i;
  const a=PATH.table[i], b=PATH.table[Math.min(PATH.table.length-1,i+1)];
  return {x:a.x+(b.x-a.x)*k, y:a.y+(b.y-a.y)*k, tx:a.tx, ty:a.ty, nx:-a.ty, ny:a.tx,
          wf:a.wf+(b.wf-a.wf)*k, sep:a.sep+(b.sep-a.sep)*k};
}

/* ---------------- 装饰物 ---------------- */
function genDecos(){
  const list=[], pool=['🌲','🌳','🌲','🌿','🪨','🌼','🍄','🌾'];
  let tries=0;
  while(list.length<70&&tries<900){
    tries++;
    const x=rand(60,WORLD_W-60), y=rand(80,WORLD_H-80);
    let ok=true;
    for(let i=0;i<PATH.table.length;i+=4){
      const p=PATH.table[i], dx=p.x-x, dy=p.y-y;
      const rr=135+p.sep;
      if(dx*dx+dy*dy<rr*rr){ok=false;break;}
    }
    if(!ok)continue;
    if(Math.hypot(x-BASE0.x,y-BASE0.y)<140||Math.hypot(x-BASE1.x,y-BASE1.y)<140)continue;
    list.push({x,y,e:pool[(Math.random()*pool.length)|0],di:(Math.random()*8)|0,s:rand(26,44)});
  }
  return list;
}

/* ---------------- 地面离屏缓存 ---------------- */
const ground=document.createElement('canvas');
function paintGround(){
  if(!PATH)return;
  const g=ground.getContext('2d');
  g.imageSmoothingEnabled=false;
  const Pimg=ASSETS.img.props;
  if(Pimg){
    const t=document.createElement('canvas'); t.width=48; t.height=32;
    const tc=t.getContext('2d');
    for(let i=0;i<6;i++)tc.drawImage(Pimg,(9+i)*16,0,16,16,(i%3)*16,((i/3)|0)*16,16,16);
    const pat=g.createPattern(t,'repeat');
    g.save(); g.scale(2,2); g.fillStyle=pat; g.fillRect(0,0,WORLD_W/2,WORLD_H/2); g.restore();
  }else{
    g.fillStyle='#7db958'; g.fillRect(0,0,WORLD_W,WORLD_H);
  }
  for(let i=0;i<140;i++){
    g.fillStyle=Math.random()<0.5?'rgba(255,255,255,0.05)':'rgba(40,90,20,0.07)';
    g.beginPath();
    g.ellipse(rand(0,WORLD_W),rand(0,WORLD_H),rand(30,90),rand(20,60),rand(0,3.14),0,TAU);
    g.fill();
  }
  /* 道路：1/4 分辨率像素化；岔路区画双车道 */
  const RS=4;
  const rc=document.createElement('canvas');
  rc.width=Math.ceil(WORLD_W/RS); rc.height=Math.ceil(WORLD_H/RS);
  const r=rc.getContext('2d');
  r.scale(1/RS,1/RS);
  r.lineCap='round'; r.lineJoin='round';
  for(const pass of [['#8a6b45',160,100],['#c2a36b',144,86]]){
    r.strokeStyle=pass[0];
    for(let i=0;i<PATH.table.length-2;i+=2){
      const a=PATH.table[i], b=PATH.table[i+2];
      if(a.sep<6&&b.sep<6){
        r.lineWidth=pass[1]*((a.wf+b.wf)/2);
        r.beginPath(); r.moveTo(a.x,a.y); r.lineTo(b.x,b.y); r.stroke();
      }else{
        r.lineWidth=pass[2];
        for(const sgn of [-1,1]){
          r.beginPath();
          r.moveTo(a.x-a.ty*sgn*a.sep/2, a.y+a.tx*sgn*a.sep/2);
          r.lineTo(b.x-b.ty*sgn*b.sep/2, b.y+b.tx*sgn*b.sep/2);
          r.stroke();
        }
      }
    }
  }
  r.setLineDash([18,26]); r.strokeStyle='rgba(255,255,255,0.35)'; r.lineWidth=6;
  r.beginPath();
  let pen=false;
  for(let i=0;i<PATH.table.length;i++){
    const p=PATH.table[i];
    if(p.sep<6){
      if(!pen){r.moveTo(p.x,p.y);pen=true;}
      else r.lineTo(p.x,p.y);
    }else pen=false;
  }
  r.stroke(); r.setLineDash([]);
  for(const b of [BASE0,BASE1]){
    r.fillStyle='#c2a36b'; r.beginPath(); r.arc(b.x,b.y,86,0,TAU); r.fill();
    r.strokeStyle='#8a6b45'; r.lineWidth=8; r.stroke();
  }
  g.imageSmoothingEnabled=false;
  g.drawImage(rc,0,0,WORLD_W,WORLD_H);
}

/* 重建整个战场世界（每关调用一次） */
function buildWorld(def){
  CUR_DEF=def||genMapDef({noFork:true});
  WORLD_H=CUR_DEF.H;
  PATH=buildPath(CUR_DEF);
  L=PATH.L;
  BASE0=pathPos(0);
  BASE1=pathPos(L);
  DECOS=genDecos();
  ground.width=WORLD_W;
  ground.height=WORLD_H;
  paintGround();
}
buildWorld(null);
