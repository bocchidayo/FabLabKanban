# Undo Toast — Design Spec

**Date:** 2026-06-04  
**Status:** Approved, implementation-ready

## Problem

Three actions on the board have no recovery path after an accidental tap:

- **Wake now** — clears `scheduledFor` and calls `saveNow` immediately. The only recovery is reopening the modal and rescheduling by hand.
- **Move to Done** — stamps `completedAt`, clears `startedAt` (if coming from In Progress), and the card visually leaves the active workflow. No confirmation.
- **General column moves** — explicitly out of scope. Moving Backlog → Ready or Ready → In Progress is reversible by design; the `startedAt` timestamp concern is real but minor and doesn't warrant a toast on every move.

**Delete** is also out of scope: it already has a confirmation gate (the cancel-reason modal) suited to the gravity of that action. Undo toast and delete confirmation serve different moments and don't overlap.

## Solution

A single-slot undo toast that appears for **10 seconds** after either of the two in-scope actions. The user can tap **Undo** to reverse the action. If the toast expires, the action is committed.

10 s is intentional: long enough for a kiosk user to glance up from what they were doing; short enough not to feel like a permanent fixture.

---

## Architecture

### New state in `App` (`main.jsx`)

```js
const [undoToast, setUndoToast] = React.useState(null);
const undoTimerRef = React.useRef(null);
```

`undoToast` is either `null` (toast hidden) or a snapshot object (toast visible).  
`undoTimerRef` holds the `setTimeout` handle. A ref rather than state — changing the timer must never trigger a re-render.

### Snapshot shapes

Only the fields needed to reverse the specific action are stored. No full-state clones.

**Wake now:**
```js
{
  type: 'wake',
  cardId,
  scheduledFor: card.scheduledFor,   // previous value — restored on undo
  label: string,                      // computed at push time from card.title
}
```

**Move to Done:**
```js
{
  type: 'done',
  cardId,
  prevCol: card.col,                  // column before the move
  prevCompletedAt: null,              // always null; stored for self-documentation
  prevStartedAt: card.col === 'inprogress' ? card.startedAt : undefined,
  label: string,
}
```

`prevStartedAt` is required because `moveCard` deletes `startedAt` when moving away from In Progress. Without it, undoing a Done move on an In Progress card restores the column but permanently loses the timer start time.

`label` is computed at push time from the card object already in hand — not looked up at render time. By the time the toast renders, the card has already moved, so looking it up from `state.cards` at render time would require a find-by-id and an existence check. Simpler and more reliable to capture it upfront.

### `pushUndoToast(toast)` helper

```js
function pushUndoToast(toast) {
  clearTimeout(undoTimerRef.current);
  const timerId = setTimeout(() => setUndoToast(null), 10_000);
  undoTimerRef.current = timerId;
  setUndoToast(toast);
}
```

`clearTimeout` before setting the new timer means if a second undoable action fires while a toast is already showing, the existing timer is cancelled automatically and the new toast replaces it. No special "already showing" logic needed.

---

## Action intercepts

### `handleWakeNow(cardId)` — `main.jsx`

Snapshot and push the toast **before** the `setState` + `saveNow`. The toast appears before the save fires.

If `saveNow` fails, the toast is already visible and `handleUndo` will attempt a restore. The existing `fabdata:saveerror` banner handles the retry case — a `saveNow` failure does not silently swallow the undo.

### `moveCard(cardId, targetCol, beforeId)` — `main.jsx`

Add an intercept at the top of the function that fires only when `targetCol === 'done'`.

> **Note:** `moveCard` is also called internally by `claimStart`. The `claimStart` path does not trigger the undo toast — it is not in scope. Do not add it without first thinking through the `startedAt` timestamp implications.

---

## Undo handler

```js
function handleUndo() {
  clearTimeout(undoTimerRef.current);
  const toast = undoToast;
  setUndoToast(null);

  // Guard: card may have been removed by a concurrent action during the toast window
  const card = state.cards.find(c => c.id === toast.cardId);
  if (!card) return;

  if (toast.type === 'wake') {
    setState(s => ({
      ...s,
      cards: s.cards.map(c =>
        c.id === toast.cardId ? { ...c, scheduledFor: toast.scheduledFor } : c
      ),
    }));
  } else if (toast.type === 'done') {
    setState(s => ({
      ...s,
      cards: s.cards.map(c =>
        c.id === toast.cardId
          ? {
              ...c,
              col: toast.prevCol,
              completedAt: toast.prevCompletedAt,
              ...(toast.prevStartedAt ? { startedAt: toast.prevStartedAt } : {}),
            }
          : c
      ),
    }));
  }
}
```

Clearing the toast and timer before the guard ensures the UI cleans up correctly even if the card no longer exists — no orphaned toast on screen.

Undo uses the regular debounced `save` (via `setState` → `useEffect`), not `saveNow`. This is sufficient for the undo path.

---

## `UndoToast` component

Lives in `board.jsx`, exposed on `window` via the existing `Object.assign(window, {...})` at the bottom of that file.

```jsx
function UndoToast({ toast, onUndo, lang }) {
  if (!toast) return null;
  return (
    <div className="undo-toast">
      <span className="undo-toast-label">{toast.label}</span>
      <button className="undo-toast-btn" onClick={onUndo}>
        {t('action.undo', lang)}
      </button>
    </div>
  );
}
```

**Placement in `App`'s JSX:** after `<Board … />`, before the modal/overlay stack. Modals and the screensaver (z-index 100 and 200 respectively) render on top without z-index conflict.

---

## Styling (`styles.css`)

```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.undo-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.35);
  animation: slideUp 180ms ease;
}

.undo-toast-label {
  color: var(--text);
  font-size: 14px;
}

.undo-toast-btn {
  padding: 4px 12px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
.undo-toast-btn:hover { background: var(--accent); color: #fff; }
```

z-index 90 sits above the board, below `.overlay` (100) and the screensaver (200). The toast is hidden behind the screensaver anyway since the screensaver renders on top — no conflict.

`var(--surface)` provides enough distinction from `var(--bg)` (#f0f1f3) at TV viewing distance. The border and box-shadow do the separation work.

---

## i18n (`i18n.js`)

Three new keys:

```js
'action.undo':        { en: 'Undo',                      es: 'Deshacer'              },
'undo.woke_card':     { en: 'Woke "{title}"',            es: 'Despertada "{title}"'  },
'undo.moved_to_done': { en: 'Moved "{title}" to Done',   es: '"{title}" movida a Hecho' },
```

Spanish gender agreement: *tarea* is feminine, so *movida* and *despertada* are correct.

---

## Files changed

| File | Change |
|------|--------|
| `app/main.jsx` | `undoToast` state + `undoTimerRef` ref + `pushUndoToast` + `handleUndo`; intercepts in `handleWakeNow` and `moveCard`; `<UndoToast>` in JSX |
| `app/board.jsx` | `UndoToast` component + add to `Object.assign(window, {...})` |
| `app/styles.css` | `@keyframes slideUp` + `.undo-toast` + `.undo-toast-label` + `.undo-toast-btn` |
| `app/i18n.js` | 3 new translation keys |

No schema changes. No new files. No new dependencies.
