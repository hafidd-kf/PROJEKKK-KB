# A* vs BFS — Rute Terpendek Kos → Gedung Fasilkom Unej

Aplikasi web dengan **backend Python (Flask)**. Algoritma A\*, BFS, dan
Dijkstra berjalan di Python; tampilan memakai HTML + CSS + JavaScript;
data graf disimpan di file `data/graph.json`.

## Struktur
```
app.py               server Flask + endpoint API
algorithms.py        A*, BFS, Dijkstra (Python)
graph_store.py       baca & validasi data/graph.json
wsgi.py              entry point produksi
data/graph.json      DATA: node, ruas jalan, bobot, heuristik
templates/index.html halaman utama
static/css/style.css gaya tampilan
static/js/api.js     client API (ambil data & hasil dari server)
static/js/app.js     UI: graf SVG, kontrol, animasi
requirements.txt  Procfile  render.yaml     konfigurasi deploy
```

## Endpoint
| Endpoint | Fungsi |
|---|---|
| `GET /` | halaman web |
| `GET /api/graph` | data graf (dari graph.json) |
| `GET /api/run/<astar\|bfs>?start=..&goal=..` | jalankan algoritma, kembalikan langkah & hasil |
| `GET /api/dijkstra?goal=..` | jarak terpendek aktual ke tujuan |
| `GET /healthz` | cek kesehatan server |

## Mengubah data
Edit `data/graph.json` (tambah node/ruas, ubah bobot). Server memvalidasi
saat start dan memberi pesan error jelas bila ada id yang salah.
Node tujuan harus punya `"h": 0`.

## Jalankan lokal
```
pip install -r requirements.txt
python app.py            # buka http://localhost:5000
```

## Deploy (butuh hosting yang mendukung Python)
- **Render**: push ke GitHub → New Web Service → otomatis memakai `render.yaml`.
- **Railway / Heroku**: otomatis memakai `Procfile` + `requirements.txt`.
- **PythonAnywhere**: upload folder, buat Web app (Flask), arahkan WSGI file ke
  `from app import app as application`.
- **VPS**: `gunicorn wsgi:app --bind 0.0.0.0:8000` (di belakang Nginx).
- **cPanel (Setup Python App)**: Application startup file `wsgi.py`,
  entry point `application`.
