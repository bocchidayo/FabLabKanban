# Design: Multiple Owners (Assistants) on Tasks

**Date:** 2026-05-30
**Branch:** feat/multiple-owners

---

## Overview

Tasks can have one required **primary owner** and an optional list of **assistants**. Both the owner and assistants count as "busy" when the task is In Progress. Assistants are displayed as stacked avatars on the card. Any member can be an assistant on a task where another member is the primary owner — no fixed roles beyond that distinction.

---

## 1. Data Model

### Schema change

Add `assistants: string[]` to the card object:

```js
{
  id, col, title, desc, priority, machine,
  owner: "m1",          // required — primary owner ID (unchanged)
  assistants: ["m2", "m3"],  // NEW — optional, default []
  estMin, createdAt, startedAt?, completedAt?
}
```

### Migration (`app/data.js`)

In the `load()` function, after the existing migration guards, add:

```js
(state.cards || []).forEach(function (c) {
  if (!c.assistants) c.assistants = [];
});
```

`buildSeed()` cards already go through `seedCards.map(...)` — add `assistants: []` to each seed card definition. `buildEmpty()` produces `cards: []` so no change needed.

---

## 2. Busy State (`app/main.jsx`)

The `busyMemberIds` computation (used to determine member availability in the top bar and screensaver) must include assistants of in-progress cards.

Current pattern:
```js
cards.filter(c => c.col === 'inprogress').forEach(c => busy.add(c.owner));
```

New pattern:
```js
cards.filter(c => c.col === 'inprogress').forEach(c => {
  busy.add(c.owner);
  (c.assistants || []).forEach(id => busy.add(id));
});
```

In `app/screensaver.jsx`, `busyIds` is computed independently as:
```js
const busyIds = new Set(activeJobs.map((c) => c.owner));
```
Update to:
```js
const busyIds = React.useMemo(() => {
  const s = new Set();
  activeJobs.forEach(c => {
    s.add(c.owner);
    (c.assistants || []).forEach(id => s.add(id));
  });
  return s;
}, [activeJobs]);
```

Note: `board.jsx` TopBar computes machine availability (not member busy state) — no change needed there.

---

## 3. Card Display (`app/board.jsx`)

### Avatar stack

Replace the single avatar + owner name in the card footer with a `.av-stack` group:

- Owner avatar rendered first
- Assistant avatars rendered after, each with `margin-left: -8px` for overlap effect
- Maximum **3 avatars** shown total (owner + up to 2 assistants)
- If total members > 3, replace the third slot with a `+N` chip styled to match avatar size

### CSS (`.av-stack`)

```css
.av-stack { display: flex; align-items: center; }
.av-stack .av { margin-left: -8px; border: 2px solid var(--surface); }
.av-stack .av:first-child { margin-left: 0; }
.av-stack .av-extra {
  margin-left: -8px;
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--surface-2); border: 2px solid var(--surface);
  font-size: 10px; font-weight: 700; color: var(--text-2);
  display: grid; place-items: center;
}
```

### Owner name label

Show the primary owner's name only (unchanged behavior). Assistants are conveyed by the stacked avatars.

---

## 4. Modal (`app/modal.jsx`)

### New assistants section

Below the existing owner `<select>`, add a new field section only when `members.length > 1`:

- Label: `t('field.assistants', lang)` + hint `t('field.assistants_hint', lang)`
- Render all members **except the currently selected owner** as toggle chips
- Each chip: avatar (sm) + name, with a selected/unselected visual state (accent background when active)
- Tap/click toggles the member in/out of the assistants list
- When the owner changes, remove the new owner from `assistants` if they were previously added

### State

```js
const [assistants, setAssistants] = React.useState(editingCard?.assistants || []);
```

Toggle handler:
```js
function toggleAssistant(memberId) {
  setAssistants(prev =>
    prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
  );
}
```

On owner change, clean up:
```js
function handleOwnerChange(newOwnerId) {
  setOwner(newOwnerId);
  setAssistants(prev => prev.filter(id => id !== newOwnerId));
}
```

### Submit

Include `assistants` in the card object passed to `onCreate` / `onSave`.

---

## 5. Screensaver (`app/screensaver.jsx`)

Active job rows currently show the owner's avatar. Update to show the full `.av-stack` (same logic as the card: owner first, then assistants, max 3, `+N` overflow).

---

## 6. Export (`app/admin.jsx`)

**CSV:** Add an `assistants` column after `owner`. Value is member names joined by `|` (e.g., `"Aisha Rahman|Marco Silva"`). Empty string if no assistants.

```js
const cols = ['id', 'title', 'column', 'priority', 'machine', 'owner', 'assistants', 'created', 'completed'];
```

**JSON:** `assistants` array is included naturally in the full state export — no change needed.

---

## 7. i18n (`app/i18n.js`)

| Key | EN | ES |
|-----|----|----|
| `field.assistants` | Assistants | Asistentes |
| `field.assistants_hint` | Optional — tap to add | Opcional — toca para añadir |
| `field.assistants_none` | No assistants | Sin asistentes |

---

## 8. Out of scope

- No role labels beyond "owner" / "assistant" distinction
- No maximum limit on number of assistants (all other checked-in or registered members can be assistants)
- Check-in is not required to be assigned as assistant
- No notification or mention system
- Existing filters (by machine type) are unchanged — filter uses `card.machine`, not owner/assistants
