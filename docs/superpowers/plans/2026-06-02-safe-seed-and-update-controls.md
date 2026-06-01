# Safe Seed Init & Update Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove auto-seed on empty storage, expose `buildSeed` + `isNewInstall` on `FabData`, add a System panel to admin with a guard-based "Initialize Demo Data" button and an always-visible "Reload App" button.

**Architecture:** Three independent file edits — `data.js` (data layer), `i18n.js` (strings), `admin.jsx` (UI). No new files. Tasks 1–3 have no inter-file runtime dependency during editing and can be executed in parallel by separate subagents.

**Tech Stack:** Vanilla JS (data layer), React 18 via Babel standalone (admin UI), custom i18n helper.

---

## File Map

| File | Change |
|---|---|
| `app/data.js` | `load()` fallback → `buildEmpty`; add + expose `isNewInstall`; expose `buildSeed` |
| `app/i18n.js` | Add 6 new keys (en + es) for the System panel |
| `app/admin.jsx` | Add `handleSeedInit` + `handleReload` handlers; add System panel JSX after Export panel |

---

## Task 1: data.js — Fix load() fallback + expose helpers

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Replace the buildSeed fallback in load() with buildEmpty**

Find lines 190–192 in `app/data.js`:
```js
    var seed = buildSeed();
    save(seed);
    return seed;
```
Replace with:
```js
    var empty = buildEmpty(clone(SEED_MACHINES), 'es');
    save(empty);
    return empty;
```

- [ ] **Step 2: Add the isNewInstall helper function**

Insert the following function immediately before the `// ---- exposed API` comment (line 309 in the original):
```js
  function isNewInstall(state) {
    return (!state.members || state.members.length === 0) &&
           (!state.cards   || state.cards.length   === 0);
  }
```

- [ ] **Step 3: Expose buildSeed and isNewInstall on window.FabData**

Find this block in `window.FabData` (around line 320):
```js
    load: load,
    save: save,
    reset: reset,
    buildEmpty: buildEmpty,
```
Replace with:
```js
    load: load,
    save: save,
    reset: reset,
    buildSeed: buildSeed,
    buildEmpty: buildEmpty,
    isNewInstall: isNewInstall,
```

- [ ] **Step 4: Commit**

```bash
git add app/data.js
git commit -m "feat: data — empty fallback on new install, expose buildSeed + isNewInstall"
```

---

## Task 2: i18n.js — Add System panel strings

**Files:**
- Modify: `app/i18n.js`

- [ ] **Step 1: Add the 6 new keys**

Find the last entry in the `TX` object (line 248 in the original):
```js
    "admin.cancelled_reason":   { en: "Reason",                                     es: "Razón" },
  };
```
Replace with:
```js
    "admin.cancelled_reason":   { en: "Reason",                                     es: "Razón" },

    // ---- system panel -------------------------------------------------------
    "admin.system_title":  { en: "System",                       es: "Sistema" },
    "admin.system_desc":   { en: "Initialization and update controls.", es: "Controles de inicialización y actualización." },
    "admin.seed_btn":      { en: "Initialize Demo Data",         es: "Inicializar datos de demostración" },
    "admin.seed_confirm":  { en: "This will populate the board with demo members, machines, and cards. Only use on a new installation. Continue?",
                             es: "Esto llenará el tablero con miembros, máquinas y tarjetas de demostración. Úsalo solo en una instalación nueva. ¿Continuar?" },
    "admin.reload_btn":    { en: "Reload App",                   es: "Recargar aplicación" },
    "admin.reload_desc":   { en: "After running `git pull` on the Pi, click this to apply updates. Your data is safe — code updates never touch browser storage.",
                             es: "Después de ejecutar `git pull` en la Pi, haz clic aquí para aplicar las actualizaciones. Tus datos están seguros: las actualizaciones de código nunca tocan el almacenamiento del navegador." },
  };
```

- [ ] **Step 2: Commit**

```bash
git add app/i18n.js
git commit -m "feat: i18n — add system panel keys (en + es)"
```

---

## Task 3: admin.jsx — System panel handlers + JSX

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add handleSeedInit and handleReload handlers**

Find the `handleStartFresh` handler (ends around line 810):
```js
  const handleStartFresh = () => {
    if (confirm(t('admin.fresh_confirm', lang))) {
      const fresh = FabData.buildEmpty(state.machines, state.lang);
      FabData.save(fresh);
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };

  // ---- Render ------------------------------------------------------------
```
Replace with:
```js
  const handleStartFresh = () => {
    if (confirm(t('admin.fresh_confirm', lang))) {
      const fresh = FabData.buildEmpty(state.machines, state.lang);
      FabData.save(fresh);
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };

  // ---- System panel -------------------------------------------------------
  const handleSeedInit = () => {
    if (confirm(t('admin.seed_confirm', lang))) {
      const fresh = FabData.buildSeed();
      FabData.save(fresh);
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  // ---- Render ------------------------------------------------------------
```

- [ ] **Step 2: Add System panel JSX after the Export data panel**

Find the closing of the Export panel and the surrounding wrappers (lines 1026–1028):
```jsx
          </div>
        </div>
      </div>
```
Replace with:
```jsx
          </div>

          {/* ---- System ------------------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.system_title', lang)}</h3>
              <p>{t('admin.system_desc', lang)}</p>
            </div>
            <div className="panel-body">
              {FabData.isNewInstall(state) && (
                <button
                  className="btn btn-accent"
                  onClick={handleSeedInit}
                  style={{ marginBottom: 12 }}
                >
                  {t('admin.seed_btn', lang)}
                </button>
              )}
              <div>
                <button className="btn" onClick={handleReload}>
                  {t('admin.reload_btn', lang)}
                </button>
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  {t('admin.reload_desc', lang)}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: admin — System panel with guarded seed init and reload button"
```

---

## Task 4: Verification (run after Tasks 1–3 complete)

**Files:** none — browser testing only

- [ ] **Step 1: Open the app in the browser**

Navigate to `http://localhost` (or the Pi's address). The board should load. If localStorage has existing data, the board shows that data unchanged.

- [ ] **Step 2: Verify no auto-seed on empty storage**

Open DevTools → Application → Storage → Local Storage. Delete the `fablab_utp_v3` key. Reload the page. The board should show an empty board (no members, no cards, no demo data).

- [ ] **Step 3: Verify "Initialize Demo Data" button appears on new install**

With an empty board open, go to Admin (password: `admin`). Scroll to the bottom. The System panel should show the "Initialize Demo Data" button. Click it → confirm → board reloads with demo members and cards.

- [ ] **Step 4: Verify "Initialize Demo Data" button is hidden when data exists**

With demo data present, reopen Admin and scroll to System panel. The "Initialize Demo Data" button should NOT appear — only "Reload App" is visible.

- [ ] **Step 5: Verify "Reload App" button works**

Click "Reload App". The page reloads. Existing data is preserved in localStorage — the board looks exactly as before.

- [ ] **Step 6: Verify existing installations are unaffected**

Clear localStorage, reload (gets empty board), add one member manually. Reload again — the member persists (existing data migration path still works). The board does NOT auto-seed.

- [ ] **Step 7: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix: <describe any fixups>"
```
