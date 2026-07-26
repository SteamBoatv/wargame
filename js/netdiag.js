'use strict';
/* ---------------- P2P 连接诊断 ----------------
   目的：连不上时能指出卡在哪一环，而不是干等一个"正在连接…"。

   四个环节按依赖顺序：
     ① 信令服务器（公共 MQTT over WSS）—— 不通则双方根本互相看不见
     ② STUN —— 不通则拿不到自己的公网地址，只能同局域网内连
     ③ NAT 类型 —— 对称型 NAT 打洞成功率极低，且本项目没有 TURN 中继可回退
     ④ ICE 协商 —— 前三项都过了，才轮到真正的打洞

   ③ 的判定方法：同一个 RTCPeerConnection 配多个 STUN 服务器，
   比较它们各自返回的公网映射端口。端口一致＝锥形 NAT（可打洞）；
   不一致＝对称 NAT（每个目标分配不同端口，对方猜不到该往哪发）。 */

const DIAG_BROKERS=[
  {name:'emqx',      url:'wss://broker.emqx.io:8084/mqtt'},
  {name:'hivemq',    url:'wss://broker.hivemq.com:8884/mqtt'},
  {name:'mosquitto', url:'wss://test.mosquitto.org:8081/mqtt'},
];
/* 用于探测的 STUN：挑不同运营商，实测响应较快的几个。
   多来源才能判 NAT 类型——单个服务器只能告诉你公网地址，判不了映射规律。 */
const DIAG_STUN=[
  'stun:stun1.l.google.com:19302',
  'stun:global.stun.twilio.com:3478',
  'stun:stun.nextcloud.com:3478',
  'stun:stun.cloudflare.com:3478',
];

const DIAG={
  steps:{
    sig :{t:'信令服务器', s:'wait', d:''},
    stun:{t:'公网地址', s:'wait', d:''},
    nat :{t:'NAT 类型',   s:'wait', d:''},
    peer:{t:'发现对方',   s:'wait', d:''},
    ice :{t:'P2P 打洞',   s:'wait', d:''},
  },
  t0:0, timer:null, ran:false,
};
const DIAG_ICON={wait:'⌛',ok:'✅',warn:'⚠️',bad:'❌',run:'🔄',none:'—'};

function diagSet(k,s,d){
  const st=DIAG.steps[k];
  if(!st)return;
  st.s=s; if(d!==undefined)st.d=d;
  diagRender();
}
function diagRender(){
  const el=$('diagList');
  if(!el)return;
  let h='';
  for(const k in DIAG.steps){
    const st=DIAG.steps[k];
    h+='<div class="drow"><span class="di">'+DIAG_ICON[st.s]+'</span>'+
       '<span class="dt">'+st.t+'</span>'+
       '<span class="dd '+st.s+'">'+(st.d||'')+'</span></div>';
  }
  el.innerHTML=h;
}

/* ---- ① 信令服务器：WebSocket 能否握手 ---- */
function diagProbeBroker(b,timeout=7000){
  return new Promise(res=>{
    const t0=performance.now();
    let ws,done=false;
    const fin=(ok,note)=>{
      if(done)return; done=true;
      try{ws&&ws.close();}catch(e){}
      res({name:b.name,ok,ms:Math.round(performance.now()-t0),note});
    };
    const timer=setTimeout(()=>fin(false,'超时'),timeout);
    try{
      /* MQTT over WebSocket 需要子协议，否则部分 broker 直接拒绝握手 */
      ws=new WebSocket(b.url,'mqtt');
    }catch(e){clearTimeout(timer);return fin(false,'不支持');}
    ws.onopen =()=>{clearTimeout(timer);fin(true);};
    ws.onerror=()=>{clearTimeout(timer);fin(false,'拒绝/被拦');};
    ws.onclose=e=>{if(!done){clearTimeout(timer);fin(false,'关闭 '+(e.code||''));}};
  });
}

/* ---- ②③ STUN 可达性 + NAT 类型 ----
   必须用【同一个 RTCPeerConnection】配多个 STUN：这样本地端口固定，
   各服务器看到的映射端口才有可比性。分别建 PC 去问会各用一个本地端口，
   得到的端口天然不同，会把任何网络都误判成对称 NAT。 */
function diagProbeStun(timeout=8000){
  return new Promise(res=>{
    let pc,done=false;
    const seen=[];                  /* {ip, port, v6} 逐条记录 srflx 候选 */
    const errUrls=new Set();        /* 问不通的 STUN 服务器 */
    const t0=performance.now();
    const fin=()=>{
      if(done)return; done=true;
      try{pc&&pc.close();}catch(e){}
      const v4=seen.filter(c=>!c.v6);
      const v6=seen.filter(c=>c.v6);
      /* 多出口网络（不同 STUN 看到不同公网 IP）会把端口比较搞乱，
         只在同一个公网 IP 的样本内部判 NAT */
      const byIp={};
      for(const c of v4)(byIp[c.ip]=byIp[c.ip]||[]).push(c.port);
      const ips=Object.keys(byIp);
      const main=ips.sort((a,b)=>byIp[b].length-byIp[a].length)[0]||null;
      const ports=main?[...new Set(byIp[main])]:[];
      /* 浏览器会把完全相同的 srflx 候选去重，所以"只收到 1 个"并不等于"只有 1 个服务器回应"。
         真正的判据是有多少服务器【没报错】：
           ≥2 个服务器有回应，却只产出 1 个映射端口 → 映射与目标无关 → 锥形 NAT
           产出多个不同端口                        → 每个目标一个端口 → 对称 NAT */
      const replied=DIAG_STUN.length-errUrls.size;
      let nat='unknown';
      if(ports.length>=2)nat='symmetric';
      else if(ports.length===1&&replied>=2)nat='cone';
      res({
        ok:seen.length>0, ms:Math.round(performance.now()-t0),
        v4n:v4.length, v6n:v6.length, total:DIAG_STUN.length,
        replied, failed:errUrls.size,
        ip:main, ips, ports, nat,
        multiEgress:ips.length>1,
      });
    };
    try{
      pc=new RTCPeerConnection({iceServers:DIAG_STUN.map(u=>({urls:u})),
                                iceCandidatePoolSize:0});
    }catch(e){return res({ok:false,err:String(e),v4n:0,v6n:0,ips:[],ports:[],nat:'unknown'});}
    pc.onicecandidate=e=>{
      if(!e.candidate){fin();return;}
      const c=e.candidate;
      /* 用 address/port 字段，别去 split "ip:port" —— IPv6 里全是冒号 */
      if(c.type==='srflx'&&c.address)
        seen.push({ip:c.address,port:c.port,v6:c.address.indexOf(':')>=0});
    };
    pc.onicecandidateerror=e=>{if(e&&e.url)errUrls.add(String(e.url).split('?')[0]);};
    pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete')fin();};
    setTimeout(fin,timeout);
    pc.createDataChannel('probe');
    pc.createOffer().then(o=>pc.setLocalDescription(o)).catch(()=>fin());
  });
}

/* ---- ④ 实时读取 Trystero 内部的 RTCPeerConnection 状态 ---- */
function diagPeerStates(){
  if(!NET||!NET.room||!NET.room.getPeers)return [];
  let peers={};
  try{peers=NET.room.getPeers()||{};}catch(e){return [];}
  return Object.entries(peers).map(([id,pc])=>({
    id:id.slice(0,6),
    ice:pc&&pc.iceConnectionState||'?',
    conn:pc&&pc.connectionState||'?',
    pc,
  }));
}
/* 连上之后查一次：走的是直连还是中继，用的哪种候选 */
async function diagPathKind(pc){
  if(!pc||!pc.getStats)return null;
  try{
    const st=await pc.getStats();
    let pair=null;
    st.forEach(r=>{
      if(r.type==='candidate-pair'&&r.state==='succeeded'&&(r.nominated||!pair))pair=r;
    });
    if(!pair)return null;
    const loc=st.get(pair.localCandidateId), rem=st.get(pair.remoteCandidateId);
    const t=c=>c?(c.candidateType||'?'):'?';
    return {local:t(loc),remote:t(rem)};
  }catch(e){return null;}
}

const NAT_TXT={
  cone:{s:'ok',  d:'锥形 NAT —— 可以打洞'},
  symmetric:{s:'bad', d:'对称 NAT —— 打洞成功率极低，且本作没有 TURN 中继可回退'},
  unknown:{s:'warn',d:'无法判定（STUN 回应不足）'},
};

/* 入口：进入 PvP 大厅时跑一次前三项，之后持续轮询 ④ */
async function diagStart(){
  if(DIAG.ran)return;
  DIAG.ran=true;
  DIAG.t0=performance.now();
  for(const k in DIAG.steps){DIAG.steps[k].s='wait';DIAG.steps[k].d='';}
  diagRender();

  /* STUN 先跑：信令探测要和 Trystero 抢同一批 broker 的连接，放后面串行做，减少干扰 */
  diagSet('stun','run','测试中…');
  diagSet('nat','run','');
  const s=await diagProbeStun();
  if(!s.ok){
    diagSet('stun','bad','拿不到公网地址（STUN 全部不通）');
    diagSet('nat','bad','无法判定');
    DIAG.fatal='STUN 服务器不可达 —— 拿不到自己的公网地址，只能在同一局域网内连接。';
  }else{
    let d='公网 '+(s.ip||'—')+'　'+s.replied+'/'+s.total+' 个 STUN 有回应';
    if(s.v6n)d+='　含 IPv6（若双方都有 IPv6，通常能直连）';
    if(s.multiEgress)d+='　⚠️ 检测到多个出口 IP：'+s.ips.join(' ');
    diagSet('stun','ok',d+'　'+s.ms+'ms');
    const n=NAT_TXT[s.nat];
    diagSet('nat',n.s,n.d+(s.ports.length>1?'（映射端口 '+s.ports.join(' / ')+'）':''));
    if(s.nat==='symmetric')DIAG.fatal='你这一侧是对称 NAT。若对方也是对称 NAT，P2P 直连无法建立——本作没有 TURN 中继可回退，换网络（手机热点常为锥形）通常可行。';
  }

  diagSet('sig','run','测试中…');
  const rs=[];
  for(const b of DIAG_BROKERS)rs.push(await diagProbeBroker(b,9000)); /* 串行，别和 Trystero 抢 */
  const ok=rs.filter(r=>r.ok);
  DIAG.sigProbeOk=ok.length;
  diagSet('sig', ok.length?(ok.length===rs.length?'ok':'warn'):'bad',
          rs.map(r=>r.name+(r.ok?' ✓'+r.ms+'ms':' ✗'+(r.note||''))).join('　'));
  if(!ok.length)DIAG.fatal=DIAG.fatal||'信令服务器全部不可达 —— 双方无法互相发现。多半是网络屏蔽了公共 MQTT 服务器，换个网络（如手机热点）通常能解决。';
  diagTick();
}
function diagTick(){
  if(DIAG.timer)clearInterval(DIAG.timer);
  DIAG.timer=setInterval(()=>{
    if(!NET){diagStop();return;}
    const ps=diagPeerStates();
    const wait=Math.round((performance.now()-DIAG.t0)/1000);
    if(!ps.length){
      diagSet('peer','wait','等待对方进入房间…　已等 '+wait+'s');
      diagSet('ice','none','');
      const hint=$('diagHint');
      if(hint)hint.textContent=wait>25&&DIAG.fatal?('💡 '+DIAG.fatal)
        :(wait>25?'💡 对方还没进来。确认对方已经打开链接，且两人房间号一致。':'');
      return;
    }
    /* 对方真的出现了＝信令确实通，这是比主动探测更硬的证据（探测会被 Trystero 抢连接干扰） */
    if(DIAG.steps.sig.s!=='ok')diagSet('sig','ok','已确认可用（对方已通过信令连上）');
    diagSet('peer','ok',ps.length+' 个连接　'+ps.map(p=>p.id).join(' '));
    const st=ps.map(p=>p.ice);
    const good=st.filter(x=>x==='connected'||x==='completed').length;
    const fail=st.filter(x=>x==='failed').length;
    const chk =st.filter(x=>x==='checking'||x==='new').length;
    let s='run',d=st.join(' / ');
    if(good){s='ok';d='已连通（'+d+'）';}
    else if(fail){s='bad';d='打洞失败（'+d+'）';}
    else if(chk){s='run';d='打洞中…　'+d;}
    diagSet('ice',s,d);
    const hint=$('diagHint');
    if(hint){
      if(fail&&!good)hint.textContent='💡 '+(DIAG.fatal||'双方 NAT 都比较严格，直连没能建立。换一方当房主、或改用手机热点通常能解决。');
      else if(good){
        hint.textContent='';
        const p=ps.find(x=>x.ice==='connected'||x.ice==='completed');
        if(p&&!DIAG.pathDone){
          DIAG.pathDone=true;
          diagPathKind(p.pc).then(k=>{
            if(k)diagSet('ice','ok','已连通（'+k.local+' ↔ '+k.remote+
              (k.local==='relay'||k.remote==='relay'?'，经中继':'，直连')+'）');
          });
        }
      }else if(chk&&(performance.now()-DIAG.t0)/1000>20)
        hint.textContent='💡 打洞已持续 20 秒以上，多半会失败。'+(DIAG.fatal?DIAG.fatal:'可以先返回再试一次。');
    }
  },1000);
}
function diagStop(){
  if(DIAG.timer){clearInterval(DIAG.timer);DIAG.timer=null;}
  DIAG.ran=false; DIAG.pathDone=false; DIAG.fatal=null;
}
