"""FabLab Kanban persistence sidecar.

Pure Python standard library. Owns data.json + backups/ on disk and serves
GET/POST /api/state. Run standalone (`python3 server.py`) to also serve the
static app for local development. In production it runs behind nginx, which
reverse-proxies only /api/ to it.
"""
import json
import os
import shutil
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class StateStore:
    """Reads/writes the JSON state file with atomic writes and throttled backups."""

    def __init__(self, root, backup_interval=300, backup_keep=20, clock=time.time):
        self.root = root
        self.data_path = os.path.join(root, "data.json")
        self.tmp_path = os.path.join(root, "data.json.tmp")
        self.backups_dir = os.path.join(root, "backups")
        self.backup_interval = backup_interval
        self.backup_keep = backup_keep
        self.clock = clock

    def read(self):
        """Return (exists, text). Raises ValueError if an existing file is not valid JSON."""
        if not os.path.exists(self.data_path):
            return (False, None)
        with open(self.data_path, "r", encoding="utf-8") as f:
            text = f.read()
        json.loads(text)  # validate; json.JSONDecodeError is a subclass of ValueError
        return (True, text)

    def write(self, text):
        """Validate JSON, back up the previous file (throttled), then atomically replace.

        Raises ValueError on invalid JSON (caller maps to HTTP 400).
        """
        json.loads(text)  # validate before touching disk
        self._backup_if_due()
        with open(self.tmp_path, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(self.tmp_path, self.data_path)  # atomic swap (safe on SD cards)

    def _backup_if_due(self):
        if not os.path.exists(self.data_path):
            return  # nothing to back up on first ever write
        os.makedirs(self.backups_dir, exist_ok=True)
        now = self.clock()
        last = self._last_backup_time()
        if last is not None and (now - last) < self.backup_interval:
            return  # throttled
        stamp = time.strftime("%Y%m%dT%H%M%S", time.gmtime(now))
        dest = os.path.join(self.backups_dir, "data-%s.json" % stamp)
        suffix = 0
        while os.path.exists(dest):  # avoid same-second collisions
            suffix += 1
            dest = os.path.join(self.backups_dir, "data-%s-%d.json" % (stamp, suffix))
        shutil.copy2(self.data_path, dest)
        os.utime(dest, (now, now))  # pin mtime to clock for deterministic throttling
        self._prune()

    def _backup_files(self):
        if not os.path.isdir(self.backups_dir):
            return []
        return [
            os.path.join(self.backups_dir, n)
            for n in os.listdir(self.backups_dir)
            if n.startswith("data-") and n.endswith(".json")
        ]

    def _last_backup_time(self):
        files = self._backup_files()
        if not files:
            return None
        return max(os.path.getmtime(p) for p in files)

    def _prune(self):
        files = sorted(self._backup_files(), key=os.path.getmtime)
        while len(files) > self.backup_keep:
            os.remove(files.pop(0))


def make_handler(store, serve_static=True, directory=None):
    """Build an http.server handler bound to a given StateStore."""

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)

        def log_message(self, *args):  # keep the journal quiet
            pass

        def _send_json(self, code, obj):
            body = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/api/state":
                try:
                    exists, text = store.read()
                except ValueError:
                    return self._send_json(500, {"error": "corrupt data file"})
                if not exists:
                    self.send_response(204)
                    self.end_headers()
                    return
                body = text.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if serve_static:
                return super().do_GET()
            self.send_response(404)
            self.end_headers()

        def do_POST(self):
            if self.path == "/api/state":
                length = int(self.headers.get("Content-Length", 0) or 0)
                raw = self.rfile.read(length).decode("utf-8") if length else ""
                try:
                    store.write(raw)
                except ValueError:
                    return self._send_json(400, {"error": "invalid JSON"})
                except OSError:
                    return self._send_json(500, {"error": "write failed"})
                return self._send_json(200, {"ok": True})
            self.send_response(404)
            self.end_headers()

    return Handler


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5001"))
    store = StateStore(root)
    handler = make_handler(store, serve_static=True, directory=root)
    httpd = ThreadingHTTPServer((host, port), handler)
    print("FabLab persistence: serving %s on http://%s:%d" % (root, host, port))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    main()
