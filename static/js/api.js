/* API client — mengambil data graf & hasil algoritma dari backend Python */
let NODE_LIST = [], EDGE_LIST = [], GOAL_DEFAULT = '', KOS_NODES = [];
let NODE = {}, H = {}, ADJ = {}, EDGE_MAP = {};

const edgeKey = (a, b) => [a, b].slice().sort().join('|');

async function apiGet(url){
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadGraph(){
  const g = await apiGet('/api/graph');
  NODE_LIST    = g.nodes;
  EDGE_LIST    = g.edges;
  GOAL_DEFAULT = g.config.goal_default;
  KOS_NODES    = g.config.kos_nodes;

  NODE = Object.fromEntries(NODE_LIST.map(n => [n.id, n]));
  H    = Object.fromEntries(NODE_LIST.map(n => [n.id, n.h]));
  ADJ = {};  NODE_LIST.forEach(n => { ADJ[n.id] = []; });
  EDGE_MAP = {};
  EDGE_LIST.forEach(e => {
    ADJ[e.a].push({ id:e.b, w:e.w, desc:e.desc });
    ADJ[e.b].push({ id:e.a, w:e.w, desc:e.desc });
    EDGE_MAP[edgeKey(e.a, e.b)] = e;
  });
}

const fetchRun      = (algo, start, goal) =>
  apiGet(`/api/run/${algo}?start=${encodeURIComponent(start)}&goal=${encodeURIComponent(goal)}`);
const fetchDijkstra = goal =>
  apiGet(`/api/dijkstra?goal=${encodeURIComponent(goal)}`);
