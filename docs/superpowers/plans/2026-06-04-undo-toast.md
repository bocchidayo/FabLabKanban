# Undo Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 10-second undo toast for wake-now and move-to-done actions, giving kiosk users a recovery path after accidental taps with no existing confirmation.

**Architecture:** Single `undoToast` state slot in `App` (main.jsx) holds a minimal snapshot of only the fields changed by the action. `pushUndoToast` clears any running timer before starting a new one, so a second action naturally replaces the first toast. `UndoToast` is a pure display component in board.jsx. Delete is explicitly out of scope — it already has the cancel-reason modal as a confirmation gate.

**Tech Stack:** React 18 UMD globals, plain JSX (Babel-standalone in-browser), CSS custom properties. No build step — all JS runs as `<script type="text/babel">` tags loaded by index.html.

---

### Task 1: Add i18n translation keys

**Files:**
- Modify: `app/i18n.js:85`

- [ ] **Step 1: Insert 3 keys after `action.delete_warning`**

Open `app/i18n.js`. Find line 85:
```js
    "action.delete_warning":     { en: "Delete this task? This cannot be undone.", es: "¿Eliminar esta tarea? No se puede deshacer." },
```
Insert immediately after it:
```js
    "action.undo":               { en: "Undo",                          es: "Deshacer"                 },
    "undo.woke_card":            { en: 'Woke "{title}"',                es: 'Despertada "{title}"'     },
    "undo.moved_to_done":        { en: 'Moved "{title}" to Done',       es: '"{title}" movida a Hecho' },
```

- [ ] **Step 2: Verify keys are present**

```bash
grep -n 'action\.undo\|undo\.woke\|undo\.moved' app/i18n.js
```
Expected output: 3 lines showing the three new keys.

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat(i18n): add undo toast translation keys"
```

---

### Task 2: Add CSS styles

**Files:**
- Modify: `app/styles.css:516`

- [ ] **Step 1: Add slideUp keyframe and toast styles after `@keyframes pop`**

Open `app/styles.css`. Find line 516:
```css
@keyframes pop { from { transform: translateY(8px) scale(.98); opacity: 0; } }
```
Insert immediately after it:
```css
@keyframes slideUp { from { bottom: 0; opacity: 0; } to { bottom: 24px; opacity: 1; } }
.undo-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 90; display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: var(--surface);
  border: 1px solid var(--border-strong); border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.35);
  animation: slideUp 180ms ease;
}
.undo-toast-label { color: var(--text); font-size: 14px; }
.undo-toast-btn {
  padding: 4px 12px; border: 1px solid var(--accent); border-radius: 6px;
  background: transparent; color: var(--accent); font-size: 13px; cursor: pointer;
  white-space: nowrap;
}
.undo-toast-btn:hover { background: var(--accent); color: #fff; }
```

Note: `slideUp` animates `bottom` and `opacity` only — this avoids any conflict with the `transform: translateX(-50%)` centering already on `.undo-toast`. The base style's `transform` is untouched throughout the animation.

z-index 90 sits above the board, below `.overlay` (100) and the screensaver (200). The toast is occluded by both correctly without any z-index fighting.

- [ ] **Step 2: Verify**

```bash
grep -n 'slideUp\|undo-toast' app/styles.css
```
Expected: 5 or more matching lines.

- [ ] **Step 3: Commit**

```bash
git add app/styles.css
git commit -m "feat(styles): add undo toast slideUp animation and styles"
```

---

### Task 3: Add UndoToast component to board.jsx

**Files:**
- Modify: `app/board.jsx:744` (just before the final `Object.assign` line)

- [ ] **Step 1: Add the UndoToast function before the Object.assign export**

Open `app/board.jsx`. Find the last line (line 745):
```js
Object.assign(window, { Icon, Avatar, MachineTag, Board });
```
Insert immediately before it:
```jsx
// ---------------------------------------------------------------------------
// UndoToast — fixed bottom-center toast with a single Undo action
// ---------------------------------------------------------------------------
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

- [ ] **Step 2: Export UndoToast on window**

Change the `Object.assign` line from:
```js
Object.assign(window, { Icon, Avatar, MachineTag, Board });
```
To:
```js
Object.assign(window, { Icon, Avatar, MachineTag, Board, UndoToast });
```

- [ ] **Step 3: Verify**

```bash
grep -n 'UndoToast' app/board.jsx
```
Expected: 2 lines — the `function UndoToast` definition and the `Object.assign` export.

- [ ] **Step 4: Check for runtime errors**

```bash
python3 server.py &
```
Open http://127.0.0.1:5001 in a browser. Open DevTools console (F12). Confirm no JS errors. Run `window.UndoToast` in the console — it should return a function, not `undefined`.

Kill the dev server: `kill %1`

- [ ] **Step 5: Commit**

```bash
git add app/board.jsx
git commit -m "feat(board): add UndoToast component"
```

---

### Task 4: Add state, ref, pushUndoToast, and handleUndo to main.jsx

**Files:**
- Modify: `app/main.jsx:55` (state block)
- Modify: `app/main.jsx:126` (refs block — line shifts +1 after the state insert)
- Modify: `app/main.jsx` (after `handleWakeNow` function)

- [ ] **Step 1: Add undoToast state**

Open `app/main.jsx`. Find line 55:
```js
  const [showTutorial, setShowTutorial] = React.useState(false);
```
Insert immediately after it:
```js
  const [undoToast, setUndoToast] = React.useState(null);
```

- [ ] **Step 2: Add undoTimerRef**

Find the `idleRef` line (now line 127 after the insert above):
```js
  const idleRef = React.useRef(null);
```
Insert immediately after it:
```js
  const undoTimerRef = React.useRef(null);
```

- [ ] **Step 3: Add pushUndoToast and handleUndo**

Find `async function handleWakeNow`. It ends with:
```js
      // saveNow failure is non-fatal — debounced save will retry
    }
  }
```
Insert immediately after the closing `}` of `handleWakeNow`:
```js
  function pushUndoToast(toast) {
    clearTimeout(undoTimerRef.current);
    const timerId = setTimeout(() => setUndoToast(null), 10_000);
    undoTimerRef.current = timerId;
    setUndoToast(toast);
  }

  function handleUndo() {
    clearTimeout(undoTimerRef.current);
    const toast = undoToast;
    setUndoToast(null);
    const card = state.cards.find(c => c.id === toast.cardId);
    if (!card) return; // card removed by concurrent action during toast window
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

- [ ] **Step 4: Verify no runtime errors**

Start `python3 server.py &`, open http://127.0.0.1:5001, check the console. The board should load normally with no errors. Kill the server.

- [ ] **Step 5: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): add undoToast state, pushUndoToast, handleUndo"
```

---

### Task 5: Intercept moveCard for move-to-done

**Files:**
- Modify: `app/main.jsx` — `moveCard` function

- [ ] **Step 1: Add the done intercept at the top of moveCard**

Find `function moveCard(cardId, targetCol, beforeId) {`. The current opening is:
```js
  function moveCard(cardId, targetCol, beforeId) {
    setState(s => {
```
Replace with:
```js
  function moveCard(cardId, targetCol, beforeId) {
    // Note: claimStart also calls moveCard internally — that path does NOT
    // trigger the undo toast. Do not add it without thinking through the
    // startedAt timestamp implications first.
    if (targetCol === 'done') {
      const card = state.cards.find(c => c.id === cardId);
      if (card) {
        pushUndoToast({
          type: 'done',
          cardId,
          prevCol: card.col,
          prevCompletedAt: null,
          prevStartedAt: card.col === 'inprogress' ? card.startedAt : undefined,
          label: t('undo.moved_to_done', state.lang).replace('{title}', card.title),
        });
      }
    }
    setState(s => {
```

- [ ] **Step 2: Manual verification — basic undo**

Start `python3 server.py`. Open http://127.0.0.1:5001.
1. Create a card in Backlog.
2. Drag it to the Done column (or use keyboard arrow keys).
3. **Expected:** Toast appears at bottom-center: `Moved "X" to Done` with an **Undo** button.
4. Click **Undo**.
5. **Expected:** Card returns to Backlog. Toast disappears immediately.

- [ ] **Step 3: Manual verification — startedAt restoration**

1. Move a card from Backlog to In Progress. Note that the elapsed timer starts.
2. Move it from In Progress to Done.
3. **Expected:** Toast appears.
4. Click **Undo**.
5. **Expected:** Card returns to In Progress and the elapsed timer resumes (startedAt was preserved — the progress bar should reflect the original start time, not restart from zero).

- [ ] **Step 4: Manual verification — toast expiry**

1. Move a card to Done. Wait 10 seconds without clicking Undo.
2. **Expected:** Toast fades away. Card stays in Done. No errors in console.

- [ ] **Step 5: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): intercept moveCard to Done with undo toast"
```

---

### Task 6: Intercept handleWakeNow

**Files:**
- Modify: `app/main.jsx` — `handleWakeNow` function

- [ ] **Step 1: Add snapshot before the setState**

Find `async function handleWakeNow(cardId) {`. The current body is:
```js
  async function handleWakeNow(cardId) {
    const newState = {
      ...state,
      cards: state.cards.map(c => c.id === cardId ? { ...c, scheduledFor: null } : c),
    };
    setState(newState);
    try {
      await FabData.saveNow(newState);
    } catch (e) {
      // saveNow failure is non-fatal — debounced save will retry
    }
  }
```
Replace with:
```js
  async function handleWakeNow(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    pushUndoToast({
      type: 'wake',
      cardId,
      scheduledFor: card.scheduledFor,
      label: t('undo.woke_card', state.lang).replace('{title}', card.title),
    });
    const newState = {
      ...state,
      cards: state.cards.map(c => c.id === cardId ? { ...c, scheduledFor: null } : c),
    };
    setState(newState);
    try {
      await FabData.saveNow(newState);
    } catch (e) {
      // saveNow failure is non-fatal — debounced save will retry
    }
  }
```

The toast appears before `saveNow` fires. If `saveNow` fails, the save-error banner handles the retry; the undo handler is unaffected.

- [ ] **Step 2: Manual verification**

Start `python3 server.py`. Open http://127.0.0.1:5001.
1. Create a card and schedule it to sleep (open modal → set a future wake date → save).
2. Confirm the card moves to the sleeping drawer in Backlog.
3. Click the card to open the modal. Click **Wake now**.
4. **Expected:** Modal closes. Toast appears: `Woke "X"` with an **Undo** button. The card is now in the active Backlog.
5. Click **Undo**.
6. **Expected:** Card returns to the sleeping drawer with its original wake date restored. Toast disappears.
7. Wake the card again, wait 10 s without clicking Undo.
8. **Expected:** Toast disappears. Card stays in active Backlog.

- [ ] **Step 3: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): intercept handleWakeNow with undo toast"
```

---

### Task 7: Wire UndoToast into App JSX + end-to-end verification

**Files:**
- Modify: `app/main.jsx` — JSX return block

- [ ] **Step 1: Add UndoToast after the Board component**

Find this block in the JSX return:
```jsx
        setSelectedCardId={setSelectedCardId}
      />

      {modalCol && (
```
Insert `<UndoToast>` between them:
```jsx
        setSelectedCardId={setSelectedCardId}
      />

      <UndoToast toast={undoToast} onUndo={handleUndo} lang={state.lang} />

      {modalCol && (
```

- [ ] **Step 2: End-to-end — toast replacement**

Start `python3 server.py`. Open http://127.0.0.1:5001.
1. Move card A to Done. While its toast is visible, move card B to Done.
2. **Expected:** Only one toast at a time; the second toast replaces the first immediately with card B's label.
3. Click Undo — card B returns, card A stays in Done.

- [ ] **Step 3: End-to-end — Spanish language**

1. Open Admin → Settings → switch language to **Español**.
2. Wake a sleeping card.
3. **Expected:** Toast reads `Despertada "…"` with button label `Deshacer`.
4. Move a card to Done.
5. **Expected:** Toast reads `"…" movida a Hecho`.

- [ ] **Step 4: End-to-end — layering**

1. Trigger the screensaver (wait for idle or use the Preview button in the TopBar).
2. **Expected:** No toast visible (screensaver z-index 200 is above toast z-index 90).
3. Move a card to Done so a toast is showing. While the toast is up, open any card's edit modal.
4. **Expected:** Modal renders on top of the toast (modal z-index 100 > toast z-index 90).

- [ ] **Step 5: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): wire UndoToast into App JSX"
```
