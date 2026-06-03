# Schema Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-layer schema safety net: a CLAUDE.md policy enforcing additive-only changes, and a runtime `schemaVersion` guard in `data.js` / `main.jsx` that blocks loading if the data file was written by a newer version of the app.

**Architecture:** `SCHEMA_VERSION = 1` constant in `data.js`; `migrate()` throws a typed error if the file's version exceeds the code's version; `buildSeed` and `buildEmpty` stamp new state with the current version. `AppRoot` in `main.jsx` distinguishes schema-version errors (no Retry button) from transient load errors (Retry button). CLAUDE.md policy prevents violations before they reach runtime.

**Tech Stack:** Vanilla JS (no bundler), React 18 UMD, browser-transpiled JSX via Babel-standalone.

---

## File Map

| File | Change |
|---|---|
| `CLAUDE.md` | Add "Data schema rules" section under Conventions |
| `app/data.js` | Add `SCHEMA_VERSION` constant; guard in `migrate()`; version stamp in `buildSeed`/`buildEmpty`; fast-fail in `load()` |
| `app/main.jsx` | Add `SchemaVersionScreen`; update `AppRoot` catch + render |

---

## Task 1: CLAUDE.md — data schema rules policy

**Files:**
- Modify: `CLAUDE.md` (Conventions section, after line 107)

- [ ] **Step 1: Add the Data schema rules section**

In `CLAUDE.md`, after the existing Conventions bullet list (after the line ending `t('some.key', lang)`), add:

```markdown
- **Data schema rules:** `data.json` schema changes must be **additive-only** — new
  fields with a default in `migrate()` only. Never rename, remove, restructure, or
  change the type of an existing field. Bump `SCHEMA_VERSION` in `app/data.js`
  whenever any schema change is made. If a task requires a breaking change, **stop
  and flag it to the human** before touching the schema or `migrate()`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add additive-only data schema rules policy"
```

---

## Task 2: data.js — SCHEMA_VERSION constant, migrate() guard, buildSeed/buildEmpty stamp, load() fast-fail

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Add SCHEMA_VERSION constant**

After line 14 (`const LOAD_RETRY_DELAY_MS = 1000;`), insert:

```js
  const SCHEMA_VERSION = 1;
```

- [ ] **Step 2: Add version guard + stamp to migrate()**

Replace the opening of `migrate()` (currently line 152) so it reads:

```js
  function migrate(state) {
    var fileVersion = state.schemaVersion || 0;
    if (fileVersion > SCHEMA_VERSION) {
      var err = new Error(
        'Schema v' + fileVersion + ' is newer than this app (v' + SCHEMA_VERSION + '). ' +
        'Update the app before opening this data.'
      );
      err.isSchemaVersionError = true;
      throw err;
    }
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
    state.schemaVersion = SCHEMA_VERSION;
    return state;
  }
```

- [ ] **Step 3: Stamp schemaVersion in buildSeed()**

In the `buildSeed()` return object (currently ends with `lang: "en",`), add:

```js
      lang: "en",
      schemaVersion: SCHEMA_VERSION,
```

- [ ] **Step 4: Stamp schemaVersion in buildEmpty()**

In the `buildEmpty()` return object (currently ends with `lang: lang || 'es',`), add:

```js
      lang: lang || 'es',
      schemaVersion: SCHEMA_VERSION,
```

- [ ] **Step 5: Fast-fail schema version errors in load()**

In `load()`, the catch block currently reads:

```js
      } catch (e) {
        lastErr = e;
        if (attempt < LOAD_RETRIES - 1) await delay(LOAD_RETRY_DELAY_MS);
      }
```

Replace with:

```js
      } catch (e) {
        if (e.isSchemaVersionError) throw e;  // retrying won't help
        lastErr = e;
        if (attempt < LOAD_RETRIES - 1) await delay(LOAD_RETRY_DELAY_MS);
      }
```

- [ ] **Step 6: Verify in browser**

Start the server: `python3 server.py`

Open `http://127.0.0.1:5001` in a browser. The app should load normally (existing data has no `schemaVersion`, so `fileVersion = 0`, which is ≤ `SCHEMA_VERSION = 1` — no error thrown). After loading, inspect `data.json` — it should now contain `"schemaVersion": 1`.

- [ ] **Step 7: Commit**

```bash
git add app/data.js
git commit -m "feat(data): add SCHEMA_VERSION guard and stamp to migrate/buildSeed/buildEmpty"
```

---

## Task 3: main.jsx — SchemaVersionScreen + AppRoot differentiation

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Add SchemaVersionScreen component**

After the existing `ErrorScreen` component (after its closing `}`, around line 25), insert:

```jsx
function SchemaVersionScreen({ message }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      gap: 16, alignItems: "center", justifyContent: "center", background: "var(--bg)",
      color: "var(--text-1)", textAlign: "center", padding: 24 }}>
      <div style={{ font: "700 20px/1.3 Figtree, sans-serif" }}>
        Versión de datos incompatible.<br />Incompatible data version.
      </div>
      <div style={{ font: "400 15px/1.5 Figtree, sans-serif", color: "var(--text-2)",
        maxWidth: 480 }}>
        {message}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update AppRoot to track schema error message**

In `AppRoot`, add a `schemaError` state alongside the existing states:

```jsx
function AppRoot() {
  const [phase, setPhase] = React.useState("loading"); // loading | ready | error | schema-error
  const [initial, setInitial] = React.useState(null);
  const [attempt, setAttempt] = React.useState(0);
  const [schemaError, setSchemaError] = React.useState(null);
```

- [ ] **Step 3: Update the load effect catch to branch on error type**

Replace the `.catch` line in the `useEffect`:

```jsx
      .catch(() => { if (!cancelled) setPhase("error"); });
```

with:

```jsx
      .catch(e => {
        if (!cancelled) {
          if (e.isSchemaVersionError) {
            setSchemaError(e.message);
            setPhase("schema-error");
          } else {
            setPhase("error");
          }
        }
      });
```

- [ ] **Step 4: Add the schema-error render branch**

Replace the current two-line render block:

```jsx
  if (phase === "loading") return <LoadingScreen />;
  if (phase === "error") return <ErrorScreen onRetry={() => setAttempt(a => a + 1)} />;
  return <App initialState={initial} />;
```

with:

```jsx
  if (phase === "loading") return <LoadingScreen />;
  if (phase === "schema-error") return <SchemaVersionScreen message={schemaError} />;
  if (phase === "error") return <ErrorScreen onRetry={() => setAttempt(a => a + 1)} />;
  return <App initialState={initial} />;
```

- [ ] **Step 5: Verify the schema-error screen manually**

To test the error path without corrupting real data, temporarily edit `data.json` in the repo root to add `"schemaVersion": 999`. Reload the app — it should show the `SchemaVersionScreen` with the version mismatch message and **no Retry button**. Restore `data.json` afterward (or just let the server restore from a backup).

- [ ] **Step 6: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): show schema-version error screen without retry button"
```
