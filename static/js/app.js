/* UI — rendering graf SVG, kontrol, animasi, tabel hasil */
/* =====================================================================
   UI
   ===================================================================== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const SVGNS = 'http://www.w3.org/2000/svg';

const SPEED_DELAYS = [1600, 1100, 700, 420, 220];
const SPEED_LABELS = ['Sangat lambat','Lambat','Normal','Cepat','Sangat cepat'];

const state = {
  algo: 'astar',
  start: null,          // diisi di init() setelah data graf dimuat
  goal: null,
  pkgCache: {},         // hasil algoritma dari backend: 'algo|start|goal'
  loading: false,
  speedIdx: 2,
  queue: [],
  active: null,        // 'astar' | 'bfs'
  frames: [],
  idx: 0,
  timer: null,
  playing: false,
  results: { astar:null, bfs:null },
  lastFrames: { astar:null, bfs:null },
  shown: null,
  pkg: null
};

let nodeEls = {}, edgeEls = {};

/* ---------------- Bangun graf SVG ---------------- */
function buildGraph(){
  const layerEdges = $('#layerEdges');
  const layerNodes = $('#layerNodes');
  layerEdges.innerHTML = '';
  layerNodes.innerHTML = '';
  nodeEls = {}; edgeEls = {};

  EDGE_LIST.forEach(e => {
    const A = NODE[e.a], B = NODE[e.b];
    const t  = e.lt ?? 0.5;              // posisi label sepanjang ruas (0..1)
    const sd = e.side ?? 1;              // sisi offset label
    const bx = A.x + (B.x - A.x) * t, by = A.y + (B.y - A.y) * t;
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 18 * sd, oy = (dx / len) * 18 * sd;
    const lx = bx + ox, ly = by + oy;
    const label = e.w + ' m';
    const w = label.length * 7.1 + 14;

    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'edge');
    g.dataset.edge = edgeKey(e.a, e.b);
    g.innerHTML =
      `<line class="edge-line" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"></line>
       <g class="edge-label" transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">
         <rect x="${(-w/2).toFixed(1)}" y="-9.5" width="${w.toFixed(1)}" height="19" rx="6"></rect>
         <text y="0.5">${label}</text>
       </g>
       <line class="edge-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"></line>`;
    layerEdges.appendChild(g);
    edgeEls[edgeKey(e.a, e.b)] = g;
  });

  NODE_LIST.forEach(n => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'node');
    g.dataset.node = n.id;
    g.dataset.kind = n.kind;
    g.style.cursor = 'help';
    const isGoal = n.id === state.goal;
    g.innerHTML =
      `<circle class="halo" cx="${n.x}" cy="${n.y}" r="20"></circle>
       <circle class="node-shape" cx="${n.x}" cy="${n.y}" r="15"></circle>
       <text class="node-label" x="${n.x}" y="${n.pos === 'above' ? n.y - 23 : n.y + 30}">${n.label}</text>`;
    if (n.kind === 'kos') g.classList.add('is-start');
    if (isGoal) g.classList.add('is-goal');
    layerNodes.appendChild(g);
    nodeEls[n.id] = g;
  });
}

/* ---------------- Tooltip ---------------- */
const tooltip = $('#tooltip'), graphWrap = $('#graphWrap');

function showTooltip(html, evt){
  tooltip.innerHTML = html;
  tooltip.classList.add('show');
  const wrapRect = graphWrap.getBoundingClientRect();
  let x = evt.clientX - wrapRect.left + 14;
  let y = evt.clientY - wrapRect.top + 14;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  if (x + tw > wrapRect.width - 6) x = wrapRect.width - tw - 6;
  if (y + th > wrapRect.height - 6) y = Math.max(6, evt.clientY - wrapRect.top - th - 12);
  tooltip.style.left = Math.max(6, x) + 'px';
  tooltip.style.top = Math.max(6, y) + 'px';
}
function hideTooltip(){ tooltip.classList.remove('show'); }

graphWrap.addEventListener('mousemove', evt => {
  const nodeEl = evt.target.closest('[data-node]');
  const edgeEl = evt.target.closest('[data-edge]');
  if (nodeEl){
    const id = nodeEl.dataset.node, n = NODE[id];
    const real = state.trueDist ? state.trueDist[id] : null;
    const rows = ADJ[id].map(a => `<div class="tt-row"><span class="tt-key">↔ ${NODE[a.id].label}</span><span>${a.w} m</span></div>`).join('');
    const role = id === state.goal ? 'Tujuan' : (n.kind === 'kos' ? 'Titik awal (kos)' : 'Persimpangan / gerbang');
    showTooltip(
      `<b>${n.label}</b><div class="tt-row"><span class="tt-key">Peran</span><span>${role}</span></div>
       <div class="tt-row"><span class="tt-key">h(n)</span><span>${n.h} m</span></div>
       ${real !== null ? `<div class="tt-row"><span class="tt-key">Jarak terpendek aktual</span><span>${real} m</span></div>` : ''}
       <hr><div class="tt-key" style="margin-bottom:3px">Ruas terhubung:</div>${rows}`, evt);
  } else if (edgeEl){
    const e = EDGE_MAP[edgeEl.dataset.edge];
    showTooltip(
      `<b>${NODE[e.a].label} ↔ ${NODE[e.b].label}</b>
       <div class="tt-row"><span class="tt-key">Bobot g(n)</span><span>${e.w} m</span></div>
       <hr><div class="tt-desc">${e.desc}</div>`, evt);
  } else {
    hideTooltip();
  }
});
graphWrap.addEventListener('mouseleave', hideTooltip);

/* ---------------- Render frame ---------------- */
function clearHighlight(){
  $$('.node', $('#graph')).forEach(el => el.classList.remove('is-expanded','is-frontier','is-current','is-path'));
  $$('.edge', $('#graph')).forEach(el => el.classList.remove('is-branch','is-path'));
}

function applyFrame(frame, algo){
  const svg = $('#graph');
  svg.dataset.algo = algo;
  svg.style.setProperty('--accent', algo === 'bfs' ? 'var(--bfs)' : 'var(--astar)');
  clearHighlight();
  if (!frame) return;

  const path = frame.goalPath || frame.path || [];
  const isFinal = !!frame.goalPath;

  // highlight jalur
  for (let i = 0; i < path.length - 1; i++){
    const el = edgeEls[edgeKey(path[i], path[i+1])];
    if (el) el.classList.add(isFinal ? 'is-path' : 'is-branch');
  }
  if (isFinal) path.forEach(id => nodeEls[id] && nodeEls[id].classList.add('is-path'));

  (frame.expanded || []).forEach(id => { if (nodeEls[id]) nodeEls[id].classList.add('is-expanded'); });
  (frame.open || []).forEach(o => { if (nodeEls[o.id]) nodeEls[o.id].classList.add('is-frontier'); });
  if (frame.current && nodeEls[frame.current]) nodeEls[frame.current].classList.add('is-current');
}

/* ---------------- Panel status ---------------- */
function renderLive(frame, algo){
  const badge = $('#algoBadge');
  badge.className = 'algo-badge ' + (algo || '');
  badge.textContent = algo === 'astar' ? 'A*' : algo === 'bfs' ? 'BFS' : 'idle';

  const isBfs = algo === 'bfs';

  $('#kG').textContent = 'g(n) / jarak';
  $('#kH').textContent = isBfs ? 'level' : 'h(n)';
  $('#kF').textContent = isBfs ? 'f(n)' : 'f(n)';

  if (!frame || !frame.cur){
    $('#kvG').textContent = '–'; $('#kvH').textContent = '–'; $('#kvF').textContent = '–';
    $('#formulaLine').innerHTML = isBfs
      ? 'BFS tidak menghitung f(n); node diambil dari antrean (FIFO)'
      : 'f(n) = g(n) + h(n) — dihitung saat node diambil dari open list';
  } else if (isBfs){
    $('#kvG').textContent = frame.cur.g + ' m';
    $('#kvH').textContent = 'L' + frame.cur.level;
    $('#kvF').textContent = 'n/a';
    $('#formulaLine').innerHTML = 'Level = kedalaman simpul dari titik awal. Jarak g(n) hanya informasi; BFS tidak memakainya untuk memilih node.';
  } else {
    $('#kvG').textContent = frame.cur.g + ' m';
    $('#kvH').textContent = frame.cur.h + ' m';
    $('#kvF').textContent = frame.cur.f + ' m';
    $('#formulaLine').innerHTML = `f(n) = g(n) + h(n) = <b>${frame.cur.g}</b> + <b>${frame.cur.h}</b> = <b>${frame.cur.f}</b> m`;
  }

  // tabel open list / antrean
  const body = $('#openBody');
  $('#openListTitle').textContent = isBfs ? 'Antrean BFS (FIFO)' : 'Open List (prioritas f terkecil)';
  $('#th2').textContent = isBfs ? 'level' : 'g';
  $('#th3').textContent = isBfs ? 'jarak' : 'h';
  $('#th4').textContent = isBfs ? 'f' : 'f';

  if (!frame || !frame.open || frame.open.length === 0){
    body.innerHTML = `<tr><td colspan="4" class="empty">${frame ? 'Kosong' : 'Belum ada data'}</td></tr>`;
    return;
  }
  const rows = frame.open.map(o => {
    if (isBfs) return `<tr><td>${NODE[o.id].label}</td><td class="num" style="text-align:right">${o.level}</td><td style="text-align:right">${o.g ?? '–'} m</td><td style="text-align:right;color:#94a3b8">n/a</td></tr>`;
    return `<tr><td>${NODE[o.id].label}</td><td style="text-align:right">${o.g}</td><td style="text-align:right">${o.h}</td><td class="num" style="text-align:right">${o.f}</td></tr>`;
  }).join('');
  body.innerHTML = rows;
}

/* ---------------- Log ---------------- */
function renderLog(frame){
  const box = $('#logBox');
  if (!frame || !frame.logs || frame.logs.length === 0){
    box.innerHTML = `<div class="ln log-empty">Belum ada langkah. Tekan <b>Jalankan</b> atau <b>Langkah</b>.</div>`;
    $('#logCounter').textContent = '';
    return;
  }
  box.innerHTML = frame.logs.map(l => `<div class="ln ${l.cls || ''}">${l.text.replace(/</g,'&lt;')}</div>`).join('');
  box.scrollTop = box.scrollHeight;
  $('#logCounter').textContent = `${frame.logs.length} baris log`;
}

/* ---------------- Hasil ---------------- */
function escapeHtml(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function renderResult(algo, result, running){
  const isA = algo === 'astar';
  const card = isA ? $('#resAstar') : $('#resBfs');
  const tag  = isA ? $('#tagAstar') : $('#tagBfs');
  const route= isA ? $('#routeAstar') : $('#routeBfs');
  const dist = isA ? $('#distAstar') : $('#distBfs');
  const evalN= isA ? $('#evalAstar') : $('#evalBfs');
  const order= isA ? $('#orderAstar') : $('#orderBfs');

  card.classList.remove('idle');

  if (!result){
    card.classList.remove('clickable','showing');
    card.classList.add('idle');
    tag.textContent = running ? 'Berjalan…' : 'Menunggu';
    route.innerHTML = `<span class="hint">${running ? 'Sedang menghitung…' : 'Rute belum dihitung.'}</span>`;
    dist.innerHTML = '– <small>m</small>';
    evalN.textContent = '–';
    order.style.display = 'none';
    return;
  }

  tag.textContent = 'Selesai';
  card.classList.add('clickable');
  route.innerHTML = result.path.map((id, i) => {
    const cls = i === 0 ? 'chip start' : (i === result.path.length - 1 ? 'chip goal' : 'chip');
    const label = NODE[id].label;
    return (i ? '<span class="arrow">→</span>' : '') + `<span class="${cls}">${label}</span>`;
  }).join('');
  dist.innerHTML = `${result.distance} <small>m</small>`;
  evalN.innerHTML = `${result.evaluated} <small>node</small>`;
  order.style.display = 'block';
  const seq = result.order.map((id, i) => `${i+1}. ${NODE[id].label}`).join('  ·  ');
  order.innerHTML = `<b>Urutan node dievaluasi (${result.evaluated}):</b><span class="seq">${seq}</span>`;
}

function renderSummary(){
  const a = state.results.astar, b = state.results.bfs;
  const box = $('#summary'), txt = $('#summaryText');
  if (a && b){
    box.classList.remove('idle');
    const diff = b.distance - a.distance;
    const evalDiff = b.evaluated - a.evaluated;
    let msg = '';
    if (diff > 0){
      msg += `A* menemukan rute <strong>${a.distance} m</strong>, sedangkan BFS <strong>${b.distance} m</strong> — A* lebih pendek <strong>${diff} m</strong> (${(diff / b.distance * 100).toFixed(1)}% lebih efisien). `;
    } else if (diff === 0){
      msg += `Kedua algoritma menemukan rute dengan jarak sama: <strong>${a.distance} m</strong>. `;
    } else {
      msg += `Pada kasus ini BFS menemukan rute <strong>${b.distance} m</strong> yang lebih pendek ${Math.abs(diff)} m dari A* — periksa kembali nilai heuristik agar tetap admissible. `;
    }
    if (evalDiff > 0) msg += `A* mengevaluasi <strong>${a.evaluated}</strong> node, BFS <strong>${b.evaluated}</strong> node (A* menghemat ${evalDiff} node).`;
    else if (evalDiff === 0) msg += `Keduanya mengevaluasi <strong>${a.evaluated}</strong> node.`;
    else msg += `A* mengevaluasi <strong>${a.evaluated}</strong> node, BFS <strong>${b.evaluated}</strong> node.`;
    msg += ` Kesimpulan: BFS menjamin jumlah ruas paling sedikit, tetapi bobot jarak membuat rute BFS belum tentu yang terpendek dalam meter.`;
    txt.innerHTML = msg;
  } else if (a || b){
    box.classList.remove('idle');
    const r = a || b;
    const name = a ? 'A*' : 'BFS';
    txt.innerHTML = `${name} menemukan rute <strong>${r.path.map(id => NODE[id].label).join(' → ')}</strong> dengan total jarak <strong>${r.distance} m</strong> dan <strong>${r.evaluated}</strong> node dievaluasi. Jalankan mode <strong>Bandingkan</strong> untuk melihat perbandingan lengkap.`;
  } else {
    box.classList.add('idle');
    txt.textContent = 'Jalankan simulasi untuk melihat perbandingan jarak tempuh dan jumlah node yang dievaluasi antara A* dan BFS.';
  }
}

/* ---------------- Kontrol simulasi ---------------- */
function stopTimer(){
  if (state.timer){ clearTimeout(state.timer); state.timer = null; }
  state.playing = false;
  const btn = $('#btnRun');
  btn.classList.remove('is-playing');
  btn.innerHTML = '▶ Jalankan';
}

function resetAll(keepLog){
  stopTimer();
  state.queue = []; state.active = null; state.frames = []; state.idx = 0;
  state.results = { astar:null, bfs:null };
  state.lastFrames = { astar:null, bfs:null };
  state.shown = null;
  $$('.res-card').forEach(c => c.classList.remove('clickable','showing'));
  clearHighlight();
  $('#graph').removeAttribute('data-algo');
  renderLive(null, null);
  renderResult('astar', null, false);
  renderResult('bfs', null, false);
  renderSummary();
  if (!keepLog) renderLog(null);
  $('#stepIndicator').textContent = '— belum dijalankan —';
  $('#graphSubtitle').textContent = 'Klik / hover node & ruas jalan untuk melihat detail';
}

function algorithmsToRun(){
  return state.algo === 'both' ? ['astar','bfs'] : [state.algo];
}

/* ambil hasil algoritma dari backend Python (di-cache per start/goal) */
async function loadPackages(){
  const jobs = algorithmsToRun()
    .filter(a => !state.pkgCache[`${a}|${state.start}|${state.goal}`])
    .map(async a => {
      const key = `${a}|${state.start}|${state.goal}`;
      state.pkgCache[key] = await fetchRun(a, state.start, state.goal);
    });
  await Promise.all(jobs);
}

function showError(err){
  console.error(err);
  $('#stepIndicator').textContent = '⚠ gagal menghubungi server: ' + err.message;
}

function beginAlgo(algo){
  const pkg = state.pkgCache[`${algo}|${state.start}|${state.goal}`];
  state.active = algo;
  state.frames = pkg.frames;
  state.idx = 0;
  state.pkg = pkg;
  renderResult(algo, null, true);
  applyFrame(pkg.frames[0], algo);
  renderLive(pkg.frames[0], algo);
  renderLog(pkg.frames[0]);
  updateStepIndicator();
}

function updateStepIndicator(){
  if (!state.active){ $('#stepIndicator').textContent = '— belum dijalankan —'; return; }
  const name = state.active === 'astar' ? 'A*' : 'BFS';
  const total = state.frames.length;
  const label = state.algo === 'both' ? `${name} · langkah ${state.idx + 1} / ${total}` : `langkah ${Math.min(state.idx + 1, total)} / ${total}`;
  $('#stepIndicator').textContent = label;
  $('#graphSubtitle').textContent = `Graf sedang menampilkan proses ${name}`;
}

function finishAlgo(){
  const pkg = state.pkg;
  state.results[state.active] = pkg.result;
  state.lastFrames[state.active] = pkg.frames[pkg.frames.length - 1];
  state.shown = state.active;
  $$('.res-card').forEach(c => c.classList.remove('showing'));
  (state.active === 'astar' ? $('#resAstar') : $('#resBfs')).classList.add('showing');
  renderResult(state.active, pkg.result, false);
  renderSummary();
}

/* maju satu langkah; return false kalau sudah benar-benar selesai */
function stepOnce(){
  if (!state.active){
    const list = algorithmsToRun();
    if (list.length === 0) return false;
    beginAlgo(list[0]);
    state.queue = list.slice(1);
    return true;
  }

  if (state.idx < state.frames.length - 1){
    state.idx++;
    const f = state.frames[state.idx];
    applyFrame(f, state.active);
    renderLive(f, state.active);
    renderLog(f);
    updateStepIndicator();
    if (f.done) finishAlgo();
    return true;
  }

  // frame terakhir sudah ditampilkan
  finishAlgo();
  if (state.queue.length > 0){
    const next = state.queue.shift();
    beginAlgo(next);
    return true;
  }
  return false;
}

function scheduleTick(){
  const delay = SPEED_DELAYS[state.speedIdx];
  state.timer = setTimeout(() => {
    if (!state.playing) return;
    const advanced = stepOnce();
    if (!advanced){ stopTimer(); $('#stepIndicator').textContent = '✔ simulasi selesai'; return; }
    scheduleTick();
  }, delay);
}

async function startRun(){
  if (state.playing){ stopTimer(); return; }      // tombol jadi pause
  if (state.loading) return;
  resetAll(true);
  state.loading = true;
  try { await loadPackages(); }
  catch (err){ state.loading = false; showError(err); return; }
  state.loading = false;
  const list = algorithmsToRun();
  state.queue = list.slice(1);
  state.playing = true;
  const btn = $('#btnRun');
  btn.classList.add('is-playing');
  btn.innerHTML = '⏸ Pause';
  beginAlgo(list[0]);
  scheduleTick();
}

/* ---------------- Init ---------------- */
function fillSelects(){
  const startSel = $('#startSel'), goalSel = $('#goalSel');
  const kosGroup = KOS_NODES.map(id => `<option value="${id}">${NODE[id].label}</option>`).join('');
  const otherGroup = NODE_LIST.filter(n => !KOS_NODES.includes(n.id))
    .map(n => `<option value="${n.id}">${NODE[n.id].label}</option>`).join('');
  startSel.innerHTML =
    `<optgroup label="Titik awal utama (Kos)">${kosGroup}</optgroup>
     <optgroup label="Eksperimen — node lain">${otherGroup}</optgroup>`;
  startSel.value = state.start;

  goalSel.innerHTML = NODE_LIST.map(n => `<option value="${n.id}">${NODE[n.id].label}</option>`).join('');
  goalSel.value = state.goal;
}

function fillReferenceTables(){
  const heurBody = $('#heurBody');
  const sorted = NODE_LIST.slice().sort((a,b) => a.h - b.h);
  heurBody.innerHTML = sorted.map((n, i) => {
    const real = state.trueDist[n.id];
    const ok = n.h <= real;
    return `<tr>
      <td>${i+1}</td>
      <td><b>${n.label}</b><br><span class="mono" style="color:#94a3b8">${n.id}</span></td>
      <td style="text-align:right" class="num">${n.h}</td>
      <td style="text-align:right">${real} m</td>
      <td>${ok ? '<span class="badge-ok">✓ admissible</span>' : '<span class="badge-ok badge-no">✗ tidak</span>'}</td>
    </tr>`;
  }).join('');

  const edgeBody = $('#edgeBody');
  edgeBody.innerHTML = EDGE_LIST.map((e, i) => `
    <tr>
      <td>${i+1}</td>
      <td><b>${NODE[e.a].label}</b> <span class="arrow">↔</span> <b>${NODE[e.b].label}</b></td>
      <td style="text-align:right" class="num">${e.w} m</td>
      <td>${e.desc}</td>
    </tr>`).join('');
  $('#edgeCount').textContent = `${EDGE_LIST.length} ruas jalan · ${NODE_LIST.length} node`;
}

function showStoredRoute(algo){
  const frame = state.lastFrames[algo];
  if (!frame) return;
  stopTimer();
  $('#btnRun').innerHTML = '▶ Jalankan';
  state.shown = algo;
  $$('.res-card').forEach(c => c.classList.remove('showing'));
  const card = algo === 'astar' ? $('#resAstar') : $('#resBfs');
  card.classList.add('showing');
  applyFrame(frame, algo);
  $('#graphSubtitle').textContent = `Graf menampilkan rute akhir ${algo === 'astar' ? 'A*' : 'BFS'}`;
  $('#stepIndicator').textContent = `rute akhir ${algo === 'astar' ? 'A*' : 'BFS'} ditampilkan`;
}

function bindControls(){
  $$('#algoSeg button').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#algoSeg button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.algo = btn.dataset.algo;
      resetAll();
    });
  });

  $('#startSel').addEventListener('change', e => { state.start = e.target.value; resetAll(); });
  $('#goalSel').addEventListener('change', e => {
    state.goal = e.target.value;
    $$('.node', $('#graph')).forEach(el => el.classList.toggle('is-goal', el.dataset.node === state.goal));
    fetchDijkstra(state.goal).then(d => { state.trueDist = d; }).catch(showError);
    resetAll();
  });

  const speed = $('#speed');
  speed.addEventListener('input', () => {
    state.speedIdx = parseInt(speed.value, 10) - 1;
    $('#speedVal').textContent = `${SPEED_DELAYS[state.speedIdx]} ms`;
  });

  $('#btnRun').addEventListener('click', startRun);

  $('#resAstar').addEventListener('click', () => showStoredRoute('astar'));
  $('#resBfs').addEventListener('click', () => showStoredRoute('bfs'));

  $('#btnStep').addEventListener('click', async () => {
    stopTimer();
    if (!state.active){
      try { await loadPackages(); } catch (err){ showError(err); return; }
    }
    const btn = $('#btnRun');
    btn.innerHTML = '▶ Jalankan';
    btn.classList.remove('is-playing');
    const advanced = stepOnce();
    if (!advanced) $('#stepIndicator').textContent = '✔ simulasi selesai';
  });

  $('#btnReset').addEventListener('click', () => resetAll());
}

async function init(){
  await loadGraph();
  state.start = KOS_NODES[0];
  state.goal  = GOAL_DEFAULT;
  state.trueDist = await fetchDijkstra(GOAL_DEFAULT);
  fillSelects();
  buildGraph();
  fillReferenceTables();
  bindControls();
  $('#speedVal').textContent = `${SPEED_DELAYS[state.speedIdx]} ms`;
  renderLive(null, null);
  renderSummary();
}

init().catch(showError);
