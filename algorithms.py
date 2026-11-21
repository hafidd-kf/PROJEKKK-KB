"""
Algoritma pencarian rute: Dijkstra, A*, BFS.
Setiap run_* mengembalikan {algo, frames, result} — frames dipakai frontend
untuk animasi langkah demi langkah.
"""
from graph_store import Graph, edge_key


def path_distance(g: Graph, path):
    d = 0
    for a, b in zip(path, path[1:]):
        e = g.edge_map.get(edge_key(a, b))
        if e is None:
            return float("inf")
        d += e["w"]
    return d


def path_to(node_id, parent):
    p = [node_id]
    guard = 0
    while p[0] in parent and guard < 100:
        p.insert(0, parent[p[0]])
        guard += 1
    return p


def dijkstra_from(g: Graph, target: str):
    """Jarak terpendek aktual dari setiap node ke target (acuan admissibility)."""
    inf = float("inf")
    dist = {n["id"]: inf for n in g.nodes}
    dist[target] = 0
    done = set()
    while True:
        cur = None
        for n in g.nodes:
            nid = n["id"]
            if nid in done:
                continue
            if cur is None or dist[nid] < dist[cur]:
                cur = nid
        if cur is None or dist[cur] == inf:
            break
        done.add(cur)
        for nb in g.adj[cur]:
            if nb["id"] in done:
                continue
            nd = dist[cur] + nb["w"]
            if nd < dist[nb["id"]]:
                dist[nb["id"]] = nd
    return {k: (None if v == inf else v) for k, v in dist.items()}


def _lbl(g, nid):
    return g.node[nid]["label"]


def _astar_sort_key(o):
    return (o["f"], o["h"], o["id"])


# ---------------- A* : f(n) = g(n) + h(n) ----------------
def run_astar(g: Graph, start: str, goal: str):
    frames, logs = [], []
    parent, closed, open_list = {}, set(), []
    expanded = []
    it = 0
    result = None

    logs.append({"cls": "head", "text": f"=== A* ===  {_lbl(g, start)} → {_lbl(g, goal)}"})
    open_list.append({"id": start, "g": 0, "h": g.h[start], "f": g.h[start]})
    logs.append({"cls": "relax", "text":
        f"inisialisasi: open = [ {_lbl(g, start)} | g=0, h={g.h[start]}, f=0+{g.h[start]}={g.h[start]} ]"})

    while True:
        if not open_list:
            logs.append({"cls": "warn", "text": "Open list kosong — tujuan tidak dapat dicapai."})
            frames.append({"logs": list(logs), "done": True, "noPath": True,
                           "expanded": list(expanded), "open": [], "current": None})
            break

        open_list.sort(key=_astar_sort_key)
        cur = open_list.pop(0)
        if cur["id"] in closed:
            continue

        closed.add(cur["id"])
        it += 1
        expanded.append(cur["id"])

        logs.append({"cls": "iter", "text":
            f'Iterasi {it}: ambil "{_lbl(g, cur["id"])}" dari open list (f terkecil)'})
        logs.append({"cls": "relax", "text":
            f'  g({cur["id"]}) = {cur["g"]} m, h({cur["id"]}) = {cur["h"]} m → '
            f'f = {cur["g"]} + {cur["h"]} = {cur["f"]} m'})

        for nb in g.adj[cur["id"]]:
            nid = nb["id"]
            if nid in closed:
                logs.append({"cls": "relax", "text": f"  ↳ {_lbl(g, nid)}: sudah dievaluasi, dilewati"})
                continue
            ng = cur["g"] + nb["w"]
            idx = next((i for i, o in enumerate(open_list) if o["id"] == nid), -1)
            if idx >= 0 and open_list[idx]["g"] <= ng:
                logs.append({"cls": "relax", "text":
                    f"  ↳ {_lbl(g, nid)}: g baru {ng} m tidak lebih baik, dilewati"})
                continue
            if idx >= 0:
                open_list.pop(idx)
            parent[nid] = cur["id"]
            nh = g.h[nid]
            open_list.append({"id": nid, "g": ng, "h": nh, "f": ng + nh})
            logs.append({"cls": "relax", "text":
                f'  ↳ {_lbl(g, nid)}: g = {cur["g"]} + {nb["w"]} = {ng} m, h = {nh} m → '
                f'f = {ng} + {nh} = {ng + nh} m'})

        open_list.sort(key=_astar_sort_key)
        names = ", ".join(f'{_lbl(g, o["id"])}({o["f"]})' for o in open_list) or "kosong"
        logs.append({"cls": "relax", "text": f"  open list → [ {names} ]"})

        is_goal = cur["id"] == goal
        frame = {
            "logs": list(logs),
            "current": cur["id"],
            "expanded": list(expanded),
            "open": [dict(o) for o in open_list],
            "path": path_to(cur["id"], parent),
            "cur": {"g": cur["g"], "h": cur["h"], "f": cur["f"]},
            "iter": it,
            "evaluated": len(expanded),
            "done": False,
        }

        if is_goal:
            gp = path_to(cur["id"], parent)
            logs.append({"cls": "done", "text":
                f"✔ Tujuan tercapai: {' → '.join(_lbl(g, i) for i in gp)}"})
            logs.append({"cls": "done", "text":
                f'  Total jarak = {cur["g"]} m · node dievaluasi = {len(expanded)}'})
            frame["logs"] = list(logs)
            frame["done"] = True
            frame["goalPath"] = gp
            result = {"path": gp, "distance": cur["g"],
                      "evaluated": len(expanded), "order": list(expanded)}

        frames.append(frame)
        if is_goal:
            break

    return {"algo": "astar", "frames": frames, "result": result}


# ---------------- BFS : antrean FIFO, tanpa bobot ----------------
def run_bfs(g: Graph, start: str, goal: str):
    frames, logs = [], []
    parent, seen = {}, {start}
    queue = [{"id": start, "level": 0, "g": 0}]
    dist = {start: 0}
    expanded = []
    it = 0
    result = None

    logs.append({"cls": "head", "text": f"=== BFS ===  {_lbl(g, start)} → {_lbl(g, goal)}"})
    logs.append({"cls": "relax", "text": f"inisialisasi: antrean = [ {_lbl(g, start)} (level 0) ]"})

    while True:
        if not queue:
            logs.append({"cls": "warn", "text": "Antrean kosong — tujuan tidak dapat dicapai."})
            frames.append({"logs": list(logs), "done": True, "noPath": True,
                           "expanded": list(expanded), "open": [], "current": None})
            break

        cur = queue.pop(0)
        it += 1
        expanded.append(cur["id"])

        logs.append({"cls": "iter", "text":
            f'Iterasi {it}: ambil "{_lbl(g, cur["id"])}" dari antrean (level {cur["level"]})'})

        for nb in g.adj[cur["id"]]:
            nid = nb["id"]
            if nid in seen:
                continue
            seen.add(nid)
            parent[nid] = cur["id"]
            dist[nid] = dist[cur["id"]] + nb["w"]
            queue.append({"id": nid, "level": cur["level"] + 1, "g": dist[nid]})
            logs.append({"cls": "relax", "text":
                f'  ↳ masukkan {_lbl(g, nid)} ke antrean (level {cur["level"] + 1})'})

        names = ", ".join(_lbl(g, q["id"]) for q in queue) or "kosong"
        logs.append({"cls": "relax", "text": f"  antrean → [ {names} ]"})

        is_goal = cur["id"] == goal
        frame = {
            "logs": list(logs),
            "current": cur["id"],
            "expanded": list(expanded),
            "open": [{"id": q["id"], "level": q["level"], "g": q["g"]} for q in queue],
            "path": path_to(cur["id"], parent),
            "cur": {"level": cur["level"], "g": dist.get(cur["id"], 0)},
            "iter": it,
            "evaluated": len(expanded),
            "done": False,
        }

        if is_goal:
            gp = path_to(cur["id"], parent)
            d = path_distance(g, gp)
            logs.append({"cls": "done", "text":
                f"✔ Tujuan tercapai: {' → '.join(_lbl(g, i) for i in gp)}"})
            logs.append({"cls": "done", "text":
                f"  Total jarak = {d} m · node dievaluasi = {len(expanded)} "
                f"(jarak dihitung setelah rute terbentuk)"})
            frame["logs"] = list(logs)
            frame["done"] = True
            frame["goalPath"] = gp
            result = {"path": gp, "distance": d,
                      "evaluated": len(expanded), "order": list(expanded)}

        frames.append(frame)
        if is_goal:
            break

    return {"algo": "bfs", "frames": frames, "result": result}


ALGORITHMS = {"astar": run_astar, "bfs": run_bfs}
