/* API client — data graf & hasil algoritma dari backend */
let NODE_LIST=[], EDGE_LIST=[], GOAL_DEFAULT='', KOS_NODES=[], NODE={};
const edgeKey=(a,b)=>[a,b].sort().join('|');

async function apiGet(url){
  const res=await fetch(url), data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||`HTTP ${res.status}`);
  return data;
}
async function loadGraph(){
  const g=await apiGet('/api/graph');
  NODE_LIST=g.nodes; EDGE_LIST=g.edges;
  GOAL_DEFAULT=g.config.goal_default; KOS_NODES=g.config.kos_nodes;
  NODE=Object.fromEntries(NODE_LIST.map(n=>[n.id,n]));
}
const fetchRun=(algo,start,goal)=>
  apiGet(`/api/run/${algo}?start=${encodeURIComponent(start)}&goal=${encodeURIComponent(goal)}`);
