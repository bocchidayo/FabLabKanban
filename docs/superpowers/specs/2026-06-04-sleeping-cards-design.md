# Sleeping Cards Design

**Date:** 2026-06-04  
**Status:** Approved  
**Scope constraint:** No new files. No changes to `server.py`, `index.html`, or `deploy/`. The feature is purely additive across six existing files.

---

## Problem

The Backlog column mixes cards that are ready to work on today with cards that can't or shouldn't be started for days or weeks. This creates visual noise and inflates the apparent backlog. There is no way to defer a card without deleting it.

## Solution: Sleeping Cards

Cards in the Backlog can be scheduled for a future wake date. Sleeping cards hide in a collapsible drawer at the bottom of the Backlog column. On their wake date, `performDailyReset` surfaces them back into active backlog automatically. The board always looks like four columns; the sleeping pile is acknowledged but tucked away.

---

## Data Model

### New field

```
card.scheduledFor: null | "YYYY-MM-DD"
```

- `null` — card is awake (default for all existing and new cards)
- `"YYYY-MM-DD"` ISO date string — card sleeps until this date (inclusive); wakes on that day

### Schema migration

`migrate()` adds one guard to the cards forEach, matching the pattern of existing fields:

```js
state.cards.forEach(function(c) { if (!('scheduledFor' in c)) c.scheduledFor = null; });
```

No `SCHEMA_VERSION` bump. The null default is safe; old app code would treat sleeping cards as regular backlog cards (harmless degradation).

### New helpers in `data.js`

Two new exported helpers, alongside `isStaleBacklog` / `isOverdue` / `isReadyNudged`:

```js
function isSleeping(card, now) {
  if (!card.scheduledFor) return false;
  return card.scheduledFor > new Date(now || Date.now()).toISOString().slice(0, 10);
}

function fmtWakeDate(scheduledFor, now, lang) {
  // scheduledFor is "YYYY-MM-DD", now is a timestamp
  // Only called on cards where isSleeping(card, now) is true,
  // so scheduledFor is guaranteed to be > today. Never called
  // for a card waking today (scheduledFor === todayStr) because
  // isSleeping returns false for that card and it renders as awake.
  //
  // Behavior:
  //   diff = calendar days between today and scheduledFor (always ≥ 1)
  //   diff ≤ 6  → "in {diff}d"          e.g. "in 3d"
  //   diff > 6  → "{weekday} {mon} {d}"  e.g. "Mon Jun 15"
  // Both forms are passed through the card.sleeping i18n key at the call site.
}
```

`shouldWake` is not added as a named export. The one call site in `performDailyReset` uses the inline predicate `card.scheduledFor && !isSleeping(card, now)` directly — readable without a wrapper.

### `performDailyReset` change

The wake step operates on `activeCards` (cards where `col !== 'done'`), which is produced by the existing done-card split. The exact sequence is:

1. Split done cards → `doneCards` / `activeCards`
2. **Wake sleeping cards in `activeCards`** ← new step
3. Close open attendance sessions
4. Reset all members' check-in state

The new step (2) maps over `activeCards` and clears `scheduledFor` on any card whose wake date has arrived:

```js
activeCards = activeCards.map(function(c) {
  if (c.scheduledFor && !isSleeping(c, now)) {
    return Object.assign({}, c, { scheduledFor: null });
  }
  return c;
});
```

### Guards on existing predicates

Both `isStaleBacklog` and `isReadyNudged` get a one-line guard at the top:

```js
if (isSleeping(card, now)) return false;
```

Sleeping cards never show the stale marker (3-day age warning) or the ready nudge (24-hour nudge), regardless of how long they have been in the system.

---

## Modal UX

### When the schedule section appears

The "Schedule for later" section is shown **only when the card is in the backlog column** (`col === "backlog"` for edits; `defaultCol === "backlog"` for creates). It is never shown for in-progress, ready, or done cards — the option simply doesn't exist, so users cannot accidentally sleep a card mid-flight.

### Creating a card

- An off-by-default toggle: "Schedule for later"
- When toggled on, four tap targets appear: `[1w]` `[2w]` `[1mo]` `[Custom]`
- Custom reveals a minimal number input with label "in ___ weeks" (integer ≥ 1)
  - Note for implementation: `field.schedule_in_x_weeks` may double as both the confirmation line and the custom input label — verify during implementation; add a separate key if the rendering differs
- Selecting an offset shows a confirmation line: "Wakes Mon Jun 15" (date math done visibly)
- Selected offset is a **single piece of state** — selecting a preset discards any custom value and vice versa; two values cannot be active simultaneously
- **Toggling off then on again resets the selected offset to no selection** — the previous choice does not linger; the user must pick again
- On submit: `scheduledFor` is computed from today + offset at submit time

### Editing an awake backlog card

- Toggle starts off (card has no `scheduledFor`)
- Toggling on allows scheduling, same offset buttons

### Editing a sleeping card

- Toggle starts on, showing current wake date: "Wakes Mon Jun 15"
- Offset buttons act as reschedule (replace the date)
- **"Wake now" button** saves immediately via `saveNow` and closes the modal — it is **not** wired to the normal submit handler. The user's intent is unambiguous; a separate Save tap would be bureaucratic.

---

## Board & Column Rendering

### Card split

The Column component splits backlog cards at render time:

```js
const awakeCards    = col.id === 'backlog' ? cards.filter(c => !isSleeping(c, now)) : cards;
const sleepingCards = col.id === 'backlog' ? cards.filter(c =>  isSleeping(c, now)) : [];
```

Non-backlog columns are unaffected.

### SleepingDrawer component

New component, rendered at the bottom of the backlog column when `sleepingCards.length > 0`:

- **Collapsed** (default): subtle tappable strip — "↓ 3 scheduled for later"
- **Expanded**: shows sleeping cards using the existing `Card` component with a `sleeping` CSS class; a "↑ hide" tap target collapses it

**Collapse behavior:** A `useEffect` watching `sleepingCards.length` collapses the drawer **only when the count transitions from 0 to non-zero** (a new sleeping card has appeared). If the count decreases while expanded (e.g., a card is woken from inside the drawer), the drawer stays open — collapsing mid-interaction is jarring.

### Sleeping card rendering

Inside the Card component, sleeping cards:

- Show a wake label in place of the stale marker: `<Icon name="moon" /> Wakes {fmtWakeDate(...)}`
- Have the `sleeping` CSS class applied (muted opacity, no hover lift)
- Have `draggable={false}` — the `draggable` prop is gated by `!isSleeping(card, now)` at the component level, not just visually. This prevents accidental drag of sleeping cards into other columns, bypassing the wake flow.
- Do not show the claim-start button

### FilterTabs

Machine-type counts exclude sleeping cards:

```js
cards.filter(c => !isSleeping(c, now))  // before the count reduce
```

### Screensaver

All stat counts (task totals, machine usage, etc.) exclude sleeping cards via the same `isSleeping` filter.

---

## i18n Keys

Eleven new key pairs added to `app/i18n.js`:

| Key | en | es |
|---|---|---|
| `backlog.sleeping_drawer` | `↓ {n} scheduled for later` | `↓ {n} programadas para después` |
| `backlog.sleeping_drawer_hide` | `↑ hide` | `↑ ocultar` |
| `field.schedule_later` | `Schedule for later` | `Programar para después` |
| `field.schedule_1w` | `1 week` | `1 semana` |
| `field.schedule_2w` | `2 weeks` | `2 semanas` |
| `field.schedule_1mo` | `1 month` | `1 mes` |
| `field.schedule_custom` | `Custom` | `Personalizado` |
| `field.schedule_in_x_weeks` | `in {n} weeks` | `en {n} semanas` |
| `field.schedule_wakes` | `Wakes {date}` | `Se despierta el {date}` |
| `field.wake_now` | `Wake now` | `Despertar ahora` |
| `card.sleeping` | `Wakes {date}` | `Se despierta el {date}` |

Note: `card.sleeping` and `field.schedule_wakes` are intentionally separate keys despite matching strings today — they serve different contexts (card label vs. modal confirmation line) and may diverge.

---

## Files Touched

| File | Change |
|---|---|
| `app/data.js` | `isSleeping`, `fmtWakeDate` helpers; `migrate()` guard; `performDailyReset` wake step; `isStaleBacklog`/`isReadyNudged` guards; export new helpers |
| `app/i18n.js` | 11 new key pairs |
| `app/modal.jsx` | Schedule section: toggle, offset buttons, custom input, wake-now button |
| `app/board.jsx` | Column card split; `SleepingDrawer` component; sleeping card label + draggable gate; filter count guard |
| `app/screensaver.jsx` | `isSleeping` filter on stat counts |
| `app/styles.css` | `.sleeping-drawer`, `.card.sleeping` styles |

**No new files. No changes to `server.py`, `index.html`, or `deploy/`.**
