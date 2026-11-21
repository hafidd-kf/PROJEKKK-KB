"""
Aplikasi web: A* vs BFS — Rute Terpendek Kos → Gedung Fasilkom Unej.
Backend Flask: algoritma dijalankan di Python, data dibaca dari data/graph.json.

Jalankan lokal :  python app.py            (http://localhost:5000)
Produksi       :  gunicorn wsgi:app
"""
from flask import Flask, jsonify, render_template, request

from algorithms import ALGORITHMS, dijkstra_from
from graph_store import load_graph

app = Flask(__name__)
GRAPH = load_graph()  # divalidasi saat start; error jelas kalau data salah


def _bad_request(msg):
    return jsonify({"error": msg}), 400


def _get_nodes():
    start = request.args.get("start", GRAPH.config["kos_nodes"][0])
    goal = request.args.get("goal", GRAPH.config["goal_default"])
    for name, val in (("start", start), ("goal", goal)):
        if val not in GRAPH.node:
            return None, None, f"parameter '{name}' tidak valid: {val}"
    return start, goal, None


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/graph")
def api_graph():
    return jsonify(GRAPH.to_dict())


@app.get("/api/run/<algo>")
def api_run(algo):
    if algo not in ALGORITHMS:
        return _bad_request(f"algoritma tidak dikenal: {algo}")
    start, goal, err = _get_nodes()
    if err:
        return _bad_request(err)
    return jsonify(ALGORITHMS[algo](GRAPH, start, goal))


@app.get("/api/dijkstra")
def api_dijkstra():
    _, goal, err = _get_nodes()
    if err:
        return _bad_request(err)
    return jsonify(dijkstra_from(GRAPH, goal))


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
