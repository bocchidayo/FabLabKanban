# Sleeping Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "schedule for later" feature to the Backlog column — cards can be deferred to a future date, sleep in a collapsible drawer, and wake automatically at midnight via the existing daily reset.

**Architecture:** One new nullable field (`scheduledFor: null | "YYYY-MM-DD"`) on cards. Two new pure helpers in `data.js` (`isSleeping`, `fmtWakeDate`). The Column component splits backlog cards into awake/sleeping at render time; sleeping cards live in a `SleepingDrawer` sub-component. The modal gains a "Schedule for later" toggle section and a "Wake now" button. `performDailyReset` clears expired `scheduledFor` values between the done-card split and the attendance close steps.

**Tech Stack:** React 18 UMD + Babel Standalone (no build step). Plain JS/JSX files loaded as `<script>` tags. All globals shared via `window` (e.g. `window.FabData`, `window.I18n`). Python stdlib sidecar (`server.py`) is not changed. Run dev server with `python3 server.py` (serves app + API on port 5001). Run server-side tests with `python3 -m unittest discover -t . -s tests -v`.

---

## File Map

| File | What changes |
|---|---|
| `app/data.js` | `isSleeping` + `fmtWakeDate` helpers; `migrate()` guard; `performDailyReset` wake step; `isStaleBacklog`/`isReadyNudged` guards; exports |
| `app/i18n.js` | 11 new bilingual key pairs |
| `app/styles.css` | `.card.sleeping` + `.sleeping-drawer` + `.schedule-section` styles |
| `app/board.jsx` | `FilterTabs` count exclusion; `Card` sleeping rendering + draggable gate; `Column` card split; new `SleepingDrawer` component |
| `app/screensaver.jsx` | Exclude sleeping cards from all stat counts |
| `app/modal.jsx` | Schedule section (toggle + offset buttons + custom input); "Wake now" button; `scheduledFor` in submit |
| `app/main.jsx` | Wire `onWakeNow` handler to modal |

---

### Task 1: data.js — `isSleeping` + `fmtWakeDate` helpers

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Write a Node verification script**

Create `tests/verify_sleeping_helpers.js`:

```js
// Stub browser globals required by data.js
global.window = {
  addEventListener: function() {},
  removeEventListener: function() {},
  dispatchEvent: function() {},
};
global.CustomEvent = function(name) { this.type = name; };
global.navigator = { sendBeacon: function() {} };
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return {}; } };
};

require('./app/data.js');

const { isSleeping, fmtWakeDate } = global.window.FabData;

// isSleeping — null scheduledFor is always awake
console.assert(!isSleeping({ scheduledFor: null },         1000), 'null → awake');
// isSleeping — today's date means the card is WAKING today (not sleeping)
const jun4 = new Date('2026-06-04T10:00:00').getTime();
console.assert(!isSleeping({ scheduledFor: '2026-06-04' }, jun4),  'today → awake');
console.assert(!isSleeping({ scheduledFor: '2026-06-03' }, jun4),  'past → awake');
console.assert( isSleeping({ scheduledFor: '2026-06-05' }, jun4),  'tomorrow → sleeping');
console.assert( isSleeping({ scheduledFor: '2026-07-04' }, jun4),  'month out → sleeping');

// fmtWakeDate — ≤6 days uses "in Nd" form
const jun5 = new Date('2026-06-05T10:00:00').getTime();
const r1 = fmtWakeDate('2026-06-08', jun5, 'en'); // 3 days out
console.assert(r1 === 'in 3d', 'short form: ' + r1);
// fmtWakeDate — >6 days uses weekday+date form
const r2 = fmtWakeDate('2026-06-15', jun5, 'en'); // 10 days out
console.assert(r2.includes('Jun') || r2.includes('jun'), 'long form contains month: ' + r2);
// fmtWakeDate — exactly 6 days uses short form
const r3 = fmtWakeDate('2026-06-11', jun5, 'en'); // 6 days out
console.assert(r3 === 'in 6d', '6d boundary: ' + r3);
// fmtWakeDate — 7 days uses long form
const r4 = fmtWakeDate('2026-06-12', jun5, 'en'); // 7 days out
console.assert(!r4.startsWith('in '), '7d → long form: ' + r4);

console.log('All sleeping helper assertions passed');
```

- [ ] **Step 2: Run script to confirm it fails** (functions not yet defined)

```bash
node tests/verify_sleeping_helpers.js
```
Expected: error — `isSleeping is not a function` or `Cannot destructure property 'isSleeping'`

- [ ] **Step 3: Add `isSleeping` and `fmtWakeDate` to `app/data.js`**

Insert after the closing brace of `isReadyNudged` (just before the `// ---- daily reset` comment):

```js
  function isSleeping(card, now) {
    if (!card.scheduledFor) return false;
    var d = new Date(now || Date.now());
    var today = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return card.scheduledFor > today;
  }

  function fmtWakeDate(scheduledFor, now, lang) {
    var d = new Date(now || Date.now());
    var todayKey = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    var todayMs = new Date(todayKey + 'T00:00:00').getTime();
    var wakeMs  = new Date(scheduledFor + 'T00:00:00').getTime();
    var diff    = Math.round((wakeMs - todayMs) / 86400000);
    if (diff <= 6) return 'in ' + diff + 'd';
    var wake   = new Date(scheduledFor + 'T12:00:00');
    var locale = lang === 'es' ? 'es-ES' : 'en-US';
    return wake.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  }
```

- [ ] **Step 4: Export both helpers in `window.FabData`**

In the `window.FabData = { ... }` block, add after the `getTodayDone` line:

```js
    isSleeping: isSleeping,
    fmtWakeDate: fmtWakeDate,
```

- [ ] **Step 5: Run script to confirm it passes**

```bash
node tests/verify_sleeping_helpers.js
```
Expected: `All sleeping helper assertions passed`

- [ ] **Step 6: Commit**

```bash
git add app/data.js tests/verify_sleeping_helpers.js
git commit -m "feat(data): add isSleeping + fmtWakeDate helpers"
```

---

### Task 2: data.js — `migrate()` guard, predicate guards, `performDailyReset` wake step

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Add `scheduledFor` guard to `migrate()`**

In `migrate()`, after the existing cards forEach loop that adds `assistants` (the line reading `(state.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });`), add:

```js
    (state.cards || []).forEach(function (c) { if (!('scheduledFor' in c)) c.scheduledFor = null; });
```

Also add the same guard for archived cards (inside the archived-day loop, after `if (!c.assistants) c.assistants = [];`):

```js
      (day.cards || []).forEach(function (c) { if (!('scheduledFor' in c)) c.scheduledFor = null; });
```

- [ ] **Step 2: Add `isSleeping` guard to `isStaleBacklog`**

Change `isStaleBacklog` from:

```js
  function isStaleBacklog(card, now) {
    if (card.col !== "backlog") return false;
    return (now - card.createdAt) > 3 * 24 * 60 * 60 * 1000;
  }
```

To:

```js
  function isStaleBacklog(card, now) {
    if (card.col !== "backlog") return false;
    if (isSleeping(card, now)) return false;
    return (now - card.createdAt) > 3 * 24 * 60 * 60 * 1000;
  }
```

- [ ] **Step 3: Add `isSleeping` guard to `isReadyNudged`**

Change `isReadyNudged` from:

```js
  function isReadyNudged(card, now) {
    if (card.col !== "ready") return false;
    return (now - card.createdAt) > 24 * 60 * 60 * 1000;
  }
```

To:

```js
  function isReadyNudged(card, now) {
    if (card.col !== "ready") return false;
    if (isSleeping(card, now)) return false;
    return (now - card.createdAt) > 24 * 60 * 60 * 1000;
  }
```

- [ ] **Step 4: Add wake step to `performDailyReset`**

In `performDailyReset`, after the two filter lines that produce `doneCards` and `activeCards` (and before the `if (doneCards.length > 0)` block), insert:

```js
    // 1b. Wake sleeping cards whose scheduledFor date has arrived
    activeCards = activeCards.map(function (c) {
      if (c.scheduledFor && !isSleeping(c, now)) {
        return Object.assign({}, c, { scheduledFor: null });
      }
      return c;
    });
```

The full sequence in the function now reads:
1. Split done/active
2. Wake sleeping (new)
3. Archive done cards
4. Close attendance sessions
5. Reset member check-in state

- [ ] **Step 5: Extend the Node verification script to cover the new behaviour**

Append to `tests/verify_sleeping_helpers.js`:

```js
// migrate() — adds scheduledFor: null to cards missing the field
const { migrate } = global.window.FabData;
const stateOld = {
  schemaVersion: 1,
  cards: [{ id: 'c1', col: 'backlog', title: 'X', estMin: 60, assistants: [] }],
  archived: [],
  members: [],
};
const migrated = migrate(stateOld);
console.assert(migrated.cards[0].scheduledFor === null, 'migrate adds scheduledFor: null');

// isStaleBacklog — sleeping card is never stale
const { isStaleBacklog } = global.window.FabData;
const staleNow = new Date('2026-06-04T10:00:00').getTime();
const oldSleepingCard = {
  col: 'backlog',
  scheduledFor: '2026-06-10',
  createdAt: staleNow - 5 * 24 * 60 * 60 * 1000, // 5 days old
};
console.assert(!isStaleBacklog(oldSleepingCard, staleNow), 'sleeping card not stale');

// performDailyReset — wakes cards whose date has arrived
const { performDailyReset } = global.window.FabData;
const resetNow = new Date('2026-06-05T00:05:00').getTime(); // just after midnight Jun 5
const resetState = {
  lastReset: '2026-06-04',
  cards: [
    { id: 'a', col: 'backlog', scheduledFor: '2026-06-05', title: 'Wake me', createdAt: resetNow - 1000, estMin: 60, assistants: [] },
    { id: 'b', col: 'backlog', scheduledFor: '2026-06-10', title: 'Still sleeping', createdAt: resetNow - 1000, estMin: 60, assistants: [] },
    { id: 'c', col: 'backlog', scheduledFor: null,         title: 'Already awake', createdAt: resetNow - 1000, estMin: 60, assistants: [] },
  ],
  completedTasks: [],
  attendance: [],
  members: [],
};
const afterReset = performDailyReset(resetState, resetNow);
const woken   = afterReset.cards.find(c => c.id === 'a');
const asleep  = afterReset.cards.find(c => c.id === 'b');
const awake   = afterReset.cards.find(c => c.id === 'c');
console.assert(woken.scheduledFor === null,        'card woken at midnight');
console.assert(asleep.scheduledFor === '2026-06-10', 'future card still sleeping');
console.assert(awake.scheduledFor === null,          'awake card unchanged');

console.log('All data.js assertions passed');
```

- [ ] **Step 6: Run verification**

```bash
node tests/verify_sleeping_helpers.js
```
Expected: `All sleeping helper assertions passed` then `All data.js assertions passed`

- [ ] **Step 7: Commit**

```bash
git add app/data.js tests/verify_sleeping_helpers.js
git commit -m "feat(data): scheduledFor migrate guard, wake step, predicate guards"
```

---

### Task 3: i18n.js — 11 new translation keys

**Files:**
- Modify: `app/i18n.js`

- [ ] **Step 1: Add keys before the closing `};` of the `TX` object**

Find the last key in `TX` (currently `"admin.reload_desc"`). Insert before the closing `};` of the TX object:

```js
    // ---- sleeping cards -------------------------------------------------
    "backlog.sleeping_drawer":      { en: "↓ {n} scheduled for later",  es: "↓ {n} programadas para después" },
    "backlog.sleeping_drawer_hide": { en: "↑ hide",                      es: "↑ ocultar" },
    "field.schedule_later":         { en: "Schedule for later",          es: "Programar para después" },
    "field.schedule_1w":            { en: "1 week",                      es: "1 semana" },
    "field.schedule_2w":            { en: "2 weeks",                     es: "2 semanas" },
    "field.schedule_1mo":           { en: "1 month",                     es: "1 mes" },
    "field.schedule_custom":        { en: "Custom",                      es: "Personalizado" },
    "field.schedule_in_x_weeks":    { en: "in {n} weeks",                es: "en {n} semanas" },
    "field.schedule_wakes":         { en: "Wakes {date}",                es: "Se despierta el {date}" },
    "field.wake_now":               { en: "Wake now",                    es: "Despertar ahora" },
    "card.sleeping":                { en: "Wakes {date}",                es: "Se despierta el {date}" },
```

- [ ] **Step 2: Verify in browser**

Run `python3 server.py`, open `http://127.0.0.1:5001`, open the browser console and run:

```js
window.I18n.t('backlog.sleeping_drawer', 'en').replace('{n}', 3)
// Expected: "↓ 3 scheduled for later"
window.I18n.t('field.wake_now', 'es')
// Expected: "Despertar ahora"
window.I18n.t('card.sleeping', 'en').replace('{date}', 'Mon Jun 15')
// Expected: "Wakes Mon Jun 15"
```

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat(i18n): add sleeping cards translation keys"
```

---

### Task 4: styles.css — sleeping card + drawer styles

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Add sleeping card styles**

After the `.card.ready-nudge { ... }` block (around line 389), add:

```css
/* ---- sleeping cards ---- */
.card.sleeping {
  opacity: 0.55;
  border-style: dashed;
}
.card.sleeping:hover { border-color: var(--border-strong); opacity: 0.75; }
.sleeping-marker {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-3);
}
.sleeping-marker .i { font-size: 13px; }
```

- [ ] **Step 2: Add sleeping drawer styles**

After the `.sleeping-marker` block, add:

```css
.sleeping-drawer {
  margin-top: 4px;
  border-top: 1px solid var(--border);
  padding-top: 6px;
}
.sleeping-drawer-toggle {
  width: 100%;
  background: none; border: none; cursor: pointer;
  padding: 6px 4px;
  font-size: 12px; font-weight: 600; color: var(--text-3);
  text-align: left;
  display: flex; align-items: center; gap: 6px;
  border-radius: 6px;
}
.sleeping-drawer-toggle:hover { color: var(--text-2); background: var(--column); }
.sleeping-drawer-cards {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 6px;
}
```

- [ ] **Step 3: Add schedule section styles (used in modal)**

After the `.sleeping-drawer-cards` block, add:

```css
.schedule-section {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px;
  background: var(--column); border-radius: 8px;
}
.schedule-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
}
.schedule-toggle-label {
  font-size: 14px; font-weight: 600; color: var(--text-1);
}
.schedule-offsets {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.schedule-offset-btn {
  padding: 6px 14px;
  border: 1.5px solid var(--border);
  border-radius: 6px; background: var(--bg);
  font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text-2);
}
.schedule-offset-btn.active {
  border-color: var(--accent); color: var(--accent); background: var(--accent-soft);
}
.schedule-custom-row {
  display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2);
}
.schedule-custom-row .input { width: 64px; }
.schedule-wakes-label {
  font-size: 13px; font-weight: 600; color: var(--text-2);
}
.wake-now-btn {
  padding: 8px 16px;
  background: var(--column); border: 1.5px solid var(--border);
  border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;
  color: var(--text-1);
  width: 100%;
}
.wake-now-btn:hover { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 4: Commit**

```bash
git add app/styles.css
git commit -m "feat(styles): sleeping card, drawer, and schedule section styles"
```

---

### Task 5: board.jsx — `FilterTabs` exclusion + `Card` sleeping rendering

**Files:**
- Modify: `app/board.jsx`

- [ ] **Step 1: Exclude sleeping cards from `FilterTabs` counts**

In `FilterTabs`, the `counts` memo currently starts with `const c = { all: (cards || []).length }` and iterates over all cards. Change the memo to filter sleeping cards first:

```jsx
const counts = React.useMemo(() => {
  const awake = (cards || []).filter(c => !isSleeping(c, Date.now()));
  const c = { all: awake.length };
  MACHINE_ORDER.forEach((id) => { c[id] = 0; });
  awake.forEach((card) => {
    if (card.machine && c[card.machine] !== undefined) {
      c[card.machine] += 1;
    }
  });
  return c;
}, [cards]);
```

Note: `FilterTabs` receives all cards from Board (not yet split), so it needs its own `isSleeping` call. `isSleeping` is available as `window.FabData.isSleeping` — confirm it is destructured at the top of `board.jsx` alongside the other FabData helpers. The top of `board.jsx` should have something like:

```js
const { isOverdue, overdueMins, isStaleBacklog, isReadyNudged,
        progressOf, fmtDuration, fmtAgo, MACHINES, MACHINE_ORDER,
        isSleeping, fmtWakeDate } = window.FabData;
```

Add `isSleeping` and `fmtWakeDate` to this destructure if not already there.

- [ ] **Step 2: Add sleeping detection to `Card` component**

In the `Card` function, after the existing computed state lines (`const overdue = ...`, `const staleBacklog = ...`, etc.), add:

```js
  const sleeping = isSleeping && isSleeping(card, now);
```

- [ ] **Step 3: Add `sleeping` CSS class to `Card`**

In the class list block, after `if (staleBacklog) classes.push('stale');`, add:

```js
  if (sleeping) classes.push('sleeping');
```

- [ ] **Step 4: Gate `draggable` on `!sleeping`**

Find the `dragProps` object inside `Card` (the block that sets `draggable`, `onDragStart`, `onDragEnd`). It currently looks like:

```js
  const dragProps = dnd ? {
    draggable: true,
    onDragStart: (e) => { ... },
    onDragEnd: (e) => { ... },
  } : {};
```

Change `draggable: true` to `draggable: !sleeping`:

```js
  const dragProps = dnd ? {
    draggable: !sleeping,
    onDragStart: (e) => { ... },
    onDragEnd: (e) => { ... },
  } : {};
```

- [ ] **Step 5: Add sleeping wake label in card body**

In the card JSX, the stale marker renders as:

```jsx
{staleBacklog && (
  <div className="stale-marker">
    <Icon name="clock-pause" /> {t('card.stale', lang)}
  </div>
)}
```

Replace it with (sleeping takes priority over stale; they are mutually exclusive because `isStaleBacklog` now guards on `isSleeping`):

```jsx
{sleeping && (
  <div className="sleeping-marker">
    <Icon name="moon" />{' '}
    {t('card.sleeping', lang).replace('{date}', fmtWakeDate ? fmtWakeDate(card.scheduledFor, now, lang) : card.scheduledFor)}
  </div>
)}
{staleBacklog && (
  <div className="stale-marker">
    <Icon name="clock-pause" /> {t('card.stale', lang)}
  </div>
)}
```

- [ ] **Step 6: Verify in browser**

Start the server (`python3 server.py`). Open the app, open the browser console, and manually inject a sleeping card:

```js
const s = window.__APP_STATE__;
// (or access state via React DevTools / the app's setState debug)
```

Instead, temporarily set a card's `scheduledFor` in the server's `data.json` to tomorrow's date. Reload the app. Confirm:
- The card appears with reduced opacity and dashed border
- The card shows the sleeping wake label (no stale marker)
- The filter tab counts do not include the sleeping card

- [ ] **Step 7: Commit**

```bash
git add app/board.jsx
git commit -m "feat(board): FilterTabs sleeping exclusion + Card sleeping rendering"
```

---

### Task 6: board.jsx — `Column` card split + `SleepingDrawer` component

**Files:**
- Modify: `app/board.jsx`

- [ ] **Step 1: Add `SleepingDrawer` component above `Column`**

Insert before the `// Column —` comment block:

```jsx
// ---------------------------------------------------------------------------
// SleepingDrawer — collapsible footer strip for sleeping backlog cards
// ---------------------------------------------------------------------------
function SleepingDrawer({ cards, memberMap, now, lang, selectedCardId, onCardClick }) {
  const [open, setOpen] = React.useState(false);
  const prevLen = React.useRef(0);

  React.useEffect(function () {
    if (prevLen.current === 0 && cards.length > 0) {
      setOpen(false); // new sleeping card appeared — collapse to signal it
    }
    prevLen.current = cards.length;
  }, [cards.length]);

  if (cards.length === 0) return null;

  const label = t('backlog.sleeping_drawer', lang).replace('{n}', cards.length);
  const hideLabel = t('backlog.sleeping_drawer_hide', lang);

  return (
    <div className="sleeping-drawer">
      <button
        className="sleeping-drawer-toggle"
        onClick={() => setOpen(function(v) { return !v; })}
      >
        {open ? hideLabel : label}
      </button>
      {open && (
        <div className="sleeping-drawer-cards">
          {cards.map(function(card) {
            return (
              <Card
                key={card.id}
                card={card}
                member={memberMap[card.owner]}
                assistantMembers={(card.assistants || []).map(function(id) { return memberMap[id]; }).filter(Boolean)}
                now={now}
                lang={lang}
                isSelected={selectedCardId === card.id}
                onClick={onCardClick}
                onClaimStart={null}
                dnd={null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Split cards inside `Column` and update header count**

In the `Column` function, after the `const [dragOver, setDragOver] = React.useState(false);` lines and before `return (`, add:

```js
  const isBL = col.id === 'backlog';
  const awakeCards    = isBL ? (cards || []).filter(function(c) { return !isSleeping(c, now); }) : (cards || []);
  const sleepingCards = isBL ? (cards || []).filter(function(c) {  return  isSleeping(c, now); }) : [];
```

- [ ] **Step 3: Update Column JSX to use `awakeCards` and render `SleepingDrawer`**

In the Column JSX, make three changes:

**Change 1** — Update the header count from `(cards || []).length` to `awakeCards.length`:

```jsx
<span className="ct">{awakeCards.length}</span>
```

**Change 2** — Update the empty-state check and card list from `(cards || [])` to `awakeCards`:

```jsx
{awakeCards.length === 0 && sleepingCards.length === 0 && (
  <div className="col-empty">{t('col.empty', lang)}</div>
)}
{awakeCards.map((card) => (
  <React.Fragment key={card.id}>
    {dnd && dnd.draggingId && dnd.draggingId !== card.id && (
      <div className="drop-line" data-card-id={card.id} />
    )}
    <Card
      card={card}
      member={memberMap[card.owner]}
      assistantMembers={(card.assistants || []).map(function(id) { return memberMap[id]; }).filter(Boolean)}
      now={now}
      lang={lang}
      isSelected={selectedCardId === card.id}
      onClick={onCardClick}
      onClaimStart={onClaimStart}
      dnd={dnd}
    />
  </React.Fragment>
))}
```

**Change 3** — Add `SleepingDrawer` after the card list, inside `column-body`, before the closing `</div>` of `column-body`:

```jsx
{isBL && (
  <SleepingDrawer
    cards={sleepingCards}
    memberMap={memberMap}
    now={now}
    lang={lang}
    selectedCardId={selectedCardId}
    onCardClick={onCardClick}
  />
)}
```

- [ ] **Step 4: Verify in browser**

With a sleeping card in `data.json`:
- Backlog column header shows awake-card count only
- A "↓ 1 scheduled for later" strip appears at the bottom of the Backlog column
- Tapping the strip expands to show the sleeping card
- Tapping "↑ hide" collapses it
- Waking a sleeping card via the edit modal (next task) should keep the drawer open (count decreases, not going 0→N)

- [ ] **Step 5: Commit**

```bash
git add app/board.jsx
git commit -m "feat(board): SleepingDrawer component + Column awake/sleeping split"
```

---

### Task 7: screensaver.jsx — exclude sleeping cards from stats

**Files:**
- Modify: `app/screensaver.jsx`

- [ ] **Step 1: Confirm which stats use `state.cards`**

In `screensaver.jsx`, the relevant useMemo hooks are:

```js
const activeJobs = React.useMemo(
  () => (state.cards || []).filter((c) => c.col === 'inprogress'),
  [state.cards],
);
```

There may also be references to backlog count if any. Check the file — the stats rendered are: in-progress count (`activeJobs.length`), checked-in members, free members, and today's done count. Sleeping cards live in `col: 'backlog'`, so only the `activeJobs` filter (which already gates on `col === 'inprogress'`) is unaffected. However, any stat that counts all cards or all backlog cards needs the guard.

- [ ] **Step 2: Add `isSleeping` to screensaver's FabData destructure**

At the top of `screensaver.jsx`, find the destructure of `window.FabData` (look for `getTodayDone`, `fmtDuration`, etc.) and add `isSleeping`:

```js
const { getTodayDone, fmtDuration, fmtAgo, isSleeping } = window.FabData;
```

- [ ] **Step 3: Confirm no stat counts include backlog cards**

The screensaver's four stats are:
- `activeJobs` — already gates on `col === 'inprogress'`; sleeping backlog cards excluded
- `checkedIn` / `freeMembers` — member-based, no card filter
- `todayDone` — uses `getTodayDone` which gates on `col === 'done'`

Run this to confirm there is no filter that touches backlog cards:

```bash
grep -n "state\.cards" app/screensaver.jsx
```

If all filters gate on `col === 'inprogress'` or `col === 'done'`, no code change is needed — the step is a verification. If any filter touches all cards (no `col` gate), add `&& !isSleeping(c, now)` to it and ensure `isSleeping` is imported.

- [ ] **Step 4: Verify in browser**

Put a card in sleeping state via `data.json`. Open the screensaver (idle for 60s or use the preview button). Confirm sleeping cards do not inflate any stat number.

- [ ] **Step 5: Commit**

```bash
git add app/screensaver.jsx
git commit -m "feat(screensaver): exclude sleeping cards from stat counts"
```

---

### Task 8: modal.jsx — schedule section + wake-now state

**Files:**
- Modify: `app/modal.jsx`

- [ ] **Step 1: Add schedule form state**

In the `TaskModal` function, after the existing `useState` declarations (after `var _showDelete`), add:

```js
    var _scheduleOn     = useState(isEdit && editingCard && !!editingCard.scheduledFor);
    var _scheduleOffset = useState(null); // '1w' | '2w' | '1mo' | 'custom' | null
    var _customWeeks    = useState(1);

    var scheduleOn     = _scheduleOn[0];     var setScheduleOn     = _scheduleOn[1];
    var scheduleOffset = _scheduleOffset[0]; var setScheduleOffset = _scheduleOffset[1];
    var customWeeks    = _customWeeks[0];    var setCustomWeeks    = _customWeeks[1];
```

Note: when editing a sleeping card, `scheduleOn` starts `true` and the confirmation line should show the existing date. The offset buttons act as "reschedule" — user picks a new offset or saves with the current date.

When editing a sleeping card, also initialize the displayed wake date from the existing `scheduledFor`. Add a derived value:

```js
    var existingWakeDate = isEdit && editingCard ? (editingCard.scheduledFor || null) : null;
```

- [ ] **Step 2: Add `computeScheduledFor` helper inside the component**

After the `existingWakeDate` line, add:

```js
    function computeScheduledFor(offset, weeks) {
      var d = new Date();
      if (offset === '1w')     d.setDate(d.getDate() + 7);
      else if (offset === '2w')  d.setDate(d.getDate() + 14);
      else if (offset === '1mo') d.setMonth(d.getMonth() + 1);
      else if (offset === 'custom') d.setDate(d.getDate() + (weeks || 1) * 7);
      else return null;
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    }

    var previewDate = scheduleOn
      ? (scheduleOffset ? computeScheduledFor(scheduleOffset, customWeeks) : existingWakeDate)
      : null;
```

- [ ] **Step 3: Update `handleSubmit` to include `scheduledFor`**

In `handleSubmit`, add `scheduledFor` to the `fields` object:

```js
      var fields = {
        owner: owner,
        assistants: assistants,
        title: title.trim(),
        desc: desc.trim(),
        machine: machine,
        priority: priority,
        estMin: displayToMinutes(estMin, unit) || 120,
        scheduledFor: scheduleOn ? (previewDate || existingWakeDate) : null,
      };
```

- [ ] **Step 4: Add `onWakeNow` to the modal's props destructure**

Change the function signature from:

```js
  function TaskModal({ state, isEdit, editingCard, defaultCol, onClose, onSave, onCreate, onDelete, onReassign }) {
```

To:

```js
  function TaskModal({ state, isEdit, editingCard, defaultCol, onClose, onSave, onCreate, onDelete, onReassign, onWakeNow }) {
```

- [ ] **Step 5: Render the schedule section**

The schedule section appears only when `col === 'backlog'` (for edits) or `defaultCol === 'backlog'` or no defaultCol (creates default to backlog). Add this derived flag after `var colLabel`:

```js
    var isBacklogCard = isEdit
      ? (editingCard && editingCard.col === 'backlog')
      : (!defaultCol || defaultCol === 'backlog');
```

At the bottom of the modal body (after the duration field, before the footer), add:

```js
isBacklogCard ? React.createElement("div", { className: "schedule-section" },

  // Toggle row
  React.createElement("div", { className: "schedule-toggle-row" },
    React.createElement("span", { className: "schedule-toggle-label" },
      t('field.schedule_later', lang)
    ),
    React.createElement("input", {
      type: "checkbox",
      checked: scheduleOn,
      onChange: function(e) {
        setScheduleOn(e.target.checked);
        if (!e.target.checked) setScheduleOffset(null); // reset selection on toggle-off
      },
    }),
  ),

  // Wake now button — only for sleeping cards being edited
  isEdit && editingCard && editingCard.scheduledFor && scheduleOn
    ? React.createElement("button", {
        className: "wake-now-btn",
        type: "button",
        onClick: function() {
          onWakeNow && onWakeNow(editingCard.id);
          onClose();
        },
      },
        t('field.wake_now', lang)
      )
    : null,

  // Offset buttons — only visible when toggle is on
  scheduleOn ? React.createElement("div", { className: "schedule-offsets" },
    ['1w', '2w', '1mo', 'custom'].map(function(opt) {
      var label = t('field.schedule_' + opt, lang);
      return React.createElement("button", {
        key: opt,
        type: "button",
        className: "schedule-offset-btn" + (scheduleOffset === opt ? " active" : ""),
        onClick: function() { setScheduleOffset(opt); setCustomWeeks(1); },
      }, label);
    })
  ) : null,

  // Custom weeks input — only when 'custom' is selected
  scheduleOn && scheduleOffset === 'custom'
    ? React.createElement("div", { className: "schedule-custom-row" },
        t('field.schedule_in_x_weeks', lang).replace('{n}', ''),
        React.createElement("input", {
          className: "input",
          type: "number",
          min: 1,
          value: customWeeks,
          onChange: function(e) { setCustomWeeks(Math.max(1, parseInt(e.target.value) || 1)); },
        }),
        React.createElement("span", null, customWeeks === 1 ? t('field.schedule_1w', lang) : customWeeks + ' ' + t('field.schedule_2w', lang))
      )
    : null,

  // Wake preview label
  scheduleOn && previewDate
    ? React.createElement("div", { className: "schedule-wakes-label" },
        t('field.schedule_wakes', lang).replace('{date}', previewDate)
      )
    : null,

) : null
```

- [ ] **Step 6: Verify in browser**

Open the app. Open the "create task" modal (default column = backlog):
- Confirm "Schedule for later" section appears at bottom
- Toggle it on → offset buttons appear
- Select "1w" → preview label shows "Wakes YYYY-MM-DD"
- Select "Custom" → number input appears
- Toggle off → buttons disappear; toggling on again shows no offset selected (clean state)
- Submit → card is created with `scheduledFor` set; it appears in the sleeping drawer

Edit a sleeping card:
- Modal opens with toggle on, showing existing wake date
- "Wake now" button is visible — tapping it wakes the card immediately and closes modal
- Offset buttons allow rescheduling

- [ ] **Step 7: Commit**

```bash
git add app/modal.jsx
git commit -m "feat(modal): schedule section, wake-now button, scheduledFor in submit"
```

---

### Task 9: main.jsx — wire `onWakeNow` handler

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Add `handleWakeNow` to the App component**

In `app/main.jsx`, find where `onSave` is defined (the handler that updates a card in state). After it, add:

```js
    async function handleWakeNow(cardId) {
      const newState = {
        ...state,
        cards: state.cards.map(function(c) {
          return c.id === cardId ? Object.assign({}, c, { scheduledFor: null }) : c;
        }),
      };
      setState(newState);
      try {
        await FabData.saveNow(newState);
      } catch (e) {
        // saveNow failing is non-fatal here; debounced save will retry
      }
    }
```

- [ ] **Step 2: Pass `onWakeNow` to `TaskModal`**

Find the `TaskModal` element in the JSX and add the `onWakeNow` prop:

```jsx
<TaskModal
  ...existing props...
  onWakeNow={handleWakeNow}
/>
```

- [ ] **Step 3: Verify end-to-end**

Create a card, schedule it for 1 week. Confirm it appears in the sleeping drawer. Open it via the drawer, click "Wake now". Confirm:
- Modal closes immediately
- Card appears in the active backlog (no longer in drawer)
- Refreshing the page confirms the wake persisted (server saved it)

- [ ] **Step 4: Run server tests to confirm no regressions**

```bash
python3 -m unittest discover -t . -s tests -v
```
Expected: all existing tests pass.

- [ ] **Step 5: Final browser smoke test**

Cover the golden path:
1. Create a backlog card → schedule 1w → confirm sleeping drawer shows it
2. Edit sleeping card → reschedule to 2w → confirm updated date
3. Edit sleeping card → Wake now → confirm card is active
4. Create a card with no schedule → confirm no sleeping behavior
5. Verify filter tabs exclude sleeping card counts
6. Open screensaver preview → verify sleeping card not counted in stats

- [ ] **Step 6: Commit**

```bash
git add app/main.jsx
git commit -m "feat(main): wire onWakeNow handler for immediate sleeping-card wake"
```
