/* UI — graf SVG, kontrol, animasi, hasil */
const $= (s,r=document)=>r.querySelector(s);
const $$= (s,r=document)=>[...r.querySelectorAll(s)];
const NS='http://www.w3.org/2000/svg';
const DELAY=700; // kecepatan animasi normal

const S={
  algo:'astar',start:null,goal:null,cache:{},loading:false,
  queue:[],active:null,frames:[],i:0,timer:null,playing:false,results:{},pkg:null
};
let nodeEls={},edgeEls={};

/* ---------- Graf SVG ---------- */
function buildGraph(){
  const le=$('#layerEdges'),ln=$('#layerNodes');
  le.innerHTML=ln.innerHTML='';nodeEls={};edgeEls={};
  for(const e of EDGE_LIST){
    const A=NODE[e.a],B=NODE[e.b],t=e.lt??.5,sd=e.side??1;
    const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1;
    const lx=A.x+dx*t-dy/len*18*sd,ly=A.y+dy*t+dx/len*18*sd;
    const label=`${e.w} m`,w=label.length*7.1+14;
    const g=document.createElementNS(NS,'g');
    g.setAttribute('class','edge');g.dataset.edge=edgeKey(e.a,e.b);
    g.innerHTML=`<line class="edge-line" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>
      <g class="edge-label" transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">
      <rect x="${(-w/2).toFixed(1)}" y="-9.5" width="${w.toFixed(1)}" height="19" rx="6"/>
      <text y="0.5">${label}</text></g>`;
    le.appendChild(g);edgeEls[edgeKey(e.a,e.b)]=g;
  }
  for(const n of NODE_LIST){
    const g=document.createElementNS(NS,'g');
    g.setAttribute('class','node');g.dataset.node=n.id;g.dataset.kind=n.kind;
    g.innerHTML=`<circle class="halo" cx="${n.x}" cy="${n.y}" r="20"/>
      <circle class="node-shape" cx="${n.x}" cy="${n.y}" r="15"/>
      <text class="node-label" x="${n.x}" y="${n.pos==='above'?n.y-23:n.y+30}">${n.label}</text>`;
    if(n.kind==='kos')g.classList.add('is-start');
    if(n.id===S.goal)g.classList.add('is-goal');
    ln.appendChild(g);nodeEls[n.id]=g;
  }
}

/* ---------- Frame & status ---------- */
function show(f,a){
  const svg=$('#graph');
  if(a){svg.dataset.algo=a;svg.style.setProperty('--accent',a==='bfs'?'var(--bfs)':'var(--astar)');}
  else{svg.removeAttribute('data-algo');svg.style.removeProperty('--accent');}
  $$('.node,.edge',svg).forEach(el=>el.classList.remove('is-expanded','is-frontier','is-current','is-path','is-branch'));
  if(!f){renderLive(null,null);return;}
  const path=f.goalPath||f.path||[],final=!!f.goalPath;
  for(let i=0;i<path.length-1;i++){
    const e=edgeEls[edgeKey(path[i],path[i+1])];
    if(e)e.classList.add(final?'is-path':'is-branch');
  }
  if(final)path.forEach(id=>nodeEls[id]?.classList.add('is-path'));
  (f.expanded||[]).forEach(id=>nodeEls[id]?.classList.add('is-expanded'));
  (f.open||[]).forEach(o=>nodeEls[o.id]?.classList.add('is-frontier'));
  if(f.current&&nodeEls[f.current])nodeEls[f.current].classList.add('is-current');
  renderLive(f,a);
}

function renderLive(f,a){
  const badge=$('#algoBadge');
  badge.className='algo-badge '+(a||'');
  badge.textContent=a==='astar'?'A*':a==='bfs'?'BFS':'idle';
  const b=a==='bfs',gv=$('#kvG'),hv=$('#kvH'),fv=$('#kvF'),line=$('#formulaLine');
  $('#kG').textContent='g(n) / jarak';
  $('#kH').textContent=b?'level':'h(n)';
  $('#kF').textContent='f(n)';
  if(!f?.cur){
    gv.textContent=hv.textContent=fv.textContent='–';
    line.innerHTML=b
      ?'BFS tidak menghitung f(n); node diambil dari antrean (FIFO)'
      :'f(n) = g(n) + h(n) — dihitung saat node diambil dari open list';
  }else if(b){
    gv.textContent=f.cur.g+' m';hv.textContent='L'+f.cur.level;fv.textContent='n/a';
    line.innerHTML='Level = kedalaman simpul dari titik awal. Jarak g(n) hanya informasi; BFS tidak memakainya untuk memilih node.';
  }else{
    gv.textContent=f.cur.g+' m';hv.textContent=f.cur.h+' m';fv.textContent=f.cur.f+' m';
    line.innerHTML=`f(n) = g(n) + h(n) = <b>${f.cur.g}</b> + <b>${f.cur.h}</b> = <b>${f.cur.f}</b> m`;
  }
  $('#openListTitle').textContent=b?'Antrean BFS (FIFO)':'Open List (prioritas f terkecil)';
  $('#th2').textContent=b?'level':'g';$('#th3').textContent=b?'jarak':'h';$('#th4').textContent=b?'f':'f';
  const rows=(f?.open||[]).map(o=>b
    ?`<tr><td>${NODE[o.id].label}</td><td class="num" style="text-align:right">${o.level}</td><td style="text-align:right">${o.g??'–'} m</td><td style="text-align:right;color:#94a3b8">n/a</td></tr>`
    :`<tr><td>${NODE[o.id].label}</td><td style="text-align:right">${o.g}</td><td style="text-align:right">${o.h}</td><td class="num" style="text-align:right">${o.f}</td></tr>`).join('');
  $('#openBody').innerHTML=rows||`<tr><td colspan="4" class="empty">${f?'Kosong':'Belum ada data'}</td></tr>`;
}

function renderLog(f){
  const box=$('#logBox');
  if(!f?.logs?.length){
    box.innerHTML='<div class="ln log-empty">Belum ada langkah. Tekan Jalankan atau Langkah.</div>';
    $('#logCounter').textContent='';return;
  }
  box.innerHTML=f.logs.map(l=>`<div class="ln ${l.cls||''}">${l.text.replace(/</g,'&lt;')}</div>`).join('');
  box.scrollTop=box.scrollHeight;
  $('#logCounter').textContent=f.logs.length+' baris';
}

function renderResult(algo,result,running){
  const a=algo==='astar',get=k=>$('#'+k+(a?'Astar':'Bfs'));
  const card=get('res'),tag=get('tag'),route=get('route'),
        dist=get('dist'),evalN=get('eval'),order=get('order');
  card.classList.toggle('idle',!result);
  card.classList.toggle('showing',!!result&&S.active===algo);
  if(!result){
    tag.textContent=running?'Berjalan…':'Menunggu';
    route.innerHTML=`<span class="hint">${running?'Sedang menghitung…':'Rute belum dihitung.'}</span>`;
    dist.innerHTML='– <small>m</small>';evalN.textContent='–';
    order.style.display='none';return;
  }
  tag.textContent='Selesai';
  route.innerHTML=result.path.map((id,i)=>
    (i?'<span class="arrow">→</span>':'')+
    `<span class="chip ${i===0?'start':i===result.path.length-1?'goal':''}">${NODE[id].label}</span>`).join('');
  dist.innerHTML=`${result.distance} <small>m</small>`;
  evalN.innerHTML=`${result.evaluated} <small>node</small>`;
  order.style.display='block';
  order.innerHTML='<b>Urutan evaluasi ('+result.evaluated+'):</b><span class="seq">'+
    result.order.map((id,i)=>`${i+1}. ${NODE[id].label}`).join(' · ')+'</span>';
}

function renderSummary(){
  const a=S.results.astar,b=S.results.bfs,box=$('#summary'),txt=$('#summaryText');
  box.classList.toggle('idle',!a&&!b);
  if(a&&b){
    const d=b.distance-a.distance,e=b.evaluated-a.evaluated;
    let msg=d===0?`Kedua algoritma menemukan jarak yang sama: <b>${a.distance} m</b>. `
      :d>0?`A* lebih pendek <b>${d} m</b> (${(d/b.distance*100).toFixed(1)}%) dari BFS. `
      :`BFS lebih pendek <b>${-d} m</b> dari A* pada kasus ini. `;
    msg+=e>0?`A* mengevaluasi <b>${a.evaluated}</b> node vs BFS <b>${b.evaluated}</b> (hemat ${e}).`
      :`Keduanya mengevaluasi <b>${a.evaluated}</b> node.`;
    txt.innerHTML=msg;
  }else if(a||b){
    const r=a||b;
    txt.innerHTML=`${a?'A*':'BFS'}: <b>${r.path.map(id=>NODE[id].label).join(' → ')}</b> · ${r.distance} m · ${r.evaluated} node dievaluasi. Jalankan <b>Bandingkan</b> untuk perbandingan penuh.`;
  }else txt.textContent='Jalankan simulasi untuk melihat perbandingan jarak tempuh dan jumlah node yang dievaluasi antara A* dan BFS.';
}

/* ---------- Data ruas jalan ---------- */
function fillEdges(){
  $('#edgeBody').innerHTML=EDGE_LIST.map((e,i)=>`
    <tr><td>${i+1}</td><td><b>${NODE[e.a].label}</b> <span class="arrow">↔</span> <b>${NODE[e.b].label}</b></td>
    <td class="num" style="text-align:right">${e.w} m</td><td>${e.desc}</td></tr>`).join('');
  $('#edgeCount').textContent=`${EDGE_LIST.length} ruas jalan · ${NODE_LIST.length} node`;
}

/* ---------- Simulasi ---------- */
const algos=()=>S.algo==='both'?['astar','bfs']:[S.algo];
function stop(){
  clearTimeout(S.timer);S.timer=null;S.playing=false;
  $('#btnRun').classList.remove('is-playing');$('#btnRun').textContent='▶ Jalankan';
}
function reset(){
  stop();S.queue=[];S.active=null;S.frames=[];S.i=0;S.results={};
  $$('.res').forEach(c=>c.classList.remove('showing'));
  show(null,null);renderResult('astar',null,false);renderResult('bfs',null,false);
  renderSummary();renderLog(null);
  $('#stepIndicator').textContent='— belum dijalankan —';
}
async function load(){
  await Promise.all(algos().map(async a=>{
    const k=`${a}|${S.start}|${S.goal}`;
    if(!S.cache[k])S.cache[k]=await fetchRun(a,S.start,S.goal);
  }));
}
function indicator(){
  const n=S.active==='astar'?'A*':'BFS',total=S.frames.length;
  $('#stepIndicator').textContent=S.active
    ?`${S.algo==='both'?n+' · ':''}langkah ${Math.min(S.i+1,total)} / ${total}`
    :'— belum dijalankan —';
}
function begin(a){
  const p=S.cache[`${a}|${S.start}|${S.goal}`];
  S.active=a;S.frames=p.frames;S.i=0;S.pkg=p;
  renderResult(a,null,true);show(p.frames[0],a);renderLog(p.frames[0]);indicator();
}
function finish(){
  S.results[S.active]=S.pkg.result;
  renderResult(S.active,S.pkg.result,false);renderSummary();
}
function step(){
  if(!S.active){
    const list=algos();if(!list.length)return false;
    begin(list[0]);S.queue=list.slice(1);return true;
  }
  if(S.i<S.frames.length-1){
    S.i++;const f=S.frames[S.i];
    show(f,S.active);renderLog(f);indicator();
    if(f.done)finish();return true;
  }
  finish();
  if(S.queue.length){begin(S.queue.shift());return true;}
  return false;
}
function tick(){
  S.timer=setTimeout(()=>{
    if(!S.playing)return;
    if(!step()){stop();$('#stepIndicator').textContent='✔ simulasi selesai';return;}
    tick();
  },DELAY);
}
async function run(){
  if(S.playing){stop();return;}
  if(S.loading)return;
  reset();S.loading=true;
  try{await load();}catch(e){
    S.loading=false;console.error(e);
    $('#stepIndicator').textContent='⚠ gagal menghubungi server: '+e.message;return;
  }
  S.loading=false;
  const list=algos();S.queue=list.slice(1);S.playing=true;
  $('#btnRun').classList.add('is-playing');$('#btnRun').textContent='⏸ Pause';
  begin(list[0]);tick();
}
async function stepRun(){
  stop();
  if(!S.active){
    S.loading=true;
    try{await load();}catch(e){S.loading=false;$('#stepIndicator').textContent='⚠ '+e.message;return;}
    S.loading=false;
  }
  if(!step())$('#stepIndicator').textContent='✔ simulasi selesai';
}

/* ---------- Init ---------- */
function bind(){
  $$('#algoSeg button').forEach(b=>b.addEventListener('click',()=>{
    $$('#algoSeg button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');S.algo=b.dataset.algo;reset();
  }));
  $('#startSel').addEventListener('change',e=>{S.start=e.target.value;reset();});
  $('#goalSel').addEventListener('change',e=>{
    S.goal=e.target.value;
    $$('#graph .node').forEach(el=>el.classList.toggle('is-goal',el.dataset.node===S.goal));
    reset();
  });
  $('#btnRun').addEventListener('click',run);
  $('#btnStep').addEventListener('click',stepRun);
  $('#btnReset').addEventListener('click',reset);
}
async function init(){
  await loadGraph();
  S.start=KOS_NODES[0];S.goal=GOAL_DEFAULT;
  const opts=ids=>ids.map(id=>`<option value="${id}">${NODE[id].label}</option>`).join('');
  $('#startSel').innerHTML=opts(KOS_NODES)+opts(NODE_LIST.filter(n=>!KOS_NODES.includes(n.id)).map(n=>n.id));
  $('#goalSel').innerHTML=opts(NODE_LIST.map(n=>n.id));
  $('#startSel').value=S.start;$('#goalSel').value=S.goal;
  buildGraph();fillEdges();bind();renderSummary();renderLog(null);show(null,null);
}
init().catch(e=>{console.error(e);$('#stepIndicator').textContent='⚠ '+e.message;});
