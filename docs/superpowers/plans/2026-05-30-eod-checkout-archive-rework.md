# EOD Auto-Checkout + Archive Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `state.archived` with `completedTasks`/`cancelledTasks`, auto-checkout all members on day rollover, prompt for cancellation reason when deleting non-Done cards, and show two new day-selectable admin panels.

**Architecture:** 6 sequential tasks, each isolated to one or two files. Data layer and i18n first (Tasks 1–2), then the cancel modal (Task 3), then main.jsx wiring (Task 4), then admin panels (Tasks 5–6). No build step — verification in-browser via `python3 -m http.server 5000`.

**Tech Stack:** React 18 UMD + Babel Standalone, plain JS IIFE modules, `window.FabData` data layer, `window.I18n.t` for translations, localStorage key `fablab_utp_v3`.

**Spec:** `docs/superpowers/specs/2026-05-30-eod-checkout-archive-rework.md`

---

## File Map

| File | What changes |
|---|---|
| `app/i18n.js` | Add `cancel.*`, `admin.completed_*`, `admin.cancelled_*` keys |
| `app/data.js` | Replace `archiveDoneCards` → `performDailyReset`; update migrations, `buildSeed`, `buildEmpty` |
| `app/styles.css` | Add `.btn-coral` and `.overtime-badge` |
| `app/modal.jsx` | Add `CancelReasonModal`; expose via `window.CancelReasonModal` |
| `app/main.jsx` | Rewrite `deleteCard`; add `archiveCompletedCard`, `onConfirmCancel`, `cancellingCard` state; update `checkReset`; update modal render |
| `app/admin.jsx` | Add `CompletedTasksPanel` + `CancelledTasksPanel`; remove Archive panel and its state |

---

### Task 1: i18n keys

**Files:**
- Modify: `app/i18n.js` (insert before the closing `};` of the `TX` object, after the attendance keys at line 221)

- [ ] **Step 1: Add the new i18n keys**

Open `app/i18n.js`. Find the closing `};` of the `TX` object (line ~222, right before `function t(key, lang)`). Insert the following block before that closing `};`:

```js
    // ---- cancel modal -------------------------------------------------------
    "cancel.title":            { en: "Why is this task being removed?",             es: "¿Por qué se elimina esta tarea?" },
    "cancel.placeholder":      { en: "Reason (optional)",                           es: "Razón (opcional)" },
    "cancel.keep":             { en: "Keep task",                                   es: "Mantener tarea" },
    "cancel.confirm":          { en: "Remove task",                                 es: "Eliminar tarea" },

    // ---- completed tasks panel ----------------------------------------------
    "admin.completed_title":    { en: "Completed Tasks",                            es: "Tareas Completadas" },
    "admin.completed_desc":     { en: "Tasks archived from the Done column by day.", es: "Tareas archivadas desde la columna completados por día." },
    "admin.completed_date":     { en: "Day",                                        es: "Día" },
    "admin.completed_empty":    { en: "No completed tasks for this day.",            es: "Sin tareas completadas para este día." },
    "admin.completed_export":   { en: "Export CSV",                                 es: "Exportar CSV" },
    "admin.completed_estimated":{ en: "Est.",                                       es: "Est." },
    "admin.completed_duration": { en: "Duration",                                   es: "Duración" },
    "admin.completed_at":       { en: "Done at",                                    es: "Completado a" },
    "admin.completed_overtime": { en: "Overtime",                                   es: "Sobretiempo" },

    // ---- cancelled tasks panel ----------------------------------------------
    "admin.cancelled_title":    { en: "Cancelled Tasks",                            es: "Tareas Canceladas" },
    "admin.cancelled_desc":     { en: "Tasks removed before completion, with reason.", es: "Tareas eliminadas antes de completarse, con razón." },
    "admin.cancelled_date":     { en: "Day",                                        es: "Día" },
    "admin.cancelled_empty":    { en: "No cancelled tasks for this day.",            es: "Sin tareas canceladas para este día." },
    "admin.cancelled_export":   { en: "Export CSV",                                 es: "Exportar CSV" },
    "admin.cancelled_column":   { en: "Column",                                     es: "Columna" },
    "admin.cancelled_created":  { en: "Created",                                    es: "Creado" },
    "admin.cancelled_reason":   { en: "Reason",                                     es: "Razón" },
```

- [ ] **Step 2: Verify keys load in browser**

Start the server if not running: `python3 -m http.server 5000`

Open `http://localhost:5000`. In the browser console run:

```js
window.I18n.t('cancel.title', 'en')           // → "Why is this task being removed?"
window.I18n.t('cancel.title', 'es')           // → "¿Por qué se elimina esta tarea?"
window.I18n.t('admin.completed_title', 'en')  // → "Completed Tasks"
window.I18n.t('admin.cancelled_title', 'es')  // → "Tareas Canceladas"
```

All four should return the correct strings, not the key name.

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat: add i18n keys for cancel modal and archive panels"
```

---

### Task 2: Data layer — `performDailyReset` + migrations

**Files:**
- Modify: `app/data.js`

The full set of changes in this task:
1. `buildSeed()` — replace `archived: []` with `completedTasks: [], cancelledTasks: []`
2. `buildEmpty()` — same
3. `load()` migrations — add `completedTasks`/`cancelledTasks` migration; fix `lastReset: ""` bug; `delete state.archived`
4. Replace `archiveDoneCards` function with `performDailyReset`
5. Update `window.FabData` exposure

- [ ] **Step 1: Update `buildSeed` return value**

In `app/data.js`, find the `buildSeed` function return (lines ~112–124). Change `archived: []` to `completedTasks: [], cancelledTasks: []`:

```js
    return {
      lab: "FABLAB UTP",
      password: "admin",
      idleMinutes: 3,
      members: clone(seedMembers),
      machines: machines,
      cards: cards,
      completedTasks: [],
      cancelledTasks: [],
      attendance: [],
      lastReset: todayStr,
      lang: "en",
    };
```

Note: inside `buildSeed`, `todayStr` is a **local variable** (not the `todayStr()` function defined below). Do not change it to `todayStr()`.

- [ ] **Step 2: Update `buildEmpty` return value**

Find the `buildEmpty` function return (lines ~128–141). Change `archived: []` to `completedTasks: [], cancelledTasks: []`:

```js
    return {
      lab: "FabLab",
      password: "admin",
      idleMinutes: 3,
      members: [],
      machines: machines,
      cards: [],
      completedTasks: [],
      cancelledTasks: [],
      attendance: [],
      lastReset: todayStr(),
      lang: lang || 'es',
    };
```

- [ ] **Step 3: Update `load()` migrations**

In the `load()` function (lines ~144–186), find this existing migration:

```js
        if (!state.lastReset) state.lastReset = "";
```

Replace it with:

```js
        if (!state.lastReset) state.lastReset = todayStr();
```

Then, immediately after the attendance migrations (after the two lines `if (!state.attendance)...` and `state.members.forEach...`), add:

```js
        // Rename archived → completedTasks; delete old key to prevent localStorage bloat
        if (!state.completedTasks) {
          state.completedTasks = state.archived || [];
        }
        if (!state.cancelledTasks) state.cancelledTasks = [];
        delete state.archived;
```

- [ ] **Step 4: Replace `archiveDoneCards` with `performDailyReset`**

Find the `archiveDoneCards` function (lines ~256–268) and replace it entirely:

```js
  function performDailyReset(state, now) {
    var today = todayStr();
    var archiveDate = state.lastReset || today;

    // 1. Archive Done cards → completedTasks
    var doneCards = state.cards.filter(function (c) { return c.col === 'done'; });
    var activeCards = state.cards.filter(function (c) { return c.col !== 'done'; });
    var completedTasks = (state.completedTasks || []).slice();

    if (doneCards.length > 0) {
      var enriched = doneCards.map(function (c) {
        var overtime = !!(c.startedAt && c.completedAt && c.estMin &&
          (new Date(c.completedAt) - new Date(c.startedAt)) > c.estMin * 60000);
        return Object.assign({}, c, { overtime: overtime });
      });
      completedTasks.push({ date: archiveDate, cards: enriched });
    }

    // 2. Close all open attendance sessions
    var checkOutTime = fmtHHMM(now);
    var attendance = (state.attendance || []).map(function (e) {
      return e.checkOut === null ? Object.assign({}, e, { checkOut: checkOutTime }) : e;
    });

    // 3. Reset all members' check-in state
    var members = state.members.map(function (m) {
      return Object.assign({}, m, { checkedIn: false, checkedInAt: null });
    });

    return Object.assign({}, state, {
      cards: activeCards,
      completedTasks: completedTasks,
      attendance: attendance,
      members: members,
      lastReset: today,
    });
  }
```

- [ ] **Step 5: Update `window.FabData` exposure**

In the `window.FabData = { ... }` block (lines ~279–303), replace `archiveDoneCards: archiveDoneCards,` with `performDailyReset: performDailyReset,`:

```js
    performDailyReset: performDailyReset,
```

Remove the `archiveDoneCards` line entirely — it no longer exists.

Also remove `getTodayDone: getTodayDone,` if `getTodayDone` is no longer needed. Check: `getTodayDone` is used by the screensaver (`screensaver.jsx`) for the "done today" count. Keep it — the function still works since Done cards remain in `state.cards` until day rollover.

- [ ] **Step 6: Verify in browser**

Open `http://localhost:5000`. In the console:

```js
// Check migration: state.archived should be gone, completedTasks should exist
const s = JSON.parse(localStorage.getItem('fablab_utp_v3'));
console.log('archived' in s);       // → false
console.log('completedTasks' in s); // → true
console.log('cancelledTasks' in s); // → true

// Check performDailyReset is exposed
typeof FabData.performDailyReset // → "function"

// Simulate a daily reset manually
const result = FabData.performDailyReset(s, new Date());
console.log(result.lastReset);          // → today's date e.g. "2026-05-30"
console.log(result.members.every(m => !m.checkedIn)); // → true
```

If `archived` is still in the object, reload the page once to force the migration.

- [ ] **Step 7: Commit**

```bash
git add app/data.js
git commit -m "feat: data — performDailyReset, completedTasks/cancelledTasks migration"
```

---

### Task 3: CSS + `CancelReasonModal`

**Files:**
- Modify: `app/styles.css`
- Modify: `app/modal.jsx`

- [ ] **Step 1: Add CSS in `styles.css`**

Open `app/styles.css`. Find the `.checkin-time-chip` block (added in the previous feature). After it, add:

```css
/* cancel/destructive button — softer red than btn-danger */
.btn-coral { background: var(--coral); color: #fff; }
.btn-coral:hover { background: #d4614a; }

/* overtime badge in completed tasks panel */
.overtime-badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: #fde8e8; color: var(--p-high); white-space: nowrap; }
```

- [ ] **Step 2: Add `CancelReasonModal` to `modal.jsx`**

Open `app/modal.jsx`. Find the line `window.CardModal = CardModal;` near the bottom (line ~468). Before that line, insert the `CancelReasonModal` component. The file uses `React.createElement` (not JSX) and plain `var` — follow that style exactly:

```js
  // ============================================================ CancelReasonModal
  function CancelReasonModal(props) {
    var card = props.card;
    var lang = props.lang || 'en';
    var onConfirm = props.onConfirm;
    var onClose = props.onClose;

    var _reason = useState('');
    var reason = _reason[0]; var setReason = _reason[1];

    // Esc closes without deleting
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, []);

    function handleOverlayClick(e) {
      if (e.target === e.currentTarget) onClose();
    }

    return React.createElement('div', { className: 'overlay', onClick: handleOverlayClick },
      React.createElement('div', { className: 'modal', style: { maxWidth: 420 } },

        React.createElement('div', { className: 'modal-head' },
          React.createElement('h3', null, t('cancel.title', lang)),
          React.createElement('span', { className: 'sub' }, card.title),
        ),

        React.createElement('div', { className: 'modal-body' },
          React.createElement('textarea', {
            className: 'textarea',
            rows: 3,
            style: { width: '100%', resize: 'vertical' },
            placeholder: t('cancel.placeholder', lang),
            value: reason,
            onChange: function (e) { setReason(e.target.value); },
            autoFocus: true,
          }),
        ),

        React.createElement('div', { className: 'modal-foot' },
          React.createElement('div', { className: 'sp' }),
          React.createElement('button', {
            className: 'btn',
            onClick: onClose,
            type: 'button',
          }, t('cancel.keep', lang)),
          React.createElement('button', {
            className: 'btn btn-coral',
            onClick: function () { onConfirm(card.id, reason); },
            type: 'button',
          }, t('cancel.confirm', lang)),
        ),
      ),
    );
  }
```

- [ ] **Step 3: Expose `CancelReasonModal`**

Find the existing `window.CardModal = CardModal;` and `window.Cheatsheet = Cheatsheet;` lines. After them, add:

```js
  window.CancelReasonModal = CancelReasonModal;
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:5000`. In the console:

```js
typeof window.CancelReasonModal  // → "function"
```

Then temporarily trigger the modal by pasting this in the console:

```js
const div = document.createElement('div');
document.body.appendChild(div);
ReactDOM.createRoot(div).render(
  React.createElement(window.CancelReasonModal, {
    card: { id: 'test', title: 'Test task' },
    lang: 'en',
    onConfirm: (id, reason) => { console.log('confirmed', id, reason); div.remove(); },
    onClose: () => { console.log('closed (keep)'); div.remove(); },
  })
);
```

Verify: modal appears with the title "Why is this task being removed?", the card title "Test task" as subtitle, a textarea, "Keep task" and "Remove task" buttons. Click "Remove task" → console shows `confirmed test <reason>`. Click overlay or press Esc → console shows `closed (keep)`.

- [ ] **Step 5: Commit**

```bash
git add app/styles.css app/modal.jsx
git commit -m "feat: add CancelReasonModal and btn-coral/overtime-badge CSS"
```

---

### Task 4: `main.jsx` — delete card rework + `checkReset` update

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Add `cancellingCard` state**

In `app/main.jsx`, find the block of `React.useState` declarations near the top of the `App` function (lines ~7–16). Add `cancellingCard` after `checkedInMemberId`:

```js
  const [cancellingCard, setCancellingCard] = React.useState(null);
```

- [ ] **Step 2: Update `checkReset` to use `performDailyReset`**

Find the `checkReset` effect (lines ~27–38):

```js
  React.useEffect(() => {
    function checkReset() {
      const today = FabData.todayStr();
      if (state.lastReset && state.lastReset !== today) {
        setState(s => FabData.archiveDoneCards(s));
      }
    }
    checkReset();
    const t = setInterval(checkReset, 60000);
    return () => clearInterval(t);
  }, [state.lastReset]);
```

Replace `setState(s => FabData.archiveDoneCards(s))` with:

```js
      if (state.lastReset && state.lastReset !== today) {
        const now = new Date();
        setState(s => FabData.performDailyReset(s, now));
      }
```

Full updated effect:

```js
  React.useEffect(() => {
    function checkReset() {
      const today = FabData.todayStr();
      if (state.lastReset && state.lastReset !== today) {
        const now = new Date();
        setState(s => FabData.performDailyReset(s, now));
      }
    }
    checkReset();
    const t = setInterval(checkReset, 60000);
    return () => clearInterval(t);
  }, [state.lastReset]);
```

- [ ] **Step 3: Add `archiveCompletedCard` helper and rewrite `deleteCard`**

Find the existing `deleteCard` function (lines ~277–282):

```js
  function deleteCard(cardId) {
    setState(s => ({
      ...s,
      cards: s.cards.filter(c => c.id !== cardId),
    }));
    setEditingCard(null);
  }
```

Replace it with the helper + new `deleteCard` + `onConfirmCancel`:

```js
  function archiveCompletedCard(s, card) {
    const overtime = !!(card.startedAt && card.completedAt && card.estMin &&
      (new Date(card.completedAt) - new Date(card.startedAt)) > card.estMin * 60000);
    const enriched = { ...card, overtime };
    const date = card.completedAt
      ? new Date(card.completedAt).toISOString().slice(0, 10)
      : FabData.todayStr();
    const completedTasks = [...(s.completedTasks || [])];
    const idx = completedTasks.findIndex(e => e.date === date);
    if (idx !== -1) {
      completedTasks[idx] = {
        ...completedTasks[idx],
        cards: [...completedTasks[idx].cards, enriched],
      };
    } else {
      completedTasks.push({ date, cards: [enriched] });
    }
    return { ...s, cards: s.cards.filter(c => c.id !== card.id), completedTasks };
  }

  function deleteCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) { setEditingCard(null); return; }
    setEditingCard(null); // always close edit modal first
    if (card.col === 'done') {
      setState(s => archiveCompletedCard(s, card));
    } else {
      setCancellingCard(card); // opens CancelReasonModal
    }
  }

  function onConfirmCancel(cardId, reason) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) { setCancellingCard(null); return; }
    const date = FabData.todayStr();
    const archived = { ...card, cancelReason: reason || '' };
    setState(s => {
      const cancelledTasks = [...(s.cancelledTasks || [])];
      const idx = cancelledTasks.findIndex(e => e.date === date);
      if (idx !== -1) {
        cancelledTasks[idx] = {
          ...cancelledTasks[idx],
          cards: [...cancelledTasks[idx].cards, archived],
        };
      } else {
        cancelledTasks.push({ date, cards: [archived] });
      }
      return { ...s, cards: s.cards.filter(c => c.id !== cardId), cancelledTasks };
    });
    setCancellingCard(null);
  }
```

- [ ] **Step 4: Update the modal render to use exclusive modals**

Find the JSX block that renders `editingCard` (lines ~350–358):

```jsx
      {editingCard && (
        <CardModal
          state={state} editingCard={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={editCard}
          onDelete={deleteCard}
          onReassign={reassignCard}
        />
      )}
```

Replace it with the exclusive ternary (cancel modal takes priority):

```jsx
      {cancellingCard
        ? <CancelReasonModal
            card={cancellingCard}
            lang={state.lang || 'en'}
            onConfirm={onConfirmCancel}
            onClose={() => setCancellingCard(null)}
          />
        : editingCard
          ? <CardModal
              state={state} editingCard={editingCard}
              onClose={() => setEditingCard(null)}
              onSave={editCard}
              onDelete={deleteCard}
              onReassign={reassignCard}
            />
          : null}
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5000`.

**Test A — delete a non-Done card:**
1. Open any card NOT in the Done column (edit it)
2. Click the trash icon → confirm delete → the CancelReasonModal should appear
3. Type a reason, click "Remove task" → card disappears from board
4. In console: `JSON.parse(localStorage.getItem('fablab_utp_v3')).cancelledTasks` → should contain one entry with `cancelReason`

**Test B — delete a Done card:**
1. Move any card to Done (drag it or use arrow keys)
2. Open it → click trash → confirm delete
3. The card should disappear WITHOUT showing the cancel reason modal
4. In console: `JSON.parse(localStorage.getItem('fablab_utp_v3')).completedTasks` → should contain the card with `overtime: false/true`

**Test C — keep task (close cancel modal without deleting):**
1. Open a non-Done card → click trash → confirm → CancelReasonModal appears
2. Click "Keep task" → modal closes, card remains on board

- [ ] **Step 6: Commit**

```bash
git add app/main.jsx
git commit -m "feat: main — delete-card rework with cancel prompt and completed archive"
```

---

### Task 5: `CompletedTasksPanel` in admin

**Files:**
- Modify: `app/admin.jsx`

This task:
1. Adds `MachineTag` to the window destructure
2. Adds the `CompletedTasksPanel` component
3. Removes the Archive panel and all its associated state from `Admin`
4. Wires `CompletedTasksPanel` in the render

- [ ] **Step 1: Add `MachineTag` to the window destructure**

At the top of `admin.jsx` (line 4):

```js
const { Icon, Avatar } = window;
```

Change to:

```js
const { Icon, Avatar, MachineTag } = window;
```

- [ ] **Step 2: Add `CompletedTasksPanel` component**

Find the `AttendancePanel` component (line ~177). Insert `CompletedTasksPanel` **before** `AttendancePanel`:

```jsx
// ---------------------------------------------------------------------------
// CompletedTasksPanel — tasks archived from the Done column, by day
// ---------------------------------------------------------------------------
function CompletedTasksPanel({ state, lang }) {
  const groups = state.completedTasks || [];

  const [selectedDate, setSelectedDate] = React.useState(() => {
    if (groups.length === 0) return FabData.todayStr();
    return [...groups].map(g => g.date).sort().pop();
  });

  const entries = React.useMemo(() => {
    const group = groups.find(g => g.date === selectedDate);
    return group ? group.cards : [];
  }, [groups, selectedDate]);

  function getMember(id) {
    return (state.members || []).find(m => m.id === id);
  }

  function calcDurationMin(card) {
    if (!card.startedAt || !card.completedAt) return null;
    return Math.round((new Date(card.completedAt) - new Date(card.startedAt)) / 60000);
  }

  function fmtCompletedAt(card) {
    if (!card.completedAt) return '—';
    return FabData.fmtHHMM(new Date(card.completedAt));
  }

  const escCSV = val => '"' + (val || '').toString().replace(/"/g, '""') + '"';

  const exportCSV = () => {
    const header = ['fecha','tarea','prioridad','maquina','owner','asistentes','estimado_min','duracion_min','sobretiempo_min','completado_a'];
    const rows = [header];
    entries.forEach(c => {
      const owner = getMember(c.owner);
      const assistantNames = (c.assistants || []).map(id => {
        const m = getMember(id);
        return m ? m.name : id;
      }).join('|');
      const durationMin = calcDurationMin(c);
      const overtimeMin = durationMin !== null ? durationMin - (c.estMin || 0) : null;
      rows.push([
        selectedDate,
        escCSV(c.title),
        c.priority || '',
        c.machine || '',
        escCSV(owner ? owner.name : c.owner),
        escCSV(assistantNames),
        c.estMin || '',
        durationMin !== null ? durationMin : '',
        overtimeMin !== null ? overtimeMin : '',
        fmtCompletedAt(c),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-completadas-' + selectedDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('admin.completed_title', lang)}</h3>
        <p>{t('admin.completed_desc', lang)}</p>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {t('admin.completed_date', lang)}
          </label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160, height: 36 }}
          />
        </div>

        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('admin.completed_empty', lang)}</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{/* title + owner + assistants */}</th>
                <th>{t('admin.completed_estimated', lang)}</th>
                <th>{t('admin.completed_duration', lang)}</th>
                <th>{t('admin.completed_at', lang)}</th>
                <th>{t('admin.completed_overtime', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((c, i) => {
                const owner = getMember(c.owner);
                const durationMin = calcDurationMin(c);
                const overtimeMin = durationMin !== null ? durationMin - (c.estMin || 0) : null;
                return (
                  <tr key={c.id || i}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {owner && <Avatar member={owner} size="sm" />}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {owner ? owner.name : (c.owner || '—')}
                          </span>
                          {c.priority && <span className={'pri ' + c.priority} title={c.priority} />}
                          {c.machine && MachineTag && <MachineTag machineId={c.machine} />}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.title}</span>
                        {(c.assistants || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.assistants.map(id => {
                              const m = getMember(id);
                              return m ? <Avatar key={id} member={m} size="sm" /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {c.estMin ? FabData.fmtDuration(c.estMin * 60000) : '—'}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {durationMin !== null ? FabData.fmtDuration(durationMin * 60000) : '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {fmtCompletedAt(c)}
                    </td>
                    <td>
                      {c.overtime && overtimeMin !== null && overtimeMin > 0 ? (
                        <span className="overtime-badge">+{FabData.fmtDuration(overtimeMin * 60000)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {entries.length > 0 && (
          <button className="btn btn-accent" onClick={exportCSV} style={{ marginTop: 14 }}>
            {t('admin.completed_export', lang)}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remove archive-related state and helpers from `Admin`**

Inside the `Admin` function, remove these blocks entirely:

**a) Archive useMemo and state (lines ~329–345):**
```js
  const archiveEntries = React.useMemo(() => {
    ...
  }, [state.archived]);

  const [archiveFrom, setArchiveFrom] = React.useState('');
  const [archiveTo,   setArchiveTo]   = React.useState('');

  const filteredArchiveEntries = React.useMemo(() => {
    ...
  }, [archiveEntries, archiveFrom, archiveTo]);
```

**b) `hasArchived`, `formatDate`, `getMemberName` (lines ~455–469):**
```js
  const hasArchived = archiveEntries.length > 0;

  const formatDate = (dateStr) => { ... };

  const getMemberName = (ownerId) => { ... };
```

**c) In `handleStartFresh` (lines ~537–538), remove the two archive filter resets:**
```js
      setArchiveFrom('');   // ← remove
      setArchiveTo('');     // ← remove
```

- [ ] **Step 4: Replace the Archive panel JSX with `CompletedTasksPanel`**

Find the Archive panel in the render (lines ~720–776):

```jsx
          {/* ---- Archived tasks ---------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.archive_title', lang)}</h3>
              ...
            </div>
            ...
          </div>
```

Replace the entire Archive panel `<div className="panel">...</div>` block with:

```jsx
          {/* ---- Completed tasks --------------------------------------- */}
          <CompletedTasksPanel state={state} lang={lang} />
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5000` → go to Admin → unlock with `admin`.

1. Scroll to the "Completed Tasks" panel — it should appear where Archive used to be
2. If `completedTasks` is empty, the panel shows the empty-state message
3. To test with data: move a card to Done, then delete it from Done (trash → Yes, delete). The card should now appear in CompletedTasksPanel for today
4. The day selector should default to the most recent date with data
5. Click "Export CSV" → file `fablab-completadas-YYYY-MM-DD.csv` downloads with correct columns

- [ ] **Step 6: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: admin — CompletedTasksPanel replaces Archive panel"
```

---

### Task 6: `CancelledTasksPanel` in admin

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add `CancelledTasksPanel` component**

Find `CompletedTasksPanel` (just added). Insert `CancelledTasksPanel` immediately after it, before `AttendancePanel`:

```jsx
// ---------------------------------------------------------------------------
// CancelledTasksPanel — tasks deleted outside Done column, with reason
// ---------------------------------------------------------------------------
function CancelledTasksPanel({ state, lang }) {
  const groups = state.cancelledTasks || [];

  const [selectedDate, setSelectedDate] = React.useState(() => {
    if (groups.length === 0) return FabData.todayStr();
    return [...groups].map(g => g.date).sort().pop();
  });

  const entries = React.useMemo(() => {
    const group = groups.find(g => g.date === selectedDate);
    return group ? group.cards : [];
  }, [groups, selectedDate]);

  function getMember(id) {
    return (state.members || []).find(m => m.id === id);
  }

  const COL_LABELS = {
    backlog:    t('col.backlog',     lang),
    ready:      t('col.ready',       lang),
    inprogress: t('col.inprogress',  lang),
    done:       t('col.done',        lang),
  };

  const escCSV = val => '"' + (val || '').toString().replace(/"/g, '""') + '"';

  const exportCSV = () => {
    const header = ['fecha','tarea','prioridad','maquina','owner','asistentes','columna','creado_en','razon'];
    const rows = [header];
    entries.forEach(c => {
      const owner = getMember(c.owner);
      const assistantNames = (c.assistants || []).map(id => {
        const m = getMember(id);
        return m ? m.name : id;
      }).join('|');
      rows.push([
        selectedDate,
        escCSV(c.title),
        c.priority || '',
        c.machine || '',
        escCSV(owner ? owner.name : c.owner),
        escCSV(assistantNames),
        c.col || '',
        c.createdAt || '',
        escCSV(c.cancelReason || ''),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-canceladas-' + selectedDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('admin.cancelled_title', lang)}</h3>
        <p>{t('admin.cancelled_desc', lang)}</p>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {t('admin.cancelled_date', lang)}
          </label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160, height: 36 }}
          />
        </div>

        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('admin.cancelled_empty', lang)}</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{/* title + owner */}</th>
                <th>{t('admin.cancelled_column', lang)}</th>
                <th>{t('admin.cancelled_created', lang)}</th>
                <th>{t('admin.cancelled_reason', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((c, i) => {
                const owner = getMember(c.owner);
                const createdAt = c.createdAt
                  ? new Date(c.createdAt).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '—';
                return (
                  <tr key={c.id || i}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {owner && <Avatar member={owner} size="sm" />}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {owner ? owner.name : (c.owner || '—')}
                          </span>
                          {c.priority && <span className={'pri ' + c.priority} title={c.priority} />}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.title}</span>
                        {(c.assistants || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.assistants.map(id => {
                              const m = getMember(id);
                              return m ? <Avatar key={id} member={m} size="sm" /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {COL_LABELS[c.col] || c.col || '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{createdAt}</td>
                    <td style={{ fontSize: 13, color: c.cancelReason ? 'var(--text)' : 'var(--text-3)', maxWidth: 200 }}>
                      {c.cancelReason
                        ? c.cancelReason.length > 80
                          ? c.cancelReason.slice(0, 80) + '…'
                          : c.cancelReason
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {entries.length > 0 && (
          <button className="btn btn-accent" onClick={exportCSV} style={{ marginTop: 14 }}>
            {t('admin.cancelled_export', lang)}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `CancelledTasksPanel` in the Admin render**

Find the `CompletedTasksPanel` line in the render (just added in Task 5):

```jsx
          {/* ---- Completed tasks --------------------------------------- */}
          <CompletedTasksPanel state={state} lang={lang} />
```

Add `CancelledTasksPanel` immediately after it:

```jsx
          {/* ---- Completed tasks --------------------------------------- */}
          <CompletedTasksPanel state={state} lang={lang} />

          {/* ---- Cancelled tasks --------------------------------------- */}
          <CancelledTasksPanel state={state} lang={lang} />
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5000` → Admin → unlock.

1. Scroll past "Completed Tasks" — "Cancelled Tasks" panel should appear below it
2. To populate it: open any non-Done card → trash → confirm → type a reason in the modal → click "Remove task"
3. Go to Admin → Cancelled Tasks panel → the card should appear with the reason, column, and created time
4. Panel order should be: Completed Tasks → Cancelled Tasks → Attendance → Export
5. Click "Export CSV" → `fablab-canceladas-YYYY-MM-DD.csv` downloads with `fecha,tarea,prioridad,maquina,owner,asistentes,columna,creado_en,razon`

**Full EOD test (simulate day rollover):**

In the browser console, force a day rollover by temporarily setting `lastReset` to yesterday, then triggering the reset check:

```js
// 1. Check in a member and put a card in Done
// 2. Then manually trigger reset:
const s = JSON.parse(localStorage.getItem('fablab_utp_v3'));
s.lastReset = '2026-05-29'; // yesterday
localStorage.setItem('fablab_utp_v3', JSON.stringify(s));
location.reload();
// After reload, the checkReset effect fires immediately:
// - Done cards → completedTasks
// - Open attendance sessions → closed
// - Members → all checked out
```

After reload, verify:
- `JSON.parse(localStorage.getItem('fablab_utp_v3')).completedTasks` → contains yesterday's Done cards
- All members show as not checked in on the board
- Attendance sessions have `checkOut` set

- [ ] **Step 4: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: admin — CancelledTasksPanel with day selector and CSV export"
```

---

## Self-Review

**Spec coverage:**
- ✅ Spec §1 (data model) — `completedTasks`, `cancelledTasks`, `overtime` field, migrations: Tasks 1–2
- ✅ Spec §2 (performDailyReset) — EOD checkout + archive: Task 2
- ✅ Spec §3 (delete card two paths, archiveCompletedCard, onConfirmCancel, CancelReasonModal): Tasks 3–4
- ✅ Spec §4 (CompletedTasksPanel, CancelledTasksPanel, panel order): Tasks 5–6
- ✅ Spec §5 (i18n keys): Task 1
- ✅ Spec §6 (files modified): all files covered
- ✅ Spec §7 (edge cases): `startedAt: null` → `durationMin = null` → `—` in display; `cancelReason: ""` → `—`; `findIndex + spread` immutability; migration `delete state.archived`; `lastReset: ""` → `todayStr()`

**Type consistency:**
- `archiveCompletedCard` takes `(s, card)` → called as `setState(s => archiveCompletedCard(s, card))` ✅
- `performDailyReset(state, now)` → called as `FabData.performDailyReset(s, now)` ✅
- `CancelReasonModal` props: `{ card, lang, onConfirm, onClose }` → used in render as `<CancelReasonModal card={cancellingCard} lang={...} onConfirm={onConfirmCancel} onClose={...} />` ✅
- `CompletedTasksPanel` and `CancelledTasksPanel` both receive `{ state, lang }` — consistent ✅

**No placeholders:** All steps contain complete code. ✅
