# File-Based Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the kiosk's system of record from browser `localStorage` to a `data.json` file on disk, served by a tiny Python-stdlib persistence sidecar behind nginx, with atomic writes, throttled backups, async client load/save, and an admin Import button.

**Architecture:** nginx stays the static front door and reverse-proxies `/api/` to a localhost Python sidecar (`server.py`) that owns `data.json` + `backups/`. The client (`data.js`) reads/writes via `fetch` (file-only, no localStorage). React boots async behind a loading/error gate.

**Tech Stack:** Python 3 standard library (`http.server`, `unittest`) for the sidecar; existing React-18-via-Babel-standalone front end (no build step, no npm); nginx + systemd on Raspberry Pi.

**Testing note:** The sidecar (`server.py`) is tested with Python's stdlib `unittest` (zero dependencies, runs on the Pi too) — full TDD. The client (`data.js`, `main.jsx`, `admin.jsx`) has **no JS test runner**, and adding one would violate the project's deliberate "no npm / no build" design. Client tasks therefore use **concrete manual verification** (curl + browser DevTools steps) instead of automated tests. This is an intentional, spec-aligned trade-off.

**Reference spec:** `docs/superpowers/specs/2026-06-03-file-based-persistence-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `server.py` (new, project root) | `StateStore` (file I/O, atomic write, backups) + HTTP handler + dev static server |
| `tests/test_server.py` (new) | Unit + integration tests for the sidecar |
| `tests/__init__.py` (new, empty) | Make `tests` a package for discovery |
| `deploy/fablab-kanban-data.service` (new) | systemd unit for the sidecar |
| `deploy/nginx-api-snippet.conf` (new) | nginx `location /api/` block to paste into the site config |
| `app/data.js` (modify) | `migrate()` extraction; async `load`/`save`/`reset`; `saveNow`; debounce; retry; sendBeacon; save events |
| `app/main.jsx` (modify) | `AppRoot` async-bootstrap wrapper; loading/error screens; `App` takes `initialState`; save ref-guard; save-error banner |
| `app/admin.jsx` (modify) | Import JSON button + handler; make reset/start-fresh/seed handlers use async `saveNow`/`reset` |
| `app/i18n.js` (modify) | Import + save-failed strings (en + es) |
| `.gitignore` (modify) | Add `data.json.tmp` |
| `README.md` / `README.en.md` (modify) | systemd unit, nginx `/api/` block, migration runbook, persistence section |

---

## Task 1: StateStore — read & new-install detection

**Files:**
- Create: `server.py`
- Create: `tests/__init__.py` (empty)
- Create: `tests/test_server.py`

- [ ] **Step 1: Create the empty test package marker**

Create `tests/__init__.py` with no content (empty file).

- [ ] **Step 2: Write the failing test**

Create `tests/test_server.py`:

```python
import json
import os
import tempfile
import unittest

from server import StateStore


class StateStoreReadTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.store = StateStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_read_missing_file_signals_new_install(self):
        exists, text = self.store.read()
        self.assertFalse(exists)
        self.assertIsNone(text)

    def test_read_returns_existing_file_text(self):
        path = os.path.join(self.root, "data.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write('{"lab": "X"}')
        exists, text = self.store.read()
        self.assertTrue(exists)
        self.assertEqual(json.loads(text)["lab"], "X")

    def test_read_corrupt_file_raises_valueerror(self):
        path = os.path.join(self.root, "data.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write("{not json")
        with self.assertRaises(ValueError):
            self.store.read()


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server'`.

- [ ] **Step 4: Create server.py with StateStore.read**

Create `server.py`:

```python
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: PASS (3 tests in `StateStoreReadTest`).

- [ ] **Step 6: Commit**

```bash
git add server.py tests/__init__.py tests/test_server.py
git commit -m "feat(server): StateStore.read with new-install + corrupt detection"
```

---

## Task 2: StateStore — atomic write & JSON validation

**Files:**
- Modify: `server.py`
- Test: `tests/test_server.py`

- [ ] **Step 1: Add the failing test class**

Append to `tests/test_server.py` (before the `if __name__` block):

```python
class StateStoreWriteTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.store = StateStore(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def test_write_persists_text_and_removes_tmp(self):
        self.store.write('{"a": 1}')
        with open(os.path.join(self.root, "data.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"a": 1})
        self.assertFalse(os.path.exists(os.path.join(self.root, "data.json.tmp")))

    def test_write_rejects_invalid_json(self):
        with self.assertRaises(ValueError):
            self.store.write("{nope")
        self.assertFalse(os.path.exists(os.path.join(self.root, "data.json")))

    def test_write_then_read_roundtrip(self):
        self.store.write('{"members": []}')
        exists, text = self.store.read()
        self.assertTrue(exists)
        self.assertEqual(json.loads(text), {"members": []})
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: FAIL — `AttributeError: 'StateStore' object has no attribute 'write'`.

- [ ] **Step 3: Add the write method**

In `server.py`, add to the `StateStore` class (after `read`):

```python
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
        """No-op for now; throttled backups added in Task 3."""
        return
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: PASS (all tests in `StateStoreReadTest` and `StateStoreWriteTest`).

- [ ] **Step 5: Commit**

```bash
git add server.py tests/test_server.py
git commit -m "feat(server): StateStore.write with atomic replace + JSON validation"
```

---

## Task 3: StateStore — throttled backups & pruning

**Files:**
- Modify: `server.py`
- Test: `tests/test_server.py`

- [ ] **Step 1: Add the failing test class**

Append to `tests/test_server.py` (before the `if __name__` block):

```python
class FakeClock:
    def __init__(self, t=1000.0):
        self.t = t

    def __call__(self):
        return self.t


class StateStoreBackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        self.clock = FakeClock()
        self.store = StateStore(self.root, backup_interval=300, backup_keep=3, clock=self.clock)

    def tearDown(self):
        self.tmp.cleanup()

    def _backup_files(self):
        d = os.path.join(self.root, "backups")
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def test_first_write_makes_no_backup(self):
        self.store.write('{"v": 1}')  # nothing existed to back up
        self.assertEqual(self._backup_files(), [])

    def test_second_write_backs_up_previous(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')  # backs up the v:1 file
        self.assertEqual(len(self._backup_files()), 1)

    def test_backup_is_throttled_within_interval(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')          # backup #1 at t=1000
        self.clock.t = 1100.0                 # +100s (< 300s)
        self.store.write('{"v": 3}')          # throttled: no new backup
        self.assertEqual(len(self._backup_files()), 1)

    def test_backup_after_interval(self):
        self.store.write('{"v": 1}')
        self.store.write('{"v": 2}')          # backup #1 at t=1000
        self.clock.t = 1400.0                 # +400s (>= 300s)
        self.store.write('{"v": 3}')          # new backup
        self.assertEqual(len(self._backup_files()), 2)

    def test_backups_pruned_to_keep_limit(self):
        self.store.write('{"v": 0}')
        for i in range(1, 6):                 # 5 more writes, each >interval apart
            self.clock.t += 400.0
            self.store.write('{"v": %d}' % i)
        self.assertEqual(len(self._backup_files()), 3)  # backup_keep=3
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: FAIL — backup files are not created (e.g. `test_second_write_backs_up_previous` expects 1, gets 0).

- [ ] **Step 3: Implement throttled backups + pruning**

In `server.py`, replace the placeholder `_backup_if_due` with these methods:

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: PASS (all backup tests plus prior tests).

- [ ] **Step 5: Commit**

```bash
git add server.py tests/test_server.py
git commit -m "feat(server): throttled timestamped backups with pruning"
```

---

## Task 4: HTTP handler + server bootstrap + integration test

**Files:**
- Modify: `server.py`
- Test: `tests/test_server.py`

- [ ] **Step 1: Add the failing integration test**

Append to `tests/test_server.py` (before the `if __name__` block). Add these imports at the **top** of the file as well: `import threading`, `import urllib.request`, `import urllib.error`.

```python
from http.server import ThreadingHTTPServer
from server import make_handler


class ApiIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = StateStore(self.tmp.name)
        handler = make_handler(self.store, serve_static=False)
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.tmp.cleanup()

    def _url(self):
        return "http://127.0.0.1:%d/api/state" % self.port

    def _get(self):
        try:
            with urllib.request.urlopen(self._url()) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    def _post(self, body):
        req = urllib.request.Request(
            self._url(), data=body.encode("utf-8"), method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    def test_get_missing_returns_204(self):
        status, _ = self._get()
        self.assertEqual(status, 204)

    def test_post_then_get_roundtrip(self):
        status, _ = self._post('{"lab": "FabLab"}')
        self.assertEqual(status, 200)
        status, body = self._get()
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["lab"], "FabLab")

    def test_post_invalid_json_returns_400(self):
        status, _ = self._post("{bad")
        self.assertEqual(status, 400)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: FAIL — `ImportError: cannot import name 'make_handler' from 'server'`.

- [ ] **Step 3: Add the handler factory and server bootstrap**

In `server.py`, update the imports at the top to:

```python
import json
import os
import shutil
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
```

Then append at the **end** of `server.py` (after the `StateStore` class):

```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: PASS (all tests across all classes).

- [ ] **Step 5: Manual smoke test of the standalone server**

Run (from project root): `python3 server.py` (leave running in one terminal).
In another terminal:

```bash
curl -i http://127.0.0.1:5001/api/state                      # expect: HTTP/1.0 204 No Content
curl -i -X POST http://127.0.0.1:5001/api/state -H 'Content-Type: application/json' -d '{"lab":"smoke"}'  # expect 200 {"ok": true}
curl -s http://127.0.0.1:5001/api/state                      # expect: {"lab":"smoke"}
ls data.json backups/ 2>/dev/null                            # data.json exists; backups/ may be empty after one write
```

Then stop the server (Ctrl+C) and clean up the smoke artifacts:

```bash
rm -f data.json data.json.tmp; rm -rf backups
```

Expected: 204 then 200 then the echoed JSON; `data.json` created. (These files are git-ignored.)

- [ ] **Step 6: Commit**

```bash
git add server.py tests/test_server.py
git commit -m "feat(server): /api/state GET+POST handler, dev static serving, main()"
```

---

## Task 5: Deploy artifacts (systemd unit + nginx snippet + gitignore)

**Files:**
- Create: `deploy/fablab-kanban-data.service`
- Create: `deploy/nginx-api-snippet.conf`
- Modify: `.gitignore`

- [ ] **Step 1: Create the systemd unit**

Create `deploy/fablab-kanban-data.service`:

```ini
[Unit]
Description=FabLab Kanban persistence sidecar (data.json API)
After=network.target

[Service]
Type=simple
User=fablab
WorkingDirectory=/home/fablab/FabLabKanban
ExecStart=/usr/bin/python3 server.py
Environment=HOST=127.0.0.1
Environment=PORT=5001
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create the nginx API snippet**

Create `deploy/nginx-api-snippet.conf`:

```nginx
# Paste this location block inside the existing `server { ... }` block in
# /etc/nginx/sites-available/fablab-kanban, alongside the static `location /`.
location /api/ {
    proxy_pass http://127.0.0.1:5001;
    proxy_set_header Host $host;
    proxy_read_timeout 30s;
}

# Also add ordering to the nginx unit so the sidecar starts first. Run:
#   sudo systemctl edit nginx
# and add:
#   [Unit]
#   Wants=fablab-kanban-data.service
#   After=fablab-kanban-data.service
```

- [ ] **Step 3: Ignore the temp write file**

In `.gitignore`, under the "Server-side persisted state" section, add `data.json.tmp`:

```gitignore
# Server-side persisted state (runtime data, not source)
data.json
data.json.tmp
data.json.bak
backups/
```

- [ ] **Step 4: Verify the tmp file is ignored**

Run: `git check-ignore data.json.tmp`
Expected: prints `data.json.tmp`.

- [ ] **Step 5: Commit**

```bash
git add deploy/fablab-kanban-data.service deploy/nginx-api-snippet.conf .gitignore
git commit -m "chore(deploy): systemd unit, nginx /api/ snippet, ignore data.json.tmp"
```

---

## Task 6: data.js — migrate() extraction + async load()

**Files:**
- Modify: `app/data.js`

No JS test runner exists (see Testing note). Verification is manual via the running sidecar + browser.

- [ ] **Step 1: Add config constants and a delay helper**

In `app/data.js`, replace the line `const STORAGE_KEY = "fablab_utp_v3";` with:

```javascript
  // ---- persistence config ----------------------------------------------
  const API_URL = "/api/state";
  const SAVE_DEBOUNCE_MS = 750;
  const LOAD_RETRIES = 5;
  const LOAD_RETRY_DELAY_MS = 1000;

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
```

- [ ] **Step 2: Extract the migration logic into `migrate()`**

In `app/data.js`, add this function immediately **above** the existing `function load() {` line:

```javascript
  // ---- migrations (run on any loaded or imported state) ----------------
  function migrate(state) {
    if (!state.lastReset) state.lastReset = todayStr();
    if (!state.machines || !state.machines.length) state.machines = clone(SEED_MACHINES);
    if (!state.idleMinutes) state.idleMinutes = 3;
    if (!state.lang) state.lang = "en";
    (state.machines || []).forEach(function (m) {
      if (m.color && m.color.indexOf("var(") === 0) {
        var found = SEED_MACHINES.find(function (s) { return s.id === m.id; });
        if (found) m.color = found.color;
      }
    });
    (state.cards || []).forEach(function (c) { if (!c.estMin) c.estMin = 120; });
    (state.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });
    (state.archived || []).forEach(function (day) {
      (day.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });
    });
    if (!state.attendance) state.attendance = [];
    (state.members || []).forEach(function (m) { if (!('checkedInAt' in m)) m.checkedInAt = null; });
    if (!state.completedTasks) state.completedTasks = state.archived || [];
    if (!state.cancelledTasks) state.cancelledTasks = [];
    delete state.archived;
    syncMachines(state.machines);
    return state;
  }
```

- [ ] **Step 3: Replace `load()` with the async fetch version**

In `app/data.js`, replace the entire existing `function load() { ... }` block (from `function load() {` through its closing `}` just before `function save(state) {`) with:

```javascript
  // ---- persist ---------------------------------------------------------
  async function load() {
    var lastErr = null;
    for (var attempt = 0; attempt < LOAD_RETRIES; attempt++) {
      try {
        var res = await fetch(API_URL, { method: "GET", cache: "no-store" });
        if (res.status === 204) {
          return buildEmpty(clone(SEED_MACHINES), 'es');  // first run
        }
        if (!res.ok) throw new Error("HTTP " + res.status);
        var state = await res.json();
        return migrate(state);
      } catch (e) {
        lastErr = e;
        if (attempt < LOAD_RETRIES - 1) await delay(LOAD_RETRY_DELAY_MS);
      }
    }
    throw lastErr || new Error("load failed");  // caller shows error+Retry; never seeds
  }
```

- [ ] **Step 4: Manual verification — load paths**

Start the sidecar from project root: `python3 server.py`. Open `http://127.0.0.1:5001` in a browser with DevTools Console open.

- New-install path: ensure no `data.json` exists first (`rm -f data.json`), reload. Expect the app to render an empty board (no demo cards/members) and a `GET /api/state` → 204 in the Network tab.
- Error path: stop the sidecar, run in the Console: `await FabData.load()` — expect it to retry ~5× over ~5s then reject with an error (it must NOT return seeded data).

(The board may show JS errors from `main.jsx` until Task 9 — that is expected; verify the `FabData.load()` behavior directly in the Console.)

- [ ] **Step 5: Commit**

```bash
git add app/data.js
git commit -m "feat(data): async load() via /api/state with retry + migrate() extraction"
```

---

## Task 7: data.js — debounced save(), saveNow(), sendBeacon, events

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Replace `save()` with the debounced, event-emitting version**

In `app/data.js`, replace the entire existing `function save(state) { ... }` block with:

```javascript
  var _saveTimer = null;
  var _pendingText = null;

  function _emit(name) {
    try { window.dispatchEvent(new CustomEvent(name)); } catch (e) {}
  }

  function _postState(text) {
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res;
    });
  }

  function _scheduleFlush() {
    if (_saveTimer != null) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () { _saveTimer = null; _flush(); }, SAVE_DEBOUNCE_MS);
  }

  function _flush() {
    if (_pendingText == null) return;
    var text = _pendingText;
    _pendingText = null;
    _emit("fabdata:saving");
    _postState(text)
      .then(function () { _emit("fabdata:saved"); })
      .catch(function () {
        _emit("fabdata:saveerror");
        if (_pendingText == null) _pendingText = text;  // keep newest if a newer save arrived
        _scheduleFlush();                                 // retry after debounce window
      });
  }

  function save(state) {
    _pendingText = JSON.stringify(state);
    _scheduleFlush();
  }

  function saveNow(state) {
    if (_saveTimer != null) { clearTimeout(_saveTimer); _saveTimer = null; }
    _pendingText = null;
    var text = JSON.stringify(state);
    _emit("fabdata:saving");
    return _postState(text)
      .then(function () { _emit("fabdata:saved"); })
      .catch(function (e) { _emit("fabdata:saveerror"); throw e; });
  }

  // Flush any pending debounced save on tab close/reload.
  window.addEventListener("beforeunload", function () {
    if (_pendingText != null && navigator.sendBeacon) {
      var blob = new Blob([_pendingText], { type: "application/json" });
      navigator.sendBeacon(API_URL, blob);
      _pendingText = null;
    }
  });
```

- [ ] **Step 2: Manual verification — debounce, retry, beacon**

With the sidecar running and the app open at `http://127.0.0.1:5001` (DevTools → Network):

- Debounce: run `FabData.save({a:1}); FabData.save({a:2}); FabData.save({a:3});` quickly in the Console. Expect exactly **one** `POST /api/state` ~750ms later, body `{"a":3}`.
- Success event: run `addEventListener('fabdata:saved', () => console.log('SAVED'))` then `FabData.save({ok:1})` — expect `SAVED` logged after the POST.
- Retry: stop the sidecar, run `FabData.save({x:1})`, watch the Console/Network — expect a `fabdata:saveerror` and repeated retry POST attempts. Restart the sidecar; the next retry should succeed and emit `fabdata:saved`.

(Restore good data afterward by reloading once the sidecar is back, or re-importing in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add app/data.js
git commit -m "feat(data): debounced save + saveNow + sendBeacon flush + save events"
```

---

## Task 8: data.js — async reset() + expose migrate/saveNow

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Replace `reset()` with the async version**

In `app/data.js`, replace the entire existing `function reset() { ... }` block with:

```javascript
  async function reset() {
    var empty = buildEmpty(clone(SEED_MACHINES), 'es');
    await saveNow(empty);
    return empty;
  }
```

- [ ] **Step 2: Expose `migrate` and `saveNow` on the public API**

In `app/data.js`, in the `window.FabData = { ... }` object, add these entries next to `save: save,`:

```javascript
    save: save,
    saveNow: saveNow,
    migrate: migrate,
```

- [ ] **Step 3: Manual verification — API surface**

With the app loaded, in the Console run:

```javascript
typeof FabData.saveNow === 'function' && typeof FabData.migrate === 'function' && typeof FabData.reset().then === 'function'
```

Expect: `true`. Then confirm `data.json` now contains the empty reset state (`curl -s http://127.0.0.1:5001/api/state`).

- [ ] **Step 4: Commit**

```bash
git add app/data.js
git commit -m "feat(data): async reset() and expose saveNow + migrate"
```

---

## Task 9: main.jsx — async bootstrap, loading/error gate, save guard, error banner

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Add the `t` alias and small screen components at the top**

In `app/main.jsx`, replace the first line `const IDLE_MS = 3 * 60 * 1000;` with:

```javascript
const IDLE_MS = 3 * 60 * 1000;
const t = window.I18n ? window.I18n.t : function (k) { return k; };

function LoadingScreen() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", color: "var(--text-2)",
      font: "600 18px/1.4 Figtree, sans-serif" }}>
      Cargando… / Loading…
    </div>
  );
}

function ErrorScreen({ onRetry }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      gap: 16, alignItems: "center", justifyContent: "center", background: "var(--bg)",
      color: "var(--text-1)", textAlign: "center", padding: 24 }}>
      <div style={{ font: "700 20px/1.3 Figtree, sans-serif" }}>
        No se pudo conectar con el servicio de datos.<br />Could not reach the data service.
      </div>
      <button className="btn btn-accent" onClick={onRetry}>Reintentar / Retry</button>
    </div>
  );
}
```

- [ ] **Step 2: Change `App` to take `initialState` and guard the save effect**

In `app/main.jsx`, replace these two lines:

```javascript
function App() {
  const [state, setState] = React.useState(() => window.FabData.load());
```

with:

```javascript
function App({ initialState }) {
  const [state, setState] = React.useState(initialState);
```

Then replace the save effect line:

```javascript
  // Persist state on every change
  React.useEffect(() => { window.FabData.save(state); }, [state]);
```

with (skip the first run so the freshly-loaded state is not echoed straight back, and surface save failures):

```javascript
  // Persist state on every change (skip the first, freshly-loaded value)
  const firstSaveSkipped = React.useRef(false);
  React.useEffect(() => {
    if (!firstSaveSkipped.current) { firstSaveSkipped.current = true; return; }
    window.FabData.save(state);
  }, [state]);

  // Track save failures for the banner
  const [saveError, setSaveError] = React.useState(false);
  React.useEffect(() => {
    function onErr() { setSaveError(true); }
    function onOk() { setSaveError(false); }
    window.addEventListener("fabdata:saveerror", onErr);
    window.addEventListener("fabdata:saved", onOk);
    return () => {
      window.removeEventListener("fabdata:saveerror", onErr);
      window.removeEventListener("fabdata:saved", onOk);
    };
  }, []);
```

- [ ] **Step 3: Render the save-error banner**

In `app/main.jsx`, inside the returned `<React.Fragment>`, add this as the **first** child (immediately after `<React.Fragment>`):

```javascript
      {saveError && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
          background: "var(--danger, #e23c34)", color: "#fff", textAlign: "center",
          padding: "6px 12px", font: "600 13px/1.4 Figtree, sans-serif" }}>
          {t('app.save_failed', state.lang || 'es')}
        </div>
      )}
```

- [ ] **Step 4: Replace the render call with the async-bootstrapping `AppRoot`**

In `app/main.jsx`, replace the final line:

```javascript
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

with:

```javascript
function AppRoot() {
  const [phase, setPhase] = React.useState("loading"); // loading | ready | error
  const [initial, setInitial] = React.useState(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    window.FabData.load()
      .then(s => { if (!cancelled) { setInitial(s); setPhase("ready"); } })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [attempt]);

  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error") return <ErrorScreen onRetry={() => setAttempt(a => a + 1)} />;
  return <App initialState={initial} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot />);
```

- [ ] **Step 5: Manual verification — bootstrap gate**

With the sidecar running, open `http://127.0.0.1:5001`:

- Normal: briefly see the loading screen, then the board. Make an edit (add a card); ~750ms later a single `POST /api/state` appears and `data.json` updates.
- Error+Retry: stop the sidecar, reload the page → after ~5 retries you see the Error screen. Start the sidecar, click **Retry** → the board loads.
- No-echo: reload with the sidecar up and watch Network — there should be **no** `POST` immediately after load (only after a real edit).
- Banner: with the board open, stop the sidecar and make an edit → the red "Save failed — retrying…" banner appears; restart the sidecar → banner clears.

- [ ] **Step 6: Commit**

```bash
git add app/main.jsx
git commit -m "feat(app): async bootstrap gate, save ref-guard, save-error banner"
```

---

## Task 10: admin.jsx — Import JSON button + async handlers

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Make reset/start-fresh/seed handlers use async persistence**

In `app/admin.jsx`, replace `handleReset` (currently around line 795):

```javascript
  const handleReset = () => {
    if (confirm(t('admin.reset_confirm', lang))) {
      const fresh = FabData.reset();
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };
```

with:

```javascript
  const handleReset = () => {
    if (confirm(t('admin.reset_confirm', lang))) {
      FabData.reset().then(fresh => {
        setState(fresh);
        setPasswordValue(fresh.password || '');
      });
    }
  };
```

Replace the `FabData.save(fresh);` line inside `handleStartFresh` with `FabData.saveNow(fresh);`.
Replace the `FabData.save(fresh);` line inside `handleSeedInit` with `FabData.saveNow(fresh);`.

- [ ] **Step 2: Add the import handler**

In `app/admin.jsx`, add immediately **after** the `exportJSON` function (around line 792):

```javascript
  const importInputRef = React.useRef(null);

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.value = "";  // allow re-importing the same filename
      importInputRef.current.click();
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (err) { alert(t('admin.import_error', lang)); return; }
      if (!confirm(t('admin.import_confirm', lang))) return;
      const migrated = FabData.migrate(parsed);
      FabData.saveNow(migrated)
        .then(() => {
          setState(migrated);
          setPasswordValue(migrated.password || '');
        })
        .catch(() => alert(t('admin.import_error', lang)));
    };
    reader.readAsText(file);
  };
```

- [ ] **Step 3: Add the Import button + hidden file input to the export row**

In `app/admin.jsx`, in the export row (around line 1023), add the button and input right after the Export JSON button:

```javascript
                <button className="btn btn-accent" onClick={exportJSON}>{t('admin.export_json', lang)}</button>
                <button className="btn btn-accent" onClick={handleImportClick}>{t('admin.import_json', lang)}</button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={handleImportFile}
                />
```

- [ ] **Step 4: Manual verification — import roundtrip**

With the sidecar running and the app open: export a JSON (Export JSON), reset the board (Reset), then **Import JSON** and choose the file you exported. Confirm the dialog → the board repopulates and `curl -s http://127.0.0.1:5001/api/state` shows the imported data. Also try importing a non-JSON file (e.g. a `.txt`) → expect the "invalid JSON" alert and no change.

- [ ] **Step 5: Commit**

```bash
git add app/admin.jsx
git commit -m "feat(admin): Import JSON restore + async reset/start-fresh/seed handlers"
```

---

## Task 11: i18n.js — import + save-failed strings

**Files:**
- Modify: `app/i18n.js`

- [ ] **Step 1: Add the new keys**

In `app/i18n.js`, add these entries next to the existing `"admin.export_json"` entry (around line 171):

```javascript
    "admin.import_json":         { en: "Import JSON",             es: "Importar JSON" },
    "admin.import_confirm":      { en: "Replace ALL current data with the imported file? This cannot be undone.", es: "¿Reemplazar TODOS los datos actuales con el archivo importado? No se puede deshacer." },
    "admin.import_error":        { en: "Could not import: invalid JSON file.", es: "No se pudo importar: archivo JSON inválido." },
    "app.save_failed":           { en: "Save failed — retrying…", es: "Error al guardar — reintentando…" },
```

- [ ] **Step 2: Manual verification — keys resolve**

In the Console: `window.I18n.t('admin.import_json','es')` → `"Importar JSON"`; `window.I18n.t('app.save_failed','en')` → `"Save failed — retrying…"`.

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat(i18n): import + save-failed strings (en + es)"
```

---

## Task 12: README updates (deployment + persistence)

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Update the persistence section in `README.md`**

In `README.md`, replace the **Persistencia** bullet block:

```markdown
**Persistencia**
- Todo se guarda automáticamente en `localStorage` bajo la clave `fablab_utp_v3`
- No se necesita backend
```

with:

```markdown
**Persistencia**
- Todo se guarda en un archivo `data.json` en el disco de la Raspberry Pi (no en el navegador)
- Un pequeño servicio Python (`server.py`, sólo biblioteca estándar) gestiona la lectura/escritura vía `GET`/`POST /api/state`
- Escrituras atómicas (archivo temporal → `os.replace`) y copias de seguridad rotativas en `backups/` (máx. 20, como mucho una cada 5 min)
- nginx sirve los archivos estáticos y reenvía `/api/` al servicio en `127.0.0.1:5001`
- Botón **Importar JSON** en el panel de administración para restaurar una exportación
```

- [ ] **Step 2: Add a deployment subsection to `README.md`**

In `README.md`, immediately after the nginx config block in the deployment section, add:

```markdown
#### 2b. Servicio de persistencia (sidecar)

El archivo `data.json` lo gestiona un servicio Python que corre junto a nginx.

```bash
sudo cp /home/fablab/FabLabKanban/deploy/fablab-kanban-data.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fablab-kanban-data
```

Añade el bloque `location /api/` (ver `deploy/nginx-api-snippet.conf`) dentro del `server { ... }` de nginx y asegúrate de que nginx arranque después del sidecar:

```bash
sudo systemctl edit nginx   # añade:  [Unit]\n  Wants=fablab-kanban-data.service\n  After=fablab-kanban-data.service
sudo nginx -t && sudo systemctl reload nginx
```

> ⚠️ El bloque `/api/` no está activo hasta que **recargas nginx**. No te saltes ese paso.
```

- [ ] **Step 3: Add the migration runbook to `README.md`**

In `README.md`, at the end of the "Primer despliegue en producción" section, add:

```markdown
#### Migrar datos existentes (de localStorage a archivo)

Si ya tenías datos en el navegador y acabas de actualizar a la versión con persistencia en archivo:

1. Despliega el código, copia y arranca el servicio `fablab-kanban-data`, y recarga nginx (pasos arriba).
2. Abre la app: mostrará un tablero vacío (nueva instalación).
3. Abre **Ajustes** (contraseña) → **Importar JSON** → elige tu copia de seguridad (`fablab-utp-AAAA-MM-DD.json`).
4. Confirma. Los datos quedan en `data.json`. Haz copias de seguridad copiando ese archivo.
```

- [ ] **Step 4: Mirror the three changes in `README.en.md`**

Apply the equivalent English edits to `README.en.md`: the **Persistence** bullet block (file-based, Python sidecar, atomic writes + rotating backups max 20 / ≤1 per 5 min, nginx proxies `/api/`, Import JSON button); a "2b. Persistence service (sidecar)" subsection with the same `systemctl` commands and the "reload nginx" warning; and a "Migrate existing data" runbook with the same 4 steps in English.

- [ ] **Step 5: Commit**

```bash
git add README.md README.en.md
git commit -m "docs: document file-based persistence, sidecar deploy, migration runbook"
```

---

## Task 13: End-to-end verification + import the real backup

**Files:** none (verification + data migration only)

- [ ] **Step 1: Full server test suite**

Run: `python3 -m unittest discover -t . -s tests -v`
Expected: all tests PASS.

- [ ] **Step 2: Clean-room end-to-end in the browser**

From the project root with no `data.json` present (`rm -f data.json data.json.tmp; rm -rf backups`), start `python3 server.py` and open `http://127.0.0.1:5001`:

1. App shows loading → empty board (new install). Network shows `GET /api/state` → 204.
2. Admin → **Import JSON** → choose `fablab-utp-2026-06-02.json` (your real backup in the project root) → confirm.
3. Board repopulates with the real members/cards. `curl -s http://127.0.0.1:5001/api/state | head -c 200` shows the imported data.
4. Move a card; within ~1s one `POST /api/state` fires; reload the page → the change persisted (came from the file, not localStorage).
5. Confirm independence from the browser: run `localStorage.clear()` in the Console, reload → data is **still there** (proves it's file-backed).

- [ ] **Step 3: Stop the dev server and confirm no data committed**

Run: `git status --porcelain` → expect no `data.json`, `data.json.tmp`, `backups/`, or `fablab-utp-*.json` staged or untracked-and-listed-as-committable (they are git-ignored).

- [ ] **Step 4: Final commit (if any docs/notes changed) — otherwise none**

No code commit expected here; this task is verification. If you adjusted anything, commit with a descriptive message.

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** sidecar routes (Tasks 1–4), 204 new-install (T1/T4), atomic write (T2), throttled+pruned backups 5min/20 (T3), file-only async load with retry (T6), debounced save + sendBeacon + events (T7), async reset (T8), bootstrap loading/error gate + ref guard + banner (T9), Import button (T10), i18n (T11), boot ordering via systemd + client retry (T5 + T6/T9), deploy + runbook (T5/T12). All spec sections map to a task.
- **Type/name consistency:** `StateStore`, `make_handler(store, serve_static, directory)`, `FabData.load/save/saveNow/reset/migrate`, events `fabdata:saving|saved|saveerror`, i18n keys `admin.import_json|import_confirm|import_error`, `app.save_failed` are used identically across tasks.
- **Constants locked:** `SAVE_DEBOUNCE_MS=750`, `LOAD_RETRIES=5`, `LOAD_RETRY_DELAY_MS=1000`, `backup_interval=300`, `backup_keep=20`, sidecar `127.0.0.1:5001`.
