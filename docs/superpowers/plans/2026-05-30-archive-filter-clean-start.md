# Archive Date Filter + Clean Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional date-range filter to the admin archive panel, a "Start fresh" button that wipes demo data while keeping machine config, and a first-deployment guide in the README.

**Architecture:** Pure client-side changes to four existing files (`i18n.js`, `data.js`, `admin.jsx`, `styles.css`) plus the README. No new files, no build step, no backend. The archive filter is a `useMemo` over already-loaded data; `buildEmpty()` mirrors the existing `buildSeed()` pattern.

**Tech Stack:** React 18 (UMD), Babel standalone, plain CSS, `localStorage`, no test runner.

---

### Task 1: Add i18n keys for both features

**Files:**
- Modify: `app/i18n.js` (after line 156, inside the existing `TX` object)

- [ ] **Step 1: Add six new translation keys after the existing `admin.archive_count` entry**

Open `app/i18n.js`. Find the line:
```js
"admin.archive_count":       { en: "{n} task{s}",              es: "{n} tarea{s}" },
```
Insert immediately after it:
```js
    "admin.archive_from":        { en: "From",                     es: "Desde" },
    "admin.archive_to":          { en: "To",                       es: "Hasta" },
    "admin.archive_clear":       { en: "Clear filter",             es: "Limpiar" },
    "admin.archive_none":        { en: "No entries match the selected dates.", es: "No hay tareas en el rango seleccionado." },
```

Find the line:
```js
"admin.reset_confirm":       { en: "Reset all demo data? This cannot be undone.", es: "¿Restablecer todos los datos? No se puede deshacer." },
```
Insert immediately after it:
```js
    "admin.fresh_btn":           { en: "Start fresh",              es: "Comenzar sin datos demo" },
    "admin.fresh_confirm":       { en: "This will delete ALL members and tasks and cannot be undone. Machine categories will be kept. Continue?", es: "Esto eliminará TODOS los miembros y tareas y no se puede deshacer. Las categorías de máquinas se conservarán. ¿Continuar?" },
```

- [ ] **Step 2: Verify keys are reachable**

Start a server: `python3 -m http.server 5000`
Open `http://localhost:5000` in the browser. Open DevTools console and run:
```js
window.I18n.t('admin.archive_from', 'es')   // → "Desde"
window.I18n.t('admin.archive_to', 'en')      // → "To"
window.I18n.t('admin.fresh_btn', 'es')       // → "Comenzar sin datos demo"
window.I18n.t('admin.fresh_confirm', 'en')   // → "This will delete ALL..."
```
All four should return the expected strings (not the key itself).

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat: add i18n keys for archive date filter and clean start"
```

---

### Task 2: Add `buildEmpty()` to data.js

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Add the `buildEmpty` function after `buildSeed`**

In `app/data.js`, find the closing brace of `buildSeed()` followed by the comment:
```js
  // ---- persist ---------------------------------------------------------
```
Insert the new function between them:
```js
  function buildEmpty(machinesArray) {
    var machines = (machinesArray || []).map(function (m) { return Object.assign({}, m); });
    syncMachines(machines);
    return {
      lab: "FabLab",
      password: "admin",
      idleMinutes: 3,
      members: [],
      machines: machines,
      cards: [],
      archived: [],
      lastReset: todayStr(),
      lang: "es",
    };
  }
```

- [ ] **Step 2: Expose `buildEmpty` on the public API**

Find the `window.FabData = {` block and add `buildEmpty` alongside the existing exports:
```js
    reset: reset,
    buildEmpty: buildEmpty,   // ← add this line
    syncMachines: syncMachines,
```

- [ ] **Step 3: Verify in browser console**

Reload the page. In DevTools console:
```js
var e = window.FabData.buildEmpty(window.FabData.load().machines);
console.log(e.cards.length, e.members.length, e.machines.length);
// → 0 0 <number of configured machines e.g. 5>
console.log(e.lab, e.lang);
// → "FabLab" "es"
```

- [ ] **Step 4: Commit**

```bash
git add app/data.js
git commit -m "feat: add buildEmpty() to data layer for clean-start deployments"
```

---

### Task 3: Add archive filter state and UI to admin.jsx

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add `archiveFrom` and `archiveTo` state hooks**

In `app/admin.jsx`, find the line immediately after the `archiveEntries` useMemo (around line 195):
```js
  }, [state.archived]);

  // Lab settings local state
```
Insert two new state hooks between them:
```js
  }, [state.archived]);

  const [archiveFrom, setArchiveFrom] = React.useState('');
  const [archiveTo,   setArchiveTo]   = React.useState('');

  const filteredArchiveEntries = React.useMemo(() => {
    if (!archiveFrom && !archiveTo) return archiveEntries;
    return archiveEntries.filter(function (entry) {
      if (archiveFrom && entry.date < archiveFrom) return false;
      if (archiveTo   && entry.date > archiveTo)   return false;
      return true;
    });
  }, [archiveEntries, archiveFrom, archiveTo]);

  // Lab settings local state
```

- [ ] **Step 2: Replace the archive panel body with the filter UI**

Find the entire archive panel body block:
```jsx
            <div className="panel-body">
              {!hasArchived ? (
                <p>{t('admin.archive_empty', lang)}</p>
              ) : (
                archiveEntries.map(entry => (
                  <div key={entry.date} className="archive-group">
                    <div className="archive-date">{formatDate(entry.date)}</div>
                    {(entry.cards || []).map((card, i) => (
                      <div key={card.id || i} className="archive-card">
                        <span className="title">{card.title}</span>
                        <span className="owner-name">{getMemberName(card.owner)}</span>
                      </div>
                    ))}
                    <p style={{ marginTop: 4, fontSize: 13, opacity: 0.6 }}>
                      {t('admin.archive_count', lang).replace('{n}', entry.cards ? entry.cards.length : 0).replace('{s}', (entry.cards ? entry.cards.length : 0) !== 1 ? 's' : '')}
                    </p>
                  </div>
                ))
              )}
            </div>
```

Replace it with:
```jsx
            <div className="panel-body">
              {hasArchived && (
                <div className="archive-filter">
                  <label className="archive-filter-label">{t('admin.archive_from', lang)}</label>
                  <input
                    className="input"
                    type="date"
                    value={archiveFrom}
                    onChange={e => setArchiveFrom(e.target.value)}
                  />
                  <label className="archive-filter-label">{t('admin.archive_to', lang)}</label>
                  <input
                    className="input"
                    type="date"
                    value={archiveTo}
                    onChange={e => setArchiveTo(e.target.value)}
                  />
                  {(archiveFrom || archiveTo) && (
                    <button
                      className="btn"
                      style={{ height: 36, padding: '0 10px', fontSize: 13 }}
                      onClick={() => { setArchiveFrom(''); setArchiveTo(''); }}
                    >
                      × {t('admin.archive_clear', lang)}
                    </button>
                  )}
                </div>
              )}
              {!hasArchived ? (
                <p>{t('admin.archive_empty', lang)}</p>
              ) : filteredArchiveEntries.length === 0 ? (
                <p style={{ opacity: 0.6, fontSize: 13 }}>{t('admin.archive_none', lang)}</p>
              ) : (
                filteredArchiveEntries.map(entry => (
                  <div key={entry.date} className="archive-group">
                    <div className="archive-date">{formatDate(entry.date)}</div>
                    {(entry.cards || []).map((card, i) => (
                      <div key={card.id || i} className="archive-card">
                        <span className="title">{card.title}</span>
                        <span className="owner-name">{getMemberName(card.owner)}</span>
                      </div>
                    ))}
                    <p style={{ marginTop: 4, fontSize: 13, opacity: 0.6 }}>
                      {t('admin.archive_count', lang).replace('{n}', entry.cards ? entry.cards.length : 0).replace('{s}', (entry.cards ? entry.cards.length : 0) !== 1 ? 's' : '')}
                    </p>
                  </div>
                ))
              )}
            </div>
```

- [ ] **Step 3: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: add date-range filter to admin archive panel"
```

---

### Task 4: Add `.archive-filter` CSS

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Add styles after the existing archive rules**

In `app/styles.css`, find the block that ends the archive section:
```css
.archive-card .owner-name { font-size: 12px; color: var(--text-3); }
```
Insert immediately after it:
```css
.archive-filter {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  margin-bottom: 16px;
}
.archive-filter-label {
  font-size: 12.5px; font-weight: 600; color: var(--text-3);
}
.archive-filter .input { height: 36px; padding: 0 10px; font-size: 13px; width: 148px; }
```

- [ ] **Step 2: Verify visually in browser**

Open admin → archive section. The two date inputs and labels should appear in a row above the entries. Filling a date should filter the list; the × button should appear and reset both fields when clicked.

- [ ] **Step 3: Commit**

```bash
git add app/styles.css
git commit -m "feat: add .archive-filter layout styles"
```

---

### Task 5: Add `handleStartFresh` and button to admin.jsx

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add the `handleStartFresh` handler**

In `app/admin.jsx`, find the existing `handleReset` function:
```js
  const handleReset = () => {
    if (confirm(t('admin.reset_confirm', lang))) {
      const fresh = FabData.reset();
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };
```
Insert `handleStartFresh` immediately after it:
```js
  const handleStartFresh = () => {
    if (confirm(t('admin.fresh_confirm', lang))) {
      const fresh = FabData.buildEmpty(state.machines);
      FabData.save(fresh);
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };
```

- [ ] **Step 2: Add the button below the existing Reset button**

Find the export panel body where the Reset button is rendered:
```jsx
              <button
                className="btn"
                onClick={handleReset}
                style={{ color: 'red', marginTop: 16 }}
              >
                {t('admin.reset', lang)}
              </button>
```
Insert the new button immediately after it:
```jsx
              <button
                className="btn"
                onClick={handleStartFresh}
                style={{ color: 'red', marginTop: 8 }}
              >
                {t('admin.fresh_btn', lang)}
              </button>
```

- [ ] **Step 3: Verify in browser**

Open admin → Export data panel. Both buttons should appear (Reset demo data / Comenzar sin datos demo). Click "Comenzar sin datos demo" → confirm → the board should reload with 0 cards, 0 members, machine categories intact.

- [ ] **Step 4: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: add Start fresh button to admin export panel"
```

---

### Task 6: Add first-deployment section to README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the Spanish section**

In `README.md`, find the end of the Raspberry Pi deployment section in the Spanish block (the line `La app se abrirá automáticamente en pantalla completa al arrancar.`). Insert the new section immediately after it, before the `---` separator that starts the English block:

```markdown
### Primer despliegue en producción

> Para usar la app en el laboratorio sin los datos de demostración, sigue estos pasos la primera vez.

1. Abre la app en el navegador (`http://localhost:5000` o la IP de la Raspberry Pi).
2. Haz clic en el ícono de **Ajustes** en la barra superior e ingresa la contraseña por defecto: `admin`.
3. Haz clic en **"Comenzar sin datos demo"** y confirma — se eliminarán todas las tarjetas y miembros de prueba. Las categorías de máquinas se conservan.
4. Ve a **Ajustes del laboratorio**: cambia el nombre del tablero y el tiempo de inactividad del salvapantallas.
5. Ve a **Tipos de máquina**: ajusta o conserva las categorías por defecto.
6. Ve a **Miembros registrados**: añade a los integrantes reales del equipo (nombre, iniciales y color de avatar).
7. Ve a **Contraseña maestra**: cambia `admin` por una contraseña segura.
8. Cierra el panel de administración. El tablero está listo para usar.
```

- [ ] **Step 2: Add the English section**

Find the end of the English Raspberry Pi deployment section (the line `The app will open automatically in fullscreen on boot.`). Insert immediately after it, before `## License`:

```markdown
### First deployment

> To use the app in your lab without the demo data, follow these steps the first time.

1. Open the app in a browser (`http://localhost:5000` or the Raspberry Pi's IP address).
2. Click the **Admin settings** icon in the top bar and enter the default password: `admin`.
3. Click **"Start fresh"** and confirm — all demo cards and members will be deleted. Machine categories are kept.
4. Go to **Lab settings**: change the board name and screensaver idle timeout.
5. Go to **Machine categories**: adjust or keep the defaults.
6. Go to **Registered members**: add your real team members (name, initials, and avatar color).
7. Go to **Master password**: change `admin` to a secure password.
8. Close the admin panel. The board is ready to use.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add first deployment guide (ES + EN) to README"
```

---

### Task 7: Push and update PR

- [ ] **Step 1: Push all commits**

```bash
git push origin feat/initial-kanban-app
```

- [ ] **Step 2: Confirm PR is updated**

The existing PR #1 at `https://github.com/bocchidayo/FablabKanban/pull/1` will reflect all new commits automatically. No action needed.
