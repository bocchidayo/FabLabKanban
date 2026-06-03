# CLAUDE.md

Guidance for AI agents (and humans) working in this repository.

## What this is

A **FabLab Kanban kiosk** — a static React web app that runs full-screen in Chromium
on a Raspberry Pi. It manages lab tasks (a Kanban board), member check-in/attendance,
machine types, a screensaver dashboard, and an interactive tutorial. Spanish is the
default UI language; English is also supported.

**Hard constraint — no build step.** There is intentionally **no npm, no bundler, no
transpile step on disk**. JSX is transpiled *in the browser* by Babel-standalone (loaded
from a CDN in `index.html`). Do **not** introduce a build toolchain, a JS package manager,
a JS test runner, or a frontend framework CLI. If a change seems to need one, it's almost
certainly the wrong approach for this project.

## Architecture

```
Chromium (kiosk) ──▶ nginx :80 ──▶ static files: index.html + app/*   [front end]
                          └── /api/ ──proxy──▶ 127.0.0.1:5001          [persistence]
                                               server.py (Python stdlib sidecar)
                                               owns data.json + backups/
```

- **Front end:** React 18 UMD + ReactDOM + Babel-standalone, all via CDN (`index.html`).
  Source is plain `.jsx`/`.js` files loaded as `<script>` tags — there is no module
  system; files share globals (e.g. `window.FabData`, `window.I18n`, `const t = ...`).
- **Persistence:** `server.py`, a single-file Python **standard-library** HTTP service
  (no pip installs). It serves `GET/POST /api/state` and, when run standalone, also
  serves the static app (for local dev). In production nginx serves the static files and
  reverse-proxies only `/api/` to it.
- **Data lives in a file**, `data.json`, on the Pi disk — **not** in the browser. This
  replaced an earlier localStorage-based store. Do not reintroduce localStorage as the
  system of record.

## File map

| File | Responsibility |
|------|----------------|
| `index.html` | Entry point; loads CDN deps + all `app/*` scripts (order matters). |
| `app/data.js` | `window.FabData` data layer: async `load`/`save`/`saveNow`/`reset`, `migrate`, seed builders, helpers. **No JSX.** |
| `app/i18n.js` | `window.I18n.t(key, lang)` + the `TX` translation table (en/es). |
| `app/board.jsx` | Board, columns, cards, TopBar, filters. |
| `app/modal.jsx` | Create/edit task modal. |
| `app/admin.jsx` | Password-gated admin panel (members, machines, settings, export/import, reset). |
| `app/screensaver.jsx` | Idle screensaver dashboard. |
| `app/tutorial.jsx` | Spotlight tutorial overlay. |
| `app/main.jsx` | Root: `AppRoot` (async bootstrap gate) → `App` (global state, actions, shortcuts). |
| `app/styles.css` | All styles (CSS variables + components). |
| `server.py` | Python-stdlib persistence sidecar (`StateStore` + HTTP handler). |
| `tests/test_server.py` | `unittest` tests for the sidecar (the only automated tests). |
| `deploy/` | `fablab-kanban-data.service` (systemd unit) + `nginx-api-snippet.conf`. |
| `docs/superpowers/` | `specs/` and `plans/` — design docs and implementation plans. |

## Persistence model (important details)

- `FabData.load()` is **async**: `fetch('/api/state')`, retries 5× (1s apart). On `200`
  it runs `migrate()` and returns state; on `204` (no file yet) it returns an empty board
  (new install); after exhausting retries it **throws** — it never silently seeds, so a
  brief outage cannot overwrite good data. `main.jsx`'s `AppRoot` shows a loading screen,
  or an error screen with Retry, accordingly.
- `FabData.save(state)` is **debounced 750ms** and fire-and-forget; it POSTs to
  `/api/state`, emits `window` events `fabdata:saving` / `fabdata:saved` /
  `fabdata:saveerror`, retries on failure, and flushes on `beforeunload` via
  `navigator.sendBeacon`. `main.jsx` shows a red banner while saving is failing.
- `FabData.saveNow(state)` is an **immediate** awaited POST (used by import/reset/seed).
- `server.py` writes **atomically** (temp file → `fsync` → `os.replace`) — never a direct
  overwrite (SD-card power-loss safety). Before each (throttled) write it copies the
  previous `data.json` into `backups/data-<ISO>.json`, **at most once per 5 minutes**,
  keeping the **newest 20** backups.
- Restore path: admin panel has **Export JSON** and **Import JSON**. Import runs the same
  `migrate()` and `saveNow()`, so an exported backup loads cleanly into a new install.

## Running locally

```bash
# Serves BOTH the static app and /api/ on one port (no nginx needed for dev)
python3 server.py            # http://127.0.0.1:5001
```

`data.json` and `backups/` are created in the repo root at runtime and are **git-ignored**
— never commit them. Lab-data exports (`fablab-utp-*.json/.csv`) are git-ignored too.

## Testing

```bash
python3 -m unittest discover -t . -s tests -v
```

Only `server.py` has automated tests (Python stdlib `unittest`, zero deps — runs on the
Pi). There is **no JS test runner** by design. Verify front-end changes manually in a
browser, or — for the `data.js` layer specifically — by driving it from Node against a
running `server.py` (Node 22+ has native `fetch`/`Blob`; stub `window`/`CustomEvent`).

## Conventions

- **TDD for `server.py`:** write a failing `unittest`, see it fail, implement, see it pass.
- `app/*.jsx` use React via the global `React`/`ReactDOM`. Translations via
  `const t = window.I18n ? window.I18n.t : (k) => k;` at the top of each file; call
  `t('some.key', lang)`. Add new strings to `app/i18n.js` with both `en` and `es`.
- Keep files focused. `admin.jsx` and `main.jsx` are already large — add narrowly, follow
  existing patterns, don't restructure unrelated code.
- **Deployment paths:** the Pi user is `fablab`; the project lives at
  `/home/fablab/FabLabKanban`. Keep `deploy/` and the READMEs consistent with that.
- **Data schema rules:** `data.json` schema changes must be **additive-only** — new
  fields with a default in `migrate()` only. Never rename, remove, restructure, or
  change the type of an existing field. Bump `SCHEMA_VERSION` in `app/data.js`
  whenever any schema change is made. If a task requires a breaking change, **stop
  and flag it to the human** before touching the schema or `migrate()`.

## Workflow notes

- Design docs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. This
  feature (file-based persistence) has both, dated `2026-06-03`.
- Commit messages used here follow Conventional Commits (`feat(server): …`, `fix(admin): …`).
- Both `README.md` (Spanish, primary) and `README.en.md` (English) must stay in sync when
  you touch user-facing docs.
