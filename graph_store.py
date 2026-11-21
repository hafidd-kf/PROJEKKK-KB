"""Memuat & memvalidasi data graf dari data/graph.json."""
import json
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "graph.json"


class Graph:
    def __init__(self, raw: dict):
        self.config = raw["config"]
        self.nodes = raw["nodes"]
        self.edges = raw["edges"]

        self.node = {n["id"]: n for n in self.nodes}
        self.h = {n["id"]: n["h"] for n in self.nodes}

        # adjacency (graf tak berarah)
        self.adj = {n["id"]: [] for n in self.nodes}
        self.edge_map = {}
        for e in self.edges:
            self.adj[e["a"]].append({"id": e["b"], "w": e["w"], "desc": e["desc"]})
            self.adj[e["b"]].append({"id": e["a"], "w": e["w"], "desc": e["desc"]})
            self.edge_map[edge_key(e["a"], e["b"])] = e

    def validate(self):
        ids = set(self.node)
        if len(ids) != len(self.nodes):
            raise ValueError("graph.json: ada id node yang duplikat")
        for e in self.edges:
            for end in (e["a"], e["b"]):
                if end not in ids:
                    raise ValueError(f"graph.json: edge memakai node tak dikenal '{end}'")
            if e["w"] <= 0:
                raise ValueError(f"graph.json: bobot edge {e['a']}-{e['b']} harus > 0")
        goal = self.config["goal_default"]
        if goal not in ids:
            raise ValueError(f"graph.json: goal_default '{goal}' tidak ada di nodes")
        for k in self.config["kos_nodes"]:
            if k not in ids:
                raise ValueError(f"graph.json: kos_nodes '{k}' tidak ada di nodes")

    def to_dict(self):
        return {"config": self.config, "nodes": self.nodes, "edges": self.edges}


def edge_key(a: str, b: str) -> str:
    return "|".join(sorted([a, b]))


def load_graph(path: Path = DATA_FILE) -> Graph:
    with open(path, encoding="utf-8") as f:
        g = Graph(json.load(f))
    g.validate()
    return g
