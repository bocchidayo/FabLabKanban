# Multiple Owners (Assistants) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `assistants` array to task cards so multiple members can be assigned to a task, with the primary owner remaining required.

**Architecture:** Add `assistants: []` to the card schema, migrate existing data in `load()`, update busy-state computations in `board.jsx` and `screensaver.jsx`, add a multi-toggle assistant picker to the modal, render stacked avatars on cards, and include assistants in CSV export. No new files needed.

**Tech Stack:** React 18 (UMD), Babel standalone, plain CSS, localStorage. No build step, no test runner — verification is browser-based.

---

## File map

| File | Change |
|------|--------|
| `app/data.js` | Add `assistants: []` to seedCards; migrate cards + archived in `load()` |
| `app/i18n.js` | Add 6 translation keys |
| `app/styles.css` | Add `.av-stack`, `.av-extra`, `.assistant-chips`, `.assistant-chip` |
| `app/board.jsx` | TopBar busyIds includes assistants; MemberStrip maps assistants; Card footer uses av-stack; Column passes assistantMembers |
| `app/screensaver.jsx` | busyIds includes assistants; active job shows av-stack |
| `app/modal.jsx` | Add `assistants` useState; toggle chips UI; include in `fields` object; clean up on owner change |
| `app/main.jsx` | `createCard` includes `assistants: data.assistants \|\| []` |
| `app/admin.jsx` | CSV export adds `assistants` column |

---

### Task 1: Data layer — schema + migration

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Add `assistants: []` to every object in `seedCards`**

In `app/data.js`, `seedCards` is defined starting at line 76. Add `assistants: []` to each of the 14 card objects. Every entry currently ends with something like `estMin: 45, createdMin: 95 }`. Add the field before the closing brace:

```js
  const seedCards = [
    { id: "c1",  col: "backlog",    title: "Laser-cut enclosure panels",    desc: "3mm acrylic, 4 side panels + lid for the air-quality sensor box.",         priority: "high", machine: "laser", owner: "m3", estMin: 45,  createdMin: 95,  assistants: [] },
    { id: "c2",  col: "backlog",    title: "Design PCB for sensor node",     desc: "Route the ESP32 carrier board, add USB-C and battery JST.",                priority: "mid",  machine: "elec",  owner: "m5", estMin: 120, createdMin: 180, assistants: [] },
    { id: "c3",  col: "backlog",    title: "Model replacement gear in CAD",  desc: "Reverse-engineer the broken 18-tooth gear from the label printer.",        priority: "low",  machine: "soft",  owner: "m7", estMin: 60,  createdMin: 240, assistants: [] },
    { id: "c4",  col: "backlog",    title: "Update lab safety signage",      desc: "Refresh laser + soldering station warning posters for the new layout.",    priority: "low",  machine: null,    owner: "m1", estMin: 30,  createdMin: 320, assistants: [] },
    { id: "c5",  col: "ready",      title: "Print prototype bracket v3",     desc: "PETG, 40% infill. Reinforced mounting tab from last review.",              priority: "mid",  machine: "print", owner: "m5", estMin: 180, createdMin: 60,  assistants: [] },
    { id: "c6",  col: "ready",      title: "Engrave wooden name tags",       desc: "Batch of 24 birch tags for the weekend workshop attendees.",               priority: "low",  machine: "laser", owner: "m7", estMin: 45,  createdMin: 130, assistants: [] },
    { id: "c7",  col: "ready",      title: "Mill aluminum mounting plate",   desc: "6061 stock, 4 holes + pocket. Fixture is already set up.",                 priority: "high", machine: "cnc",   owner: "m2", estMin: 90,  createdMin: 200, assistants: [] },
    { id: "c8",  col: "inprogress", title: "CNC cut acrylic dashboard sign", desc: "Reception wayfinding sign, 600x200mm.",                                    priority: "mid",  machine: "cnc",   owner: "m2", estMin: 175, startedMin: 95,  assistants: [] },
    { id: "c9",  col: "inprogress", title: "Solder LED driver board",        desc: "Hand-place 0805 passives, then reflow the driver IC.",                     priority: "high", machine: "elec",  owner: "m4", estMin: 90,  startedMin: 38,  assistants: [] },
    { id: "c10", col: "inprogress", title: "3D print drone frame",           desc: "Carbon-fill nylon, full arm set. Long job.",                               priority: "mid",  machine: "print", owner: "m1", estMin: 180, startedMin: 142, assistants: [] },
    { id: "c11", col: "done",       title: "Laser-cut gift boxes",           desc: "Run of 30 finger-joint boxes for the open-day giveaway.",                  priority: "mid",  machine: "laser", owner: "m3", estMin: 60,  doneMin: 40,     assistants: [] },
    { id: "c12", col: "done",       title: "Flash firmware to controllers",  desc: "Batch-flashed 12 motor controllers with v2.4.",                            priority: "low",  machine: "soft",  owner: "m4", estMin: 30,  doneMin: 115,    assistants: [] },
    { id: "c13", col: "done",       title: "Print spare clips batch",        desc: "PLA, 50 cable clips for the workbenches.",                                 priority: "low",  machine: "print", owner: "m1", estMin: 90,  doneMin: 190,    assistants: [] },
    { id: "c14", col: "done",       title: "Cut gasket seals",               desc: "Rubber sheet, 8 custom gaskets for the vacuum former.",                    priority: "mid",  machine: "cnc",   owner: "m7", estMin: 45,  doneMin: 260,    assistants: [] },
  ];
```

- [ ] **Step 2: Add migration in `load()` for active cards and archived cards**

In `app/data.js`, find the migration block in `load()` that contains:
```js
        // Ensure all cards have estMin
        (state.cards || []).forEach(function (c) { if (!c.estMin) c.estMin = 120; });
```

Add immediately after it:
```js
        // Ensure all cards have assistants
        (state.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });
        (state.archived || []).forEach(function (day) {
          (day.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });
        });
```

- [ ] **Step 3: Verify in browser console**

Start server: `python3 -m http.server 5000`
Open `http://localhost:5000`. In DevTools console:

```js
var state = window.FabData.load();
console.log(state.cards.every(c => Array.isArray(c.assistants)));
// → true
console.log(state.cards[0].assistants);
// → []
```

- [ ] **Step 4: Commit**

```bash
git add app/data.js
git commit -m "feat: add assistants field to card schema with migration"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `app/i18n.js`

- [ ] **Step 1: Add 6 translation keys after the existing `field.reassign_owner` entry**

In `app/i18n.js`, find:
```js
    "field.reassign_owner":      { en: "Owner",                    es: "Responsable" },
```

Insert immediately after it:
```js
    "field.assistants":          { en: "Assistants",               es: "Asistentes" },
    "field.assistants_hint":     { en: "Optional — tap to add",    es: "Opcional — toca para añadir" },
    "field.assistants_none":     { en: "No assistants",            es: "Sin asistentes" },
    "label.owner":               { en: "Owner",                    es: "Responsable" },
    "label.team":                { en: "Team",                     es: "Equipo" },
    "label.assistant":           { en: "Assistant",                es: "Asistente" },
```

- [ ] **Step 2: Verify in browser console**

```js
window.I18n.t('field.assistants', 'es')      // → "Asistentes"
window.I18n.t('label.team', 'en')            // → "Team"
window.I18n.t('field.assistants_hint', 'es') // → "Opcional — toca para añadir"
```

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat: add i18n keys for assistants feature"
```

---

### Task 3: CSS — avatar stack and assistant chips

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Add `.av-stack` and `.av-extra` after the existing `.av.xl` rule**

In `app/styles.css`, find:
```css
.av.xl { width: 48px; height: 48px; font-size: 17px; }
```

Insert immediately after it:
```css
.av-stack { display: flex; align-items: center; }
.av-stack .av { margin-left: -8px; border: 2px solid var(--surface); }
.av-stack .av:first-child { margin-left: 0; }
.av-extra {
  margin-left: -8px; flex: none;
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--surface-2); border: 2px solid var(--surface);
  font-size: 10px; font-weight: 700; color: var(--text-2);
  display: grid; place-items: center;
}
```

- [ ] **Step 2: Add `.assistant-chips` and `.assistant-chip` after the `.segment` / modal field rules**

In `app/styles.css`, find the line:
```css
.btn-danger { background: var(--p-high); border-color: var(--p-high); color: #fff; }
```

Insert immediately after it:
```css
.assistant-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.assistant-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 10px 0 6px;
  border: 1px solid var(--border-strong); border-radius: 999px;
  background: var(--surface); font-size: 13px; font-weight: 600; color: var(--text);
  cursor: pointer; transition: background .1s, border-color .1s;
}
.assistant-chip:hover { background: var(--surface-2); }
.assistant-chip.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 3: Commit**

```bash
git add app/styles.css
git commit -m "feat: add av-stack and assistant-chip CSS"
```

---

### Task 4: board.jsx — busy state + avatar stack + MemberStrip

**Files:**
- Modify: `app/board.jsx`

- [ ] **Step 1: Update TopBar popover busy state to include assistants**

In `app/board.jsx`, find this exact line inside the `TopBar` popover map:
```js
                (cards || []).forEach(function (c) { if (c.col === 'inprogress') busyIds[c.owner] = true; });
```

Replace it with:
```js
                (cards || []).forEach(function (c) { if (c.col === 'inprogress') { busyIds[c.owner] = true; (c.assistants || []).forEach(function(id) { busyIds[id] = true; }); } });
```

- [ ] **Step 2: Update MemberStrip to map assistants to their active task**

In `app/board.jsx`, find this block inside `MemberStrip`:
```js
      if (c.col === 'inprogress' && c.owner) {
        map[c.owner] = c;
      }
```

Replace it with:
```js
      if (c.col === 'inprogress') {
        if (c.owner) map[c.owner] = c;
        (c.assistants || []).forEach(function (id) { if (!map[id]) map[id] = c; });
      }
```

- [ ] **Step 3: Pass `assistantMembers` from Column to Card**

In `app/board.jsx`, find where `Column` renders each `Card`. It currently passes `member={memberMap[card.owner]}`. Add the `assistantMembers` prop on the same line:

Find:
```jsx
            <Card
              card={card}
              member={memberMap[card.owner]}
              now={now}
              lang={lang}
              isSelected={selectedCardId === card.id}
              onClick={onCardClick}
              onClaimStart={onClaimStart}
              dnd={dnd}
            />
```

Replace with:
```jsx
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
```

- [ ] **Step 4: Update Card component signature and footer**

In `app/board.jsx`, find the Card function signature:
```js
function Card({ card, member, now, isSelected, onClick, onClaimStart, dnd, lang }) {
```

Replace with:
```js
function Card({ card, member, assistantMembers, now, isSelected, onClick, onClaimStart, dnd, lang }) {
```

Then add avatar stack variables in the Card component body, right after the existing computed values (e.g., after the `const priClass = ...` line) and before the `return`:

```js
  // Avatar stack for footer
  const allMembers = member ? [member].concat(assistantMembers || []) : (assistantMembers || []);
  const visibleMembers = allMembers.slice(0, 3);
  const extraMembers = allMembers.length - 3;
```

Then find the card footer (lines 409–417):
```jsx
      <div className="card-foot">
        {member && (
          <Avatar member={member} size="sm" />
        )}
        {member && <span className="owner">{member.name || ''}</span>}
        <div className="card-foot-spacer" />
        <Icon name={tsIcon} />
        {' '}<span className="ts">{fmtAgo ? fmtAgo(ts, now) : ts}</span>
      </div>
```

Replace with:
```jsx
      <div className="card-foot">
        {visibleMembers.length > 0 && (
          <div className="av-stack">
            {visibleMembers.map(function(m) { return <Avatar key={m.id} member={m} size="sm" />; })}
            {extraMembers > 0 && <span className="av-extra">+{extraMembers}</span>}
          </div>
        )}
        {member && <span className="owner">{member.name || ''}</span>}
        <div className="card-foot-spacer" />
        <Icon name={tsIcon} />
        {' '}<span className="ts">{fmtAgo ? fmtAgo(ts, now) : ts}</span>
      </div>
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5000`. Open admin → assign assistants to a card (after Task 6) or manually set `assistants` in localStorage. Confirm stacked avatars appear on card. Confirm those members show "Ocupado/Busy" in the check-in popover.

- [ ] **Step 6: Commit**

```bash
git add app/board.jsx
git commit -m "feat: board — av-stack on cards, assistants in busy state"
```

---

### Task 5: screensaver.jsx — busy state + av-stack

**Files:**
- Modify: `app/screensaver.jsx`

- [ ] **Step 1: Update `busyIds` memo to include assistants**

In `app/screensaver.jsx`, find:
```js
  const busyIds = React.useMemo(
    () => new Set(activeJobs.map((c) => c.owner)),
    [activeJobs],
  );
```

Replace with:
```js
  const busyIds = React.useMemo(() => {
    const s = new Set();
    activeJobs.forEach(function(c) {
      s.add(c.owner);
      (c.assistants || []).forEach(function(id) { s.add(id); });
    });
    return s;
  }, [activeJobs]);
```

- [ ] **Step 2: Update active job row to show av-stack instead of single avatar**

In `app/screensaver.jsx`, find the active job render block that contains:
```jsx
                  <Avatar member={owner} size="lg" />
```

The surrounding context looks like:
```jsx
            {activeJobs.map((card) => {
              const owner = getOwner(card);
```

After `const owner = getOwner(card);`, add:
```js
              const assistants = (card.assistants || []).map(function(id) { return memberMap[id]; }).filter(Boolean);
              const allJobMembers = owner ? [owner].concat(assistants) : assistants;
              const visibleJobMembers = allJobMembers.slice(0, 3);
              const extraJobMembers = allJobMembers.length - 3;
```

Then replace:
```jsx
                  <Avatar member={owner} size="lg" />
```

With:
```jsx
                  <div className="av-stack">
                    {visibleJobMembers.map(function(m) { return <Avatar key={m.id} member={m} size="lg" />; })}
                    {extraJobMembers > 0 && <span className="av-extra" style={{ width: 36, height: 36, fontSize: 12 }}>+{extraJobMembers}</span>}
                  </div>
```

- [ ] **Step 3: Verify in browser**

Click "Screensaver preview" (S key). Confirm active jobs show the owner's avatar. Add an assistant via localStorage or after Task 6 and confirm the stacked avatar appears.

- [ ] **Step 4: Commit**

```bash
git add app/screensaver.jsx
git commit -m "feat: screensaver — assistants in busy state and av-stack"
```

---

### Task 6: modal.jsx — assistants picker

**Files:**
- Modify: `app/modal.jsx`

Note: `modal.jsx` uses `var` declarations and `React.createElement` — follow this pattern exactly.

- [ ] **Step 1: Add `assistants` useState after the existing state declarations**

In `app/modal.jsx`, find the block of `useState` calls (around lines 43–60). The last one before `_touched` is `_estMin`. After:
```js
    var _estMin   = useState(isEdit && editingCard ? editingCard.estMin || 120 : 120);
```

Add:
```js
    var _assistants = useState(isEdit && editingCard ? (editingCard.assistants || []) : []);
```

Then after the destructuring block (where `var owner = _owner[0]` etc. are defined), add:
```js
    var assistants = _assistants[0]; var setAssistants = _assistants[1];
```

- [ ] **Step 2: Add `toggleAssistant` function and update owner-change handlers**

In `app/modal.jsx`, find the `handleReassign` function:
```js
    function handleReassign(e) {
      var newId = e.target.value;
      setOwner(newId);
      if (newId !== editingCard.owner) {
        onReassign(editingCard.id, newId);
      }
    }
```

Add `toggleAssistant` immediately before it and update `handleReassign` to clean up assistants:
```js
    function toggleAssistant(memberId) {
      setAssistants(function(prev) {
        return prev.includes(memberId)
          ? prev.filter(function(id) { return id !== memberId; })
          : prev.concat([memberId]);
      });
    }

    function handleReassign(e) {
      var newId = e.target.value;
      setOwner(newId);
      setAssistants(function(prev) { return prev.filter(function(id) { return id !== newId; }); });
      if (newId !== editingCard.owner) {
        onReassign(editingCard.id, newId);
      }
    }
```

Also find the owner `<select>` onChange for the create (non-edit) case. It currently uses an inline arrow function. Update it to also clean assistants. Find:
```js
                onChange: isEdit ? handleReassign : function(e) { setOwner(e.target.value); },
```

Replace with:
```js
                onChange: isEdit ? handleReassign : function(e) {
                  var newId = e.target.value;
                  setOwner(newId);
                  setAssistants(function(prev) { return prev.filter(function(id) { return id !== newId; }); });
                },
```

- [ ] **Step 3: Add `assistants` to the `fields` object in `handleSubmit`**

Find:
```js
      var fields = {
        owner: owner,
        title: title.trim(),
        desc: desc.trim(),
        machine: machine,
        priority: priority,
        estMin: parseInt(estMin, 10) || 120,
      };
```

Replace with:
```js
      var fields = {
        owner: owner,
        assistants: assistants,
        title: title.trim(),
        desc: desc.trim(),
        machine: machine,
        priority: priority,
        estMin: parseInt(estMin, 10) || 120,
      };
```

- [ ] **Step 4: Add the assistants picker UI below the owner field**

In `app/modal.jsx`, find the closing of the owner field `React.createElement` block. It ends after the owner `<select>` closes, right before the title field begins:
```js
            React.createElement("div", { className: "field" },
              React.createElement("label", null, t('field.title', lang)),
```

Insert the assistants field block between the owner field and the title field:
```js
            members.length > 1 && React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.assistants', lang), ' ',
                React.createElement("span", { style: { fontSize: 12, color: 'var(--text-3)', fontWeight: 500 } },
                  t('field.assistants_hint', lang)
                )
              ),
              React.createElement("div", { className: "assistant-chips" },
                members
                  .filter(function(m) { return m.id !== owner; })
                  .map(function(m) {
                    var isOn = assistants.includes(m.id);
                    return React.createElement("button", {
                      key: m.id,
                      type: "button",
                      className: "assistant-chip" + (isOn ? " on" : ""),
                      onClick: function() { toggleAssistant(m.id); }
                    },
                      React.createElement(Avatar, { member: m, size: "sm" }),
                      React.createElement("span", null, m.name)
                    );
                  })
              )
            ),
```

Note: `Avatar` must be in scope. In `modal.jsx`, check if `Avatar` is referenced as `window.Avatar` or destructured. If not available, use:
```js
              React.createElement("div", { className: "assistant-chips" },
                members
                  .filter(function(m) { return m.id !== owner; })
                  .map(function(m) {
                    var isOn = assistants.includes(m.id);
                    return React.createElement("button", {
                      key: m.id,
                      type: "button",
                      className: "assistant-chip" + (isOn ? " on" : ""),
                      onClick: function() { toggleAssistant(m.id); }
                    },
                      React.createElement("span", {
                        className: "av sm",
                        style: { backgroundColor: m.color || '#888', display: 'inline-grid', placeItems: 'center', borderRadius: '50%', width: 26, height: 26, fontSize: 10.5, color: '#fff', fontWeight: 700, flexShrink: 0 }
                      }, (m.name || '').split(' ').map(function(w){ return w[0]; }).join('').slice(0,2).toUpperCase()),
                      React.createElement("span", null, m.name)
                    );
                  })
              )
```

- [ ] **Step 5: Verify in browser**

Open any card or create a new one. Confirm the "Asistentes / Assistants" section appears below the owner select when multiple members exist. Tap a member chip — it should highlight in orange/accent. Change the owner to a current assistant — they should be automatically removed from the assistant list.

- [ ] **Step 6: Commit**

```bash
git add app/modal.jsx
git commit -m "feat: modal — assistants multi-select picker"
```

---

### Task 7: main.jsx — include assistants in createCard

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Add `assistants` to the card object in `createCard`**

In `app/main.jsx`, find the `createCard` function. It builds a `card` object:
```js
    const card = {
      id: FabData.uid(),
      col: data.col, title: data.title, desc: data.desc,
      priority: data.priority, machine: data.machine, owner: data.owner,
      estMin: data.estMin || 120,
      createdAt: Date.now(),
    };
```

Replace with:
```js
    const card = {
      id: FabData.uid(),
      col: data.col, title: data.title, desc: data.desc,
      priority: data.priority, machine: data.machine, owner: data.owner,
      assistants: data.assistants || [],
      estMin: data.estMin || 120,
      createdAt: Date.now(),
    };
```

- [ ] **Step 2: Commit**

```bash
git add app/main.jsx
git commit -m "feat: main — pass assistants through createCard"
```

---

### Task 8: admin.jsx — CSV export

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add `assistants` column to CSV export**

In `app/admin.jsx`, find `exportCSV`:
```js
    const cols = ['id', 'title', 'column', 'priority', 'machine', 'owner', 'created', 'completed'];
    const rows = [cols];

    (state.cards || []).forEach(task => {
      rows.push([
        task.id,
        escCSV(task.title),
        task.col || '',
        task.priority || '',
        task.machine || '',
        task.owner || '',
        task.createdAt || '',
        task.completedAt || '',
      ]);
    });
```

Replace with:
```js
    const cols = ['id', 'title', 'column', 'priority', 'machine', 'owner', 'assistants', 'created', 'completed'];
    const rows = [cols];

    (state.cards || []).forEach(task => {
      const assistantNames = (task.assistants || [])
        .map(id => { const m = (state.members || []).find(m => m.id === id); return m ? m.name : id; })
        .join('|');
      rows.push([
        task.id,
        escCSV(task.title),
        task.col || '',
        task.priority || '',
        task.machine || '',
        task.owner || '',
        escCSV(assistantNames),
        task.createdAt || '',
        task.completedAt || '',
      ]);
    });
```

- [ ] **Step 2: Verify CSV output**

Open admin → Export CSV. Open the downloaded file. Confirm the header row contains `assistants` and cards with no assistants have an empty value in that column.

- [ ] **Step 3: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: admin — add assistants column to CSV export"
```

---

### Task 9: Push and PR

- [ ] **Step 1: Push all commits**

```bash
git push origin feat/multiple-owners
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "feat: multiple owners — assistants on tasks" --body "$(cat <<'EOF'
## Summary

- Adds optional `assistants: string[]` to card schema with migration for existing data
- Stacked avatars on cards (owner first, max 3 visible, +N overflow)
- Multi-toggle assistant picker in create/edit modal
- Assistants count as busy in check-in popover and screensaver
- CSV export includes assistants column

## Test plan

- [ ] Create a card, assign 2+ assistants — stacked avatars appear on card
- [ ] Change owner to a current assistant — they are removed from assistant list
- [ ] Put card In Progress — all assistants show as "Busy" in check-in popover
- [ ] Open screensaver — active job shows stacked avatars
- [ ] Export CSV — assistants column present with names separated by |
- [ ] Reload page — assistants persist across sessions

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
