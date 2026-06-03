# File-Based Persistence — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Branch context:** `feat/checkin-features`

## Problem

All application state lives in the browser's `localStorage` under the key
`fablab_utp_v3` (see `app/data.js` `load()`/`save()`). On the Raspberry Pi kiosk this
data physically resides inside Chromium's profile
(`~/.config/chromium/Default/Local Storage/leveldb/`). That makes the browser the
system of record, which is fragile: clearing browser data, re-imaging the SD card,
switching browser/user profiles, profile corruption, or storage eviction all destroy
the lab's real data with no recovery.

The data must persist in a **file outside the browser** so it survives browser resets
and can be backed up by copying a file.

## Goals

- Persist all state to a JSON file on disk (`data.json`), not in the browser.
- Keep the project's "no build step / minimal dependencies" ethos (no pip installs,
  no Node, no bundler).
- Preserve the existing nginx + systemd production deployment; add to it rather than
  replace it.
- Make existing data recoverable into the new system (Import button — in scope).
- Be safe against power-loss corruption on SD cards (atomic writes).
- Limit SD-card wear (debounced saves, throttled backups).

## Non-Goals (YAGNI)

- **Multi-writer concurrency:** last-write-wins. The kiosk is the single writer.
  Additional viewers (e.g. someone opening the Pi's IP from a phone) are an accepted
  edge case and a known limitation, not a supported concurrent-edit scenario.
- **Auth on `/api/`:** the sidecar binds to `127.0.0.1` only and is reached through the
  same nginx that already serves the app. No new auth surface.
- **A real database:** the file is the store.
- **Keeping localStorage as a fallback:** explicitly dropped. File-only avoids
  split-brain between localStorage and the file. The cost (no offline cache) is
  mitigated by robust load error handling instead.

## Architecture

```
            ┌─────────────────────────── Raspberry Pi ───────────────────────────┐
            │                                                                     │
  Chromium ─┼─▶ nginx :80  ───▶ static files (index.html, app/*)   [unchanged]    │
  (kiosk)   │        │                                                            │
            │        └── location /api/  ──proxy_pass──▶ 127.0.0.1:5001           │
            │                                            persistence sidecar       │
            │                                            (server.py, systemd)      │
            │                                            owns data.json + backups/ │
            └─────────────────────────────────────────────────────────────────────┘
```

- **nginx** keeps serving `index.html` + `app/` exactly as today. One new `location`
  block reverse-proxies `/api/` to the sidecar.
- **Persistence sidecar** (`server.py`): pure Python standard library (`http.server`),
  bound to `127.0.0.1:5001`. Owns `data.json` and the `backups/` directory. Runs as its
  own systemd unit.
- **Local dev:** the same `server.py`, run standalone, serves *both* the static files
  and `/api/` on one port — so development needs no nginx.
- **File-only:** no localStorage. The file is the single source of truth.

## Locked Constants

| Constant                | Value            | Where        |
|-------------------------|------------------|--------------|
| Sidecar bind address    | `127.0.0.1:5001` | `server.py`  |
| Data file               | `data.json`      | `server.py`  |
| Backup directory        | `backups/`       | `server.py`  |
| Backups retained        | **20** (prune oldest) | `server.py` |
| Backup throttle         | at most **once per 5 minutes (300 s)** | `server.py` |
| Save debounce window     | **750 ms**       | `data.js`    |
| Load retry attempts     | **5**            | `data.js`    |
| Load retry backoff      | **1 s** between attempts | `data.js` |

## Component: Persistence Sidecar (`server.py`)

Pure `http.server`, no third-party packages.

### Routes

- `GET /api/state`
  - If `data.json` exists → `200` with the file contents (`application/json`).
  - If `data.json` does **not** exist → `204 No Content`. This is the **new-install
    signal**: the API never invents data; the client runs its existing first-run/seed
    flow. (Decision: 204 = new install.)
  - On read/parse error of an existing file → `500` with a short JSON error body.

- `POST /api/state`
  - Body must be valid JSON; otherwise `400`.
  - **Atomic write** (critical for SD cards under power loss):
    1. Write the new content to `data.json.tmp`.
    2. `flush()` + `os.fsync()` the temp file's descriptor.
    3. `os.replace('data.json.tmp', 'data.json')` — atomic swap on the same filesystem.
  - **Throttled timestamped backup** of the *previous* state:
    - Just before the `os.replace` swap, if `data.json` already exists **and** no backup
      has been made within the last **300 s**, copy the current (about-to-be-replaced)
      `data.json` to `backups/data-<ISO8601>.json`, then update the last-backup timestamp.
    - After backing up (or skipping due to throttle), prune `backups/` to the most recent
      **20** files (delete oldest).
    - Throttling limits SD writes during rapid editing; backups capture the state prior to
      each (throttled) save so a bad write can be rolled back.
  - Returns `200` with a small JSON ack on success; `500` on write failure.

- Static serving (standalone/dev mode only): when not behind nginx, serve files from the
  project root so `server.py` alone runs the whole app.

### Notes

- Bind to `127.0.0.1` only — never `0.0.0.0`. No CORS needed (same-origin via nginx).
- Create `backups/` on startup if missing.
- The server owns no schema knowledge; it stores and returns opaque JSON. All migration
  logic stays client-side in `data.js`.

## Component: Client Data Layer (`data.js`)

`load()`, `save()`, and `reset()` change from synchronous localStorage access to async
HTTP. The seed/migration/helper logic is otherwise reused unchanged.

### `load()` → async

- `fetch('/api/state')` with retry: up to **5** attempts, **1 s** apart, on
  network error or `5xx`. (This also covers the boot race — see Boot Ordering.)
- On `200`: parse JSON, run the **existing migration block** (the same field
  back-fills currently in `load()`, so that imported older exports upgrade cleanly),
  `syncMachines`, and return the state. No write-back on load.
- On `204`: return `buildEmpty(clone(SEED_MACHINES), 'es')` — first-run path. (Seeding
  demo data remains a separate explicit admin action, as today.)
- On exhausting retries (network/`5xx`): **throw**. Do **not** seed, do **not** write.
  This is what prevents overwriting good on-disk data when the API is briefly down.

### `save(state)` → debounced, fire-and-forget

- Schedule a debounced `POST /api/state` **750 ms** after the last call (coalesces
  rapid state changes from drag/edit interactions).
- Register a `beforeunload` handler that flushes any pending save via
  `navigator.sendBeacon('/api/state', blob)` so a close/reload doesn't lose the last edit.
- On `POST` failure: surface a visible "save failed / retrying" state (reuse the
  existing `saver` UI indicator) and keep retrying. Never silently drop a change.

### `reset()` → async

- Build fresh state and `POST` it (so the file reflects the reset). Returns the new state.

## Component: Bootstrap (`main.jsx`)

The app currently boots synchronously: `useState(() => FabData.load())` and a
`useEffect` that saves on every `state` change. This becomes async:

- `const [state, setState] = useState(null)` plus a load status
  (`'loading' | 'ready' | 'error'`).
- `useEffect(() => { load }, [])` calls `FabData.load()`:
  - resolves → `setState(...)`, status `ready`.
  - throws → status `error`.
- Render gates:
  - `loading` → a minimal **loading screen**.
  - `error` → an **error screen with a Retry button** (re-runs `load()`). This is the
    user-visible guard against the API being down.
  - `ready` → the existing board UI.
- The save `useEffect`:
  - skips while `state === null` / status not `ready`.
  - uses a **ref guard** to skip the **first** loaded value, so the freshly loaded state
    is not immediately echoed back as a redundant save.

## Import / Restore (in scope — same PR)

Without an import path the migration is only half done (export exists today; restore
currently requires a manual `localStorage.setItem`). Add to the admin panel, next to the
existing **Export JSON** button (`app/admin.jsx:1023`):

- **Import JSON** button → hidden `<input type="file" accept="application/json">`.
- On file chosen: `FileReader` → `JSON.parse` → run migrations → `confirm()` dialog
  ("This will replace all current data. Continue?") → `FabData.save()`/POST the imported
  state → reload state into the app.
- This is the supported path to load the existing backup
  (`fablab-utp-2026-06-02.json`) into the new system as the initial `data.json`.
- Add i18n keys (en + es) for the button and confirm text, matching existing admin
  i18n conventions.

## Boot Ordering (race: sidecar vs. kiosk browser)

The Chromium kiosk is launched by LXDE autostart, not systemd, so systemd ordering alone
can't gate the browser. Use belt-and-suspenders:

1. **systemd ordering:** nginx unit gets `Wants=fablab-kanban-data.service` and
   `After=fablab-kanban-data.service`; the sidecar unit is `WantedBy=multi-user.target`.
   This ensures the sidecar is started before nginx.
2. **Client load retry** (already specified: 5 attempts, 1 s apart): if the page loads
   before the sidecar is ready, the client retries and the user briefly sees the loading
   screen instead of the error screen. This is the primary mitigation and needs no OS
   plumbing beyond (1).

## Deployment Changes (README update)

- New systemd unit `fablab-kanban-data.service` (runs `python3 server.py` in the project
  dir, `Restart=always`, `User=fablab`/`pi`).
- nginx config: add `location /api/ { proxy_pass http://127.0.0.1:5001; }` and the
  `Wants=`/`After=` ordering on the nginx unit.
- Migration runbook:
  1. Deploy code, create + enable the sidecar service, reload nginx.
  2. Open the app → it shows the empty/new-install board.
  3. Admin (gear → password) → **Import JSON** → choose the backup file → confirm.
  4. Data is now in `data.json`; back it up by copying that file.
- `.gitignore` already excludes `data.json`, `data.json.bak`, `backups/`, and
  `fablab-utp-*.json/.csv`.

## Files Touched

| File                         | Change |
|------------------------------|--------|
| `server.py` (new)            | Python-stdlib persistence sidecar + dev static server |
| `app/data.js`                | `load`/`save`/`reset` → async HTTP; debounce; retry; sendBeacon |
| `app/main.jsx`               | async bootstrap, loading/error/Retry gates, save ref-guard |
| `app/admin.jsx`              | Import JSON button + handler |
| `app/i18n.js`                | Import button/confirm strings (en + es) |
| `index.html` (maybe)         | none expected (scripts unchanged) |
| `README.md` / `README.en.md` | systemd unit, nginx `/api/` block, migration runbook |
| systemd unit file (doc/new)  | `fablab-kanban-data.service` |

## Testing

- **Sidecar:** GET on missing file → 204; POST valid JSON → 200 + file written
  atomically (tmp then replace); POST invalid JSON → 400; backup created and throttled
  to ≤ once/300 s; backups pruned to 20; bind is localhost-only.
- **Client `load`:** 200 → migrated state; 204 → empty seed; repeated 5xx → throws after
  5 tries (no write); retry then success during simulated slow boot.
- **Client `save`:** rapid state changes coalesce into one POST after 750 ms; unload
  triggers a sendBeacon flush; POST failure shows retry indicator and recovers.
- **Bootstrap:** loading screen while pending; error+Retry on failure; first loaded value
  not echoed back as a save (ref guard).
- **Import:** valid JSON replaces state after confirm; malformed file rejected gracefully.

## Known Limitations

- Last-write-wins: a second concurrent writer can clobber the kiosk's state. Acceptable
  for a single-kiosk lab; documented, not solved.
- File-only means a brief sidecar outage blocks the board (loading/error screen) rather
  than serving a stale cache — an intentional trade for avoiding split-brain.
