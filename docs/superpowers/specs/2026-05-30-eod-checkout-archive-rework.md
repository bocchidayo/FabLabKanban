# EOD Auto-Checkout + Archive Rework

**Date:** 2026-05-30
**Branch:** feat/checkin-features (or new branch off main)

---

## Goal

Two coordinated features:

1. **EOD auto-checkout** — when the calendar day rolls over, automatically close all open attendance sessions and check out all members.
2. **Archive rework** — replace the single flat `state.archived` with two separate arrays (`completedTasks` and `cancelledTasks`), each viewable by day in the admin panel. Deleting a card from Done archives it immediately as completed; deleting from any other column shows a cancel-reason prompt and archives as cancelled.

---

## 1. Data Model

### 1.1 `state.completedTasks` (replaces `state.archived`)

```js
completedTasks: [
  {
    date: "2026-05-30",   // YYYY-MM-DD, date the card was archived
    cards: [
      {
        id, title, priority, machine,
        owner,        // memberId string
        assistants,   // [memberId]
        estMin,       // original estimate in minutes
        startedAt,    // ISO timestamp | null (null if never moved to In Progress)
        completedAt,  // ISO timestamp
        overtime,     // bool: (completedAt - startedAt) > estMin * 60000
      }
    ]
  }
]
```

### 1.2 `state.cancelledTasks`

```js
cancelledTasks: [
  {
    date: "2026-05-30",   // YYYY-MM-DD, date of deletion
    cards: [
      {
        id, title, priority, machine,
        owner,        // memberId string
        assistants,   // [memberId]
        estMin,
        createdAt,    // ISO timestamp
        startedAt,    // ISO timestamp | null
        cancelReason, // string, may be empty ""
      }
    ]
  }
]
```

### 1.3 `overtime` field

`overtime: bool` is a pre-computed flag stored on archived cards for fast lookup. The numeric `overtime_min` value is **always derived at display/export time** and never stored:

```js
var durationMin = Math.round((new Date(c.completedAt) - new Date(c.startedAt)) / 60000);
var overtimeMin = durationMin - c.estMin;
// overtimeMin > 0 → over budget; overtimeMin < 0 → finished early; null if no startedAt
```

`startedAt` and `completedAt` are stored as ISO strings; always wrap in `new Date()` before arithmetic.

### 1.4 Migrations in `data.js load()`

```js
// Rename archived → completedTasks, remove old key to prevent localStorage bloat
if (!state.completedTasks) {
  state.completedTasks = state.archived || [];
}
if (!state.cancelledTasks) state.cancelledTasks = [];
delete state.archived; // safe: no-op if key doesn't exist

// Fix lastReset="" (falsy) from old migration — was preventing daily reset from firing
if (!state.lastReset) state.lastReset = todayStr();
```

### 1.5 `buildSeed()` and `buildEmpty()`

Replace `archived: []` with `completedTasks: [], cancelledTasks: []`. Both already initialize `lastReset: todayStr()`.

---

## 2. EOD Auto-Checkout (`data.js`)

### 2.1 Rename `archiveDoneCards` → `performDailyReset`

The new function runs **unconditionally** when the day changes — not only when Done cards exist — because attendance checkout must happen regardless.

```js
function performDailyReset(state, now) {
  var today = todayStr();
  var archiveDate = state.lastReset || today;

  // 1. Archive Done cards → completedTasks
  var doneCards = state.cards.filter(function (c) { return c.col === 'done'; });
  var activeCards = state.cards.filter(function (c) { return c.col !== 'done'; });
  var completedTasks = [...(state.completedTasks || [])];

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

Expose as `window.FabData.performDailyReset`. Remove `archiveDoneCards` from the exposed API.

### 2.2 Update `main.jsx` — `checkReset`

```js
function checkReset() {
  const today = FabData.todayStr();
  if (state.lastReset && state.lastReset !== today) {
    const now = new Date();
    setState(s => FabData.performDailyReset(s, now));
  }
}
checkReset();
const t = setInterval(checkReset, 60000);
```

---

## 3. Delete Card — Two Paths (`main.jsx`)

### 3.1 Helper: archive one card to `completedTasks`

Used both for EOD batch archiving and immediate delete-from-Done:

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
```

### 3.2 `deleteCard` — split by column

```js
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
```

### 3.3 `onConfirmCancel`

```js
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

### 3.4 New state + modal render in `App`

```js
const [cancellingCard, setCancellingCard] = React.useState(null);
```

Render — exclusive, cancel takes priority:
```jsx
{cancellingCard
  ? <CancelReasonModal
      card={cancellingCard}
      lang={state.lang}
      onConfirm={onConfirmCancel}
      onClose={() => setCancellingCard(null)}
    />
  : editingCard
    ? <CardModal ... />
    : null}
```

### 3.5 `CancelReasonModal` component (`app/modal.jsx`)

Simple modal with a `<textarea>` for the reason. Defined in `modal.jsx` alongside `CardModal` — consistent with the existing modal pattern.

**"Mantener tarea" / "Keep task"** dismisses the modal without any action. The card remains on the board exactly where it was. This is intentional UX: the prompt is a reflection point, not a trap. The implementer should not add any deletion logic to the cancel/close path.

**"Eliminar tarea" / "Remove task"** calls `onConfirm(card.id, reason)` which archives to `cancelledTasks` and removes from `state.cards`.

```jsx
function CancelReasonModal({ card, lang, onConfirm, onClose }) {
  const [reason, setReason] = React.useState('');
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <h3>{t('cancel.title', lang)}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
          <strong>{card.title}</strong>
        </p>
        <textarea
          className="input"
          rows={3}
          style={{ width: '100%', resize: 'vertical' }}
          placeholder={t('cancel.placeholder', lang)}
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <div className="field" style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t('cancel.keep', lang)}</button>
          <button className="btn btn-coral" onClick={() => onConfirm(card.id, reason)}>
            {t('cancel.confirm', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Admin Panels (`admin.jsx`)

The existing **Archive panel** is removed and replaced by two new panels.

### 4.1 `CompletedTasksPanel`

**Day selector:** `input[type=date]`. Default = most recent date in `state.completedTasks` (or `FabData.todayStr()` if empty).

**Table columns:**

| Título | Prioridad | Owner + Asistentes | Máquina | Estimado | Duración | Completado a | Sobretiempo |
|---|---|---|---|---|---|---|---|
| `card.title` | priority badge | owner Avatar + assistant Avatar chips | MachineTag | `fmtDuration(estMin * 60000)` | real duration via `fmtDuration` | `completedAt` as `HH:MM` | `"+Xh Ym"` in red if `overtime`, `—` otherwise |

- `startedAt` null → duration cell shows `—`, overtime cell shows `—`
- `overtime_min` computed at render: `Math.round((new Date(c.completedAt) - new Date(c.startedAt)) / 60000) - c.estMin`

**Export CSV:** filename `fablab-completadas-YYYY-MM-DD.csv`

```
fecha,tarea,prioridad,maquina,owner,asistentes,estimado_min,duracion_min,sobretiempo_min,completado_a
```

- `duracion_min`: integer or empty if no `startedAt`
- `sobretiempo_min`: integer — positive = over budget, negative = finished early, empty if no `startedAt`. A negative value is not an error; it means the task finished ahead of estimate.
- `asistentes`: member names separated by `|`
- `completado_a`: `HH:MM`

### 4.2 `CancelledTasksPanel`

**Day selector:** same pattern, default = most recent date in `state.cancelledTasks`.

**Table columns:**

| Título | Prioridad | Owner + Asistentes | Máquina | Columna | Creado | Razón |
|---|---|---|---|---|---|---|
| `card.title` | priority badge | owner Avatar + assistant chips | MachineTag | column label | `createdAt` as `HH:MM` (or date if different day) | text, max 80 chars display, `—` if empty |

**Export CSV:** filename `fablab-canceladas-YYYY-MM-DD.csv`

```
fecha,tarea,prioridad,maquina,owner,asistentes,columna,creado_en,razon
```

- `creado_en`: full ISO timestamp
- `asistentes`: names separated by `|`

### 4.3 Panel order in admin

1. Members
2. Lab settings
3. Language
4. Machines
5. Password
6. **Completed Tasks** ← replaces Archive
7. **Cancelled Tasks** ← new
8. Attendance
9. Export

---

## 5. i18n Keys (`i18n.js`)

```js
// Cancel modal
"cancel.title":       { en: "Why is this task being removed?", es: "¿Por qué se elimina esta tarea?" },
"cancel.placeholder": { en: "Reason (optional)",               es: "Razón (opcional)" },
"cancel.keep":        { en: "Keep task",                       es: "Mantener tarea" },
"cancel.confirm":     { en: "Remove task",                     es: "Eliminar tarea" },

// Completed tasks panel
"admin.completed_title":    { en: "Completed Tasks",                    es: "Tareas Completadas" },
"admin.completed_desc":     { en: "Tasks archived from the Done column by day.", es: "Tareas archivadas desde la columna completados por día." },
"admin.completed_date":     { en: "Day",                                es: "Día" },
"admin.completed_empty":    { en: "No completed tasks for this day.",   es: "Sin tareas completadas para este día." },
"admin.completed_export":   { en: "Export CSV",                         es: "Exportar CSV" },
"admin.completed_estimated":{ en: "Est.",                               es: "Est." },
"admin.completed_duration": { en: "Duration",                           es: "Duración" },
"admin.completed_at":       { en: "Done at",                            es: "Completado a" },
"admin.completed_overtime": { en: "Overtime",                           es: "Sobretiempo" },

// Cancelled tasks panel
"admin.cancelled_title":    { en: "Cancelled Tasks",                    es: "Tareas Canceladas" },
"admin.cancelled_desc":     { en: "Tasks removed before completion, with reason.", es: "Tareas eliminadas antes de completarse, con razón." },
"admin.cancelled_date":     { en: "Day",                                es: "Día" },
"admin.cancelled_empty":    { en: "No cancelled tasks for this day.",   es: "Sin tareas canceladas para este día." },
"admin.cancelled_export":   { en: "Export CSV",                         es: "Exportar CSV" },
"admin.cancelled_column":   { en: "Column",                             es: "Columna" },
"admin.cancelled_created":  { en: "Created",                            es: "Creado" },
"admin.cancelled_reason":   { en: "Reason",                             es: "Razón" },
```

---

## 6. Files Modified

| File | Changes |
|---|---|
| `app/data.js` | `performDailyReset` replaces `archiveDoneCards`; migrations for `completedTasks`, `cancelledTasks`, `lastReset`; `buildSeed`/`buildEmpty` updated |
| `app/main.jsx` | `deleteCard` split; `archiveCompletedCard` helper; `cancellingCard` state; `CancelReasonModal` in render; `checkReset` uses `performDailyReset` |
| `app/modal.jsx` | Add `CancelReasonModal` component |
| `app/admin.jsx` | Remove Archive panel; add `CompletedTasksPanel` + `CancelledTasksPanel`; update all `state.archived` refs |
| `app/i18n.js` | Add `cancel.*` and `admin.completed_*` and `admin.cancelled_*` keys |
| `app/styles.css` | `.btn-coral` if not already present; overtime badge styles |

---

## 7. Edge Cases

| Case | Handling |
|---|---|
| Card never started (`startedAt: null`) | Duration, overtime, and `sobretiempo_min` in CSV are empty/`—` |
| `cancelReason` empty | Display `—`; CSV column is empty string |
| Multiple entries same date | `findIndex` + spread pattern; never mutate existing objects |
| Existing `state.archived` on migration | Copied to `completedTasks`, `archived` key deleted |
| `lastReset: ""` from old migration | Now replaced with `todayStr()` so daily reset fires correctly |
| Member deleted but referenced in archive | Display `memberId` as fallback; skip Avatar render |
| Day selector with no data | Shows `todayStr()` with empty-state message |
| Cards in Done at reset with no `startedAt` | `overtime: false`, duration blank |

---

## 8. Out of Scope

- Editing or deleting archive entries
- Undo for cancelled tasks
- Bulk cancel with shared reason
- Filtering archive by member or machine
