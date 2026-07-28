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
  const era2=G&&(side?G.aiEra:G.era)>=2;
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
      /* 等级角标敌我双方都可见——对手要能看出哪座是高价值目标，赌注才成立 */
      const lv=u.wlv||1;
      const t=u.recT?'♻️ 回收中':('+'+Math.round(wsYield(u))+'/秒'+(lv>1?(lv===2?' Ⅱ':' Ⅲ'):''));
      const ty=p.y-by-14;
      ctx.font='bold 13px system-ui,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=3;ctx.strokeStyle='rgba(20,20,20,.7)';
      ctx.strokeText(t,p.x,ty);
      ctx.fillStyle=u.recT?'#9fe8a0':(lv>=3?'#ffb347':'#ffd76a');ctx.fillText(t,p.x,ty);
    }
  }
}
/* 哥布林配色：单人关卡由 stage 统一指定（精英/BOSS 全紫）；
   PvP 军阀阵营下 stage 不指定，按兵种时代分色——时代 II = 紫色精英，
   与骑士团"黑铁换装"同一口径。敌我区分靠脚下椭圆描边，不占用配色维度。 */
function gobColorOf(st){
  if(st.era===2)return 'purple';   /* 时代 II 恒为紫色精英：这是军阀的换装身份，不该被关卡配色盖掉 */
  const g=G&&G.stage&&G.stage.gobColor;
  return g||'red';
}
/* 机械单位：帧尺寸随动画不同（例如 Droid01 射击帧 48px、待机 32px），
   按 每源像素固定屏幕尺寸(mpx) 缩放并底部对齐，保证机体大小一致 */
/* dir=推进方向（用于冲刺位移），fdir=朝向（守备队后撤归位时与推进方向相反） */
function drawMechUnit(u,p,st,fdir){
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
  if(p.tx*fdir<-0.05)ctx.scale(-1,1);
  const cell=img.height, dw=cell*px;
  ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw+8,dw,dw);
  return true;
}
function tankFrame(key,t,dur,loop){
  const meta=HERO_TANK_ANIMS[key], n=meta?meta.frames:1;
  if(loop)return Math.floor(t/dur*n)%n;
  return Math.min(n-1,Math.floor(clamp(t/dur,0,0.999)*n));
}
/* CraftPix 坦克全部是 96×96 单行图。统一格底锚点，空投/维修特效只改局部坐标，
   不改精灵本体的基线，避免生成素材曾出现的逐帧抖动。 */
function drawHeroTank(u,p,st,fdir){
  let key='idle',fi=0,oy=0,gasKey='',gasFi=0;
  const hs=u.heroState||'', ht=u.heroStateT||0;
  if(hs==='airdrop'){
    const q=clamp(ht/HERO_TANK.dropDur,0,1), ease=1-Math.pow(1-q,3);
    oy=-190*(1-ease);
    const ca=clamp((0.92-q)/0.28,0,1);
    ctx.save();
    ctx.globalAlpha=ca;
    ctx.fillStyle='#c9e6a8';
    ctx.fillRect(-42,oy-86,84,8);ctx.fillRect(-34,oy-94,68,8);ctx.fillRect(-18,oy-102,36,8);
    ctx.fillStyle='#6f9c67';
    ctx.fillRect(-42,oy-80,84,4);ctx.fillRect(-4,oy-94,8,14);
    ctx.strokeStyle='rgba(225,240,205,.9)';ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(-37,oy-79);ctx.lineTo(-25,oy-28);
    ctx.moveTo(37,oy-79);ctx.lineTo(25,oy-28);
    ctx.moveTo(-5,oy-91);ctx.lineTo(-13,oy-28);
    ctx.moveTo(5,oy-91);ctx.lineTo(13,oy-28);
    ctx.stroke();
    ctx.restore();
    key='idle';fi=tankFrame(key,ht,0.72,true);
  }else if(hs==='startup'){
    const dust=clamp(1-ht/0.75,0,1);
    if(dust>0){
      ctx.save();ctx.globalAlpha=dust;ctx.fillStyle='#b9a27a';
      for(let i=0;i<7;i++){
        const a=i/7*TAU, r=(1-dust)*46+12;
        ctx.fillRect(Math.cos(a)*r-3,-4+Math.sin(a)*r*0.2,6,4);
      }
      ctx.restore();
    }
    key='turn';fi=tankFrame(key,ht,HERO_TANK.startupDur,false);
  }else if(hs==='repair_open'){
    key='moveOut';fi=tankFrame(key,ht,HERO_TANK.repairOpen,false);
  }else if(hs==='repair_loop'){
    key='special';fi=tankFrame(key,ht,HERO_TANK.repairLoop,true);
  }else if(hs==='repair_close'){
    key='moveIn';fi=tankFrame(key,ht,HERO_TANK.repairClose,false);
  }else if(u.dying){
    key='death';fi=tankFrame(key,u.dying,0.45,false);
  }else if(u.heroHurtT>0){
    key='hurt';fi=tankFrame(key,0.18-u.heroHurtT,0.18,false);
  }else{
    const at=u.atkT||9, a0=HERO_TANK.attackStart, a1=a0+HERO_TANK.attackCycle;
    const a2=a1+HERO_TANK.attackEnd;
    if(at<a0){gasKey='gasStart';gasFi=tankFrame(gasKey,at,a0,false);}
    else if(at<a1){gasKey='gasCycle';gasFi=tankFrame(gasKey,at-a0,HERO_TANK.attackCycle,true);}
    else if(at<a2){gasKey='gasEnd';gasFi=tankFrame(gasKey,at-a1,HERO_TANK.attackEnd,false);}
    if(gasKey){
      /* Gas_* 只有喷雾特效，不含车体：攻击时车体继续播放稳定的待机循环。 */
      key='idle';fi=tankFrame(key,(G?G.t:0)+(u.off||0)*0.03,0.75,true);
    }else if(u.moving){key='drive';fi=tankFrame(key,u.animT||0,0.7,true);}
    else{key='idle';fi=tankFrame(key,(G?G.t:0)+(u.off||0)*0.03,0.75,true);}
  }
  if(hs.startsWith('repair')){
    const pulse=0.45+0.25*Math.sin((G?G.t:0)*7);
    ctx.save();
    ctx.globalAlpha=pulse;ctx.strokeStyle='#59ff91';ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(0,2,34,10,0,0,TAU);ctx.stroke();
    ctx.fillStyle='#70ff9c';
    for(let i=0;i<3;i++){
      const t=(G?G.t:0)*0.55+i/3, py=-24-(t%1)*42, px=Math.sin(t*9+i)*30;
      ctx.globalAlpha=0.9-(t%1)*0.6;
      ctx.fillRect(px-2,py-7,4,14);ctx.fillRect(px-7,py-2,14,4);
    }
    ctx.restore();
  }
  if(p.tx*fdir<-0.05)ctx.scale(-1,1);
  const img=ASSETS.heroTank&&ASSETS.heroTank[key];
  if(!img)return false;
  const dw=112;
  if(gasKey){
    const gas=ASSETS.heroTank&&ASSETS.heroTank[gasKey];
    if(gas){
      /* 原特效从格子的左边缘向右生长；把该边缘对齐车体右侧炮口。
         先画毒雾再画车体，交界处由炮口覆盖，车身始终清晰可辨。 */
      ctx.drawImage(gas,gasFi*96,0,96,96,48,-93,dw,dw);
    }
  }
  ctx.drawImage(img,fi*96,0,96,96,-dw/2,-dw+8+oy,dw,dw);
  return true;
}
function rangerFrame(key,t,dur,loop){
  const meta=HERO_RANGER_ANIMS[key], n=meta?meta.frames:1;
  if(loop)return Math.floor(t/dur*n)%n;
  return Math.min(n-1,Math.floor(clamp(t/dur,0,0.999)*n));
}
/* 游隼原图为 72×72 单行图。入场实体始终停在城门战斗坐标，只在渲染层从画面外
   沿路线后方掠入；这样部署演出不会污染寻路、前线、碰撞与联机位置。 */
function drawHeroRanger(u,p,st,fdir){
  const hs=u.heroState||'', ht=u.heroStateT||0;
  let key='idle',fi=0,ox=0,oy=0;
  if(u.dying){
    key='death';fi=rangerFrame(key,u.dying,0.45,false);
  }else if(hs==='ranger_fly'){
    const q=clamp(ht/HERO_RANGER.flyDur,0,1), eased=1-Math.pow(1-q,4);
    const travel=780*(1-eased), dir=u.side?-1:1;
    ox=-p.tx*dir*travel;
    oy=-p.ty*dir*travel-86*(1-eased);
    key='retreat';fi=rangerFrame(key,ht,0.48,true);
  }else if(hs==='ranger_startup'){
    key='basic';fi=Math.floor(ht/0.07)%HERO_RANGER_ANIMS.basic.frames;
  }else if(hs==='ranger_volley'){
    key='volley';fi=rangerFrame(key,ht,HERO_RANGER.volleyDur,false);
  }else if(hs==='ranger_ram'){
    key='ram';fi=rangerFrame(key,ht,HERO_RANGER.ramDur,false);
  }else if(hs==='ranger_retreat'){
    key='retreat';fi=rangerFrame(key,ht,HERO_RANGER.retreatDur,false);
  }else if(u.heroHurtT>0){
    key='hurt';fi=rangerFrame(key,0.18-u.heroHurtT,0.18,false);
  }else if((u.atkT||9)<HERO_RANGER.basicDur){
    key='basic';fi=rangerFrame(key,u.atkT,HERO_RANGER.basicDur,false);
  }else if(u.moving){
    key='walk';fi=rangerFrame(key,u.animT||0,0.62,true);
  }else{
    key='idle';fi=rangerFrame(key,(G?G.t:0)+(u.off||0)*0.03,0.56,true);
  }
  ctx.translate(ox,oy);
  if(hs==='ranger_fly'){
    const q=clamp(ht/HERO_RANGER.flyDur,0,1), braking=q>=0.62;
    const screenDir=p.tx*fdir<0?-1:1;
    ctx.save();
    ctx.globalAlpha=0.45+0.25*Math.sin(ht*24);
    for(let i=0;i<(braking?7:4);i++){
      const d=52+i*(braking?10:13)+(Math.floor(ht*48+i*7)%7);
      ctx.fillStyle=i%2?'#76f6e6':'#d8ff75';
      ctx.fillRect(-screenDir*d,-43+(i%3)*5,screenDir*8,4);
    }
    ctx.restore();
  }
  if(hs==='ranger_startup'||hs==='ranger_retreat'){
    const pulse=0.65+0.25*Math.sin((G?G.t:0)*12);
    ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle='#76f6e6';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(0,-34,46,40,0,0,TAU);ctx.stroke();ctx.restore();
  }
  if(p.tx*fdir<-0.05)ctx.scale(-1,1);
  const img=ASSETS.heroRanger&&ASSETS.heroRanger[key];
  if(!img)return false;
  const dw=112;
  ctx.drawImage(img,fi*72,0,72,72,-dw/2,-dw+8,dw,dw);
  return true;
}
function drawUnit(u,p){
  const st=UNITS[u.type], dir=u.side?-1:1;
  const fdir=u.back?-dir:dir;   /* 守备队后撤归位时朝向反过来 */
  if(st.cls==='bldg'){drawBuilding(u,p,st);return;}
  const vr=u.vet?VET_RANKS[u.vet]:null;
  const hero=st.cls==='hero', ew=hero?25:13, eh=hero?8:5;
  const rangerFlying=st.heroRanger&&u.heroState==='ranger_fly';
  if(!rangerFlying){
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(p.x,p.y+3,ew,eh,0,0,TAU); ctx.fill();
    ctx.strokeStyle=u.side?'rgba(255,64,64,.75)':'rgba(46,125,255,.75)';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(p.x,p.y+3,ew,eh,0,0,TAU); ctx.stroke();
  }
  if(st.era===2){
    ctx.strokeStyle='rgba(255,215,106,.9)';
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(p.x,p.y+3,16,6.5,0,0,TAU); ctx.stroke();
  }
  if(st.era===3&&!rangerFlying){
    ctx.strokeStyle='rgba(65,244,209,.92)';
    ctx.lineWidth=2.5;
    ctx.beginPath();ctx.ellipse(p.x,p.y+3,30,10,0,0,TAU);ctx.stroke();
  }
  if(vr){
    /* 老兵脚下加一圈呼吸光环：即使精灵本身被挡住也能一眼认出场上的老兵 */
    const pl=0.75+0.25*Math.sin((G?G.t:0)*3.4+u.off);
    ctx.strokeStyle=vr.glow;
    ctx.globalAlpha=0.9*pl;
    ctx.lineWidth=vr.aura;
    ctx.beginPath(); ctx.ellipse(p.x,p.y+3,19,7.5,0,0,TAU); ctx.stroke();
    ctx.globalAlpha=1;
  }
  ctx.save();
  const lng=hero?0:u.lunge*10;
  ctx.translate(p.x+p.tx*dir*lng, p.y+p.ty*dir*lng);
  if(vr){
    ctx.scale(vr.scale,vr.scale);       /* 体型随军衔变大 */
    if(vr.blur){                        /* 精灵外发光＝描边效果，一次 drawImage 搞定 */
      ctx.shadowColor=vr.glow;          /* 但 shadowBlur 每次都要开离屏图层做高斯模糊，很贵， */
      ctx.shadowBlur=vr.blur;           /* 所以只给数量少的高军衔用；低军衔靠地面光环+体型区分 */
    }
  }
  if(u.dying){
    const k=Math.min(1,u.dying/0.45);
    ctx.globalAlpha=1-k;
    if(!hero)ctx.rotate(dir*k*1.5);
  }else if(u.moving&&!hero){
    ctx.translate(0,-Math.abs(Math.sin(u.walk))*3.5);
  }
  const gobSheet=st.gob?(ASSETS.gob[gobColorOf(st)]||{})[st.gob]:null;
  const set=st.ts?ASSETS.ts[unitColor(u.side,st)]:null;
  const runImg=set?set[TS_UNITS[st.ts].run]:null;
  if(st.heroTank&&drawHeroTank(u,p,st,fdir)){
    /* 时代 III 工程师英雄 */
  }else if(st.heroRanger&&drawHeroRanger(u,p,st,fdir)){
    /* 时代 III 工程师远程英雄 */
  }else if(st.mech&&drawMechUnit(u,p,st,fdir)){
    /* 机械单位已绘制 */
  }else if(gobSheet){
    const meta=GOB_META[st.gob];
    let row,n,fi;
    if(u.atkT<meta.atk[1]*0.1){row=meta.atk[0];n=meta.atk[1];fi=Math.min(n-1,Math.floor(u.atkT*10));}
    else if(u.moving){row=meta.run[0];n=meta.run[1];fi=Math.floor(u.animT*10)%n;}
    else{row=meta.idle[0];n=meta.idle[1];fi=((Math.floor((G?G.t:0)*8+u.off))%n+n)%n;}
    if(p.tx*fdir<-0.05)ctx.scale(-1,1);
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
    if(p.tx*fdir<-0.05)ctx.scale(-1,1);
    const cell=img.height;
    const dw=68*cell/192;
    ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw*0.74,dw,dw);
  }else{
    if(p.tx*fdir>0.05)ctx.scale(-1,1);
    ctx.font=em(38);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(st.emoji,0,-16);
  }
  ctx.restore();
  if(!u.dying&&!unitOutOfCombat(u)){
    const w=hero?62:34,h=hero?7:5,r=Math.max(0,u.hp/u.max);
    /* 血条跟随精灵实际高度：机械单位按 mpx 缩放，高度差异很大 */
    let by=hero?86:45;
    if(st.mech){
      /* 用内容高度而非图集格高，否则血条会飘到单位头顶很远的空白处 */
      const mm=MECH_META[st.mech];
      if(mm)by=Math.round(mm.ch*(st.mpx||1.3))+7;
    }
    ctx.fillStyle='rgba(0,0,0,.45)';
    ctx.fillRect(p.x-w/2-1,p.y-by,w+2,h+2);
    const repairing=st.heroTank&&u.heroState&&u.heroState.startsWith('repair');
    ctx.fillStyle=repairing?'#3cff78':(u.side?'#ff5a5a':'#43d675');
    ctx.fillRect(p.x-w/2,p.y-by+1,w*r,h);
    if(repairing&&r>0){
      const hx=p.x-w/2+((G?G.t:0)*34%(Math.max(8,w*r)));
      ctx.fillStyle='rgba(210,255,222,.85)';
      ctx.fillRect(Math.min(p.x+w/2-5,hx),p.y-by+1,5,h);
    }
    if(vr){
      ctx.font=em(13);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(vr.tag,p.x+22,p.y-by-1);
    }
  }
}
/* 打击区域标记：地面贴花，画在所有单位之下。
   敌方呼叫的用红色警戒色，自己呼叫的用青色，让"该跑了"和"打得好"一眼可分 */
function drawStrikeZone(k){
  const foe=k.side!==0, t=G?G.t:0, inWave=k.pend>0;
  const pulse=0.5+0.5*Math.sin(t*6);
  ctx.save();
  ctx.globalAlpha=inWave?0.30:0.14+0.14*pulse;
  ctx.fillStyle=foe?'#ff3b30':'#33d6ff';
  ctx.beginPath(); ctx.arc(k.x,k.y,k.r,0,TAU); ctx.fill();
  ctx.globalAlpha=1;
  ctx.strokeStyle=foe?'rgba(255,70,60,.95)':'rgba(80,220,255,.95)';
  ctx.lineWidth=3;
  ctx.setLineDash([10,8]); ctx.lineDashOffset=-t*26;
  ctx.beginPath(); ctx.arc(k.x,k.y,k.r,0,TAU); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset=0;
  /* 外环＝落点圈再加一个溅射半径，即真正可能被波及的最外沿（越靠外命中率越低） */
  ctx.globalAlpha=0.35; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(k.x,k.y,k.r+STRIKE.splash,0,TAU); ctx.stroke();
  ctx.globalAlpha=1;
  ctx.lineWidth=2;
  const cr=k.r*0.24;
  ctx.beginPath();
  ctx.moveTo(k.x-cr,k.y); ctx.lineTo(k.x+cr,k.y);
  ctx.moveTo(k.x,k.y-cr); ctx.lineTo(k.x,k.y+cr);
  ctx.stroke();
  ctx.fillStyle='rgba(10,14,22,.72)';
  rrectPath(k.x-40,k.y-k.r-27,80,21,6); ctx.fill();
  ctx.fillStyle=foe?'#ffb0a6':'#bdefff';
  ctx.font='bold 13px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(inWave?('💥 第 '+k.wave+' 轮')
              :k.wave>=STRIKE.waves?'💥 打击结束'
              :('🎯 '+Math.max(0,Math.ceil(k.waveT))+'s · 余 '+(STRIKE.waves-k.wave)+' 轮'),
               k.x,k.y-k.r-16);
  ctx.restore();
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
  /* 火力覆盖的落下导弹：拖一条尾焰，弹头用机械阵营的 proj_b 图 */
  if(p.kind==='mortar'){
    ctx.strokeStyle=p.side?'rgba(255,150,110,.35)':'rgba(255,205,130,.35)';
    ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-Math.cos(p.ang)*56,-Math.sin(p.ang)*56);
    ctx.stroke();
    ctx.lineCap='butt';
    ctx.rotate(p.ang);
    const MM=ASSETS.mech&&ASSETS.mech[p.side?'red':'blue'], img=MM&&MM.proj_b;
    if(img){
      const cell=img.height, n=Math.round(img.width/cell);
      const fi=Math.floor((G?G.t:0)*16)%n;
      const dw=26;
      ctx.drawImage(img,fi*cell,0,cell,cell,-dw/2,-dw/2,dw,dw);
    }else{
      ctx.fillStyle=p.side?'#ffb27a':'#a8e6ff';
      ctx.fillRect(-11,-3,22,6);
    }
    ctx.restore();
    return;
  }
  if(p.kind==='ranger_bullet'){
    ctx.rotate(p.ang);
    const img=ASSETS.heroRanger&&ASSETS.heroRanger.bullet;
    if(img){
      const fi=Math.floor((G?G.t:0)*18)%HERO_RANGER_ANIMS.bullet.frames;
      ctx.drawImage(img,fi*6,0,6,6,-12,-6,24,12);
    }else{
      ctx.fillStyle=p.side?'#ff9a74':'#d8ff75';
      ctx.fillRect(-10,-3,20,6);
    }
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
  const vw=Math.min(cssW/cam.z*k,mw), vh=Math.min(viewH/cam.z*k,mh);
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
  ctx.setTransform(dpr*z,0,0,dpr*z,dpr*(cssW/2-(cam.x+sx)*z),dpr*(viewCY-(cam.y+sy)*z));
  ctx.drawImage(ground,0,-WORLD_VIEW_TOP_PAD);
  const vx0=cam.x-cssW/2/z-60, vx1=cam.x+cssW/2/z+60;
  const vy0=cam.y-viewCY/z-80, vy1=cam.y+(cssH-viewCY)/z+80;
  const spr=[];
  for(const d of DECOS)
    if(d.x>vx0&&d.x<vx1&&d.y>vy0&&d.y<vy1)spr.push({y:d.y,k:0,o:d,p:null});
  spr.push({y:BASE0.y,k:1,o:0,p:null},{y:BASE1.y,k:1,o:1,p:null});
  if(G)for(const f of G.flags){
    const fp=pathPos(f.s);
    if(fp.x>vx0&&fp.x<vx1&&fp.y>vy0&&fp.y<vy1)spr.push({y:fp.y,k:3,o:f,p:null});
  }
  if(G)for(const u of G.units){
    const p=unitPos(u);
    if(p.x>vx0&&p.x<vx1&&p.y>vy0&&p.y<vy1)spr.push({y:p.y,k:2,o:u,p});
  }
  spr.sort((a,b)=>a.y-b.y);
  if(G&&G.strikes)for(const k of G.strikes)drawStrikeZone(k); /* 地面贴花，必须在单位之前画 */
  for(const s of spr){
    if(s.k===0)drawDeco(s.o);
    else if(s.k===1)drawBase(s.o);
    else if(s.k===3)drawFlag(s.o);
    else drawUnit(s.o,s.p);
  }
  if(placing&&placePos&&G&&mode==='play'){
    if(placingType==='strike'){
      const ok=strikeInBounds(placePos.x,placePos.y);
      ctx.globalAlpha=0.22;
      ctx.fillStyle=ok?'#33d6ff':'#ff5a5a';
      ctx.beginPath(); ctx.arc(placePos.x,placePos.y,STRIKE.radius,0,TAU); ctx.fill();
      ctx.globalAlpha=1;
      ctx.strokeStyle=ok?'rgba(80,220,255,.95)':'rgba(255,90,90,.95)';
      ctx.lineWidth=3; ctx.setLineDash([10,8]);
      ctx.beginPath(); ctx.arc(placePos.x,placePos.y,STRIKE.radius,0,TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(placePos.x-30,placePos.y); ctx.lineTo(placePos.x+30,placePos.y);
      ctx.moveTo(placePos.x,placePos.y-30); ctx.lineTo(placePos.x,placePos.y+30);
      ctx.stroke();
    }else{
      /* 建筑虚影：吸附到道路中心，绿=可建 红=不可建（含前线规则） */
      const P=PLACEABLES[placingType];
      const pr=nearestPath(placePos.x,placePos.y);
      const ok=pr&&pr.d<=76*pr.wf&&pr.sep<=5&&pr.s<=L-260&&placeAllowed(0,pr.s,placeKind(P));
      const gp=pr?pathPos(pr.s):placePos;
      /* 前线上限界标：横跨道路的虚线，玩家一眼看到"最远能放到哪"。
         空降要取与 dropCap 的较小值——元帅唯一的放置物不能看一条错的线 */
      {
        const K=placeKind(P);
        const rawLim=K==='drop'?Math.min(placeLimitS(0,0,K),L-FRONT.dropCap):placeLimitS(0,0,K);
        const lim=Math.max(12,Math.min(L-12,rawLim));
        const lp=pathPos(lim), lp2=pathPos(Math.max(0,lim-10));
        const dx=lp.x-lp2.x, dy=lp.y-lp2.y, dl=Math.hypot(dx,dy)||1;
        const nx=-dy/dl, ny=dx/dl, hw=52*(lp.wf||1);
        ctx.strokeStyle='rgba(120,220,255,.9)';ctx.lineWidth=3;ctx.setLineDash([9,7]);
        ctx.beginPath();ctx.moveTo(lp.x-nx*hw,lp.y-ny*hw);ctx.lineTo(lp.x+nx*hw,lp.y+ny*hw);ctx.stroke();
        ctx.setLineDash([]);
        ctx.font=em(13);ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='rgba(160,230,255,.95)';
        ctx.fillText('⚑ 前线上限',lp.x+nx*hw*1.15,lp.y+ny*hw*1.15-10);
      }
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
    /* 表情不再画在世界坐标里——改为屏幕左侧的 DOM 气泡流，见 net.js showEmote */
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
