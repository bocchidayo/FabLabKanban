# Check-in Timestamp Chip + Attendance Log

**Date:** 2026-05-30
**Branch:** feat/checkin-features (or new branch off main)

---

## Goal

Two coordinated features:

1. **Check-in with timestamp** — the check-in popover in the top bar shows each present member's entry time as a compact green chip next to their name.
2. **Attendance log in admin** — a new admin panel shows a day-selectable table of check-in / check-out events with calculated duration, exportable to CSV.

---

## 1. Data Model Changes

### 1.1 Member — add `checkedInAt`

Extend each member object with one new field:

```js
{ id, name, initials, color, checkedIn: bool, checkedInAt: "ISO string" | null }
```

- On **check-in**: write `checkedInAt: new Date().toISOString()`
- On **check-out**: clear to `checkedInAt: null`

### 1.2 State — add `attendance` array

New top-level field in the persisted state (alongside `cards`, `archived`, `members`):

```js
attendance: [
  { memberId: "m1", date: "2026-05-30", checkIn: "09:15", checkOut: "12:30" },
  { memberId: "m1", date: "2026-05-30", checkIn: "14:00", checkOut: null },  // second session same day
  ...
]
```

Rules:
- **On check-in**: push `{ memberId, date: FabData.todayStr(), checkIn: fmtHHMM(now), checkOut: null }`.
- **On check-out**: find the **most recent entry where `memberId` matches and `checkOut === null`** (no `date` filter — handles midnight rollover). Write `checkOut: fmtHHMM(now)`.
- **Multiple sessions per day**: each check-in creates a new entry. No merging.

### 1.3 Migrations in `data.js load()`

```js
if (!state.attendance) state.attendance = [];
state.members.forEach(m => { if (!('checkedInAt' in m)) m.checkedInAt = null; });
```

### 1.4 `reset()` and `startFresh()` — wipe attendance

Both operations wipe `attendance: []`, same as `archived`. Implement by:

- `reset()`: `load()` returns seed state; the migration in `load()` sets `attendance: []` if missing — but seed state must explicitly include `attendance: []`.
- `startFresh()` / `buildEmpty()`: add `attendance: []` to the object returned by `buildEmpty()`.

Open sessions don't accumulate across resets because attendance is wiped entirely. Members with `checkedIn: true` in seed data will have `checkedInAt: null` (from the migration) — they appear as checked in without a time chip, which is correct for the reset default state.

---

## 2. Helper Functions (`data.js`)

Add `fmtHHMM(date)` to `FabData`:

```js
function fmtHHMM(date) {
  return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
}
```

Returns `"09:15"` format. Use `'en'` locale for consistent `HH:MM` output (avoids AM/PM variants). Expose via `window.FabData.fmtHHMM`.

---

## 3. `checkIn()` Update (`main.jsx`)

Replace the existing toggle-only logic:

```js
function checkIn(memberId) {
  const member = state.members.find(m => m.id === memberId);
  const isCheckingIn = !member.checkedIn;
  const now = new Date();

  setState(s => {
    // Update member
    const members = s.members.map(m =>
      m.id === memberId
        ? { ...m, checkedIn: isCheckingIn, checkedInAt: isCheckingIn ? now.toISOString() : null }
        : m
    );

    // Update attendance
    let attendance = [...(s.attendance || [])];
    if (isCheckingIn) {
      attendance.push({ memberId, date: FabData.todayStr(), checkIn: FabData.fmtHHMM(now), checkOut: null });
    } else {
      // Find most recent open entry for this member (no date filter — handles midnight)
      const lastOpen = [...attendance].reverse().findIndex(e => e.memberId === memberId && e.checkOut === null);
      if (lastOpen !== -1) {
        const realIdx = attendance.length - 1 - lastOpen;
        attendance[realIdx] = { ...attendance[realIdx], checkOut: FabData.fmtHHMM(now) };
      }
    }

    return { ...s, members, attendance };
  });

  setCheckedInMemberId(memberId);
}
```

---

## 4. Check-in Popover UI (`board.jsx`)

### 4.1 Time chip in popover rows

In `TopBar`, each `.checkin-row` for a checked-in member gains a time chip after the name:

```jsx
{m.checkedIn && m.checkedInAt && (
  <span className="checkin-time-chip">
    {new Date(m.checkedInAt).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}
  </span>
)}
```

Placement: between `.nm` (name) and `.status` span in the row.

Members without `checkedIn: true` show no chip — identical to current behavior.

### 4.2 CSS — `.checkin-time-chip`

In `styles.css`, add `--ok-soft` alongside the existing soft-color variables, then define the chip class:

```css
/* in :root, after --coral-soft */
--ok-soft: #d3f9d8;

/* checkin time chip */
.checkin-time-chip {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--ok-soft);
  color: var(--ok);
  white-space: nowrap;
}
```

`--ok-soft` follows the same pattern as `--accent-soft`, `--amber-soft`, `--coral-soft` already in the file. Future theme changes override `--ok` and `--ok-soft` in one place.

---

## 5. Admin Attendance Panel (`admin.jsx`)

New component `AttendancePanel` rendered as a `.panel` block, inserted **between the Archive panel and the Export panel**.

### 5.1 Day selector

```jsx
<input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
```

Default: `FabData.todayStr()`. Same `<input type="date">` pattern as the Archive panel.

### 5.2 Table layout

Columns: Avatar · Name · Entry (↓) · Exit (↑) · Duration

**Row logic:**

```
For the selected date, collect all attendance entries matching that date.
Build display rows:
  - One row per attendance entry (multiple per member if multiple sessions)
  - "checkOut === null" rows show "— activo" in exit column and "en curso" in duration
  - Members with no entry for the selected date: one row at the bottom, grayed, no times, "Sin check-in hoy" spanning the time/duration columns
```

Sorting: checked-in members first (by checkIn time), then absent members at the bottom.

### 5.3 Duration calculation

```js
function calcDuration(checkIn, checkOut) {
  if (!checkOut) return null; // "en curso"
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  return FabData.fmtDuration(mins * 60000); // reuses existing helper
}
```

For cross-midnight entries (checkOut time < checkIn time): add 24*60 to the difference. Not a priority but worth a one-line guard.

### 5.4 Export CSV

Button within the Attendance panel only (not shared with the task export button):

```
fecha,miembro,entrada,salida,duracion_min
2026-05-30,Marco Silva,09:15,12:30,195
2026-05-30,Aisha Rahman,10:00,,en curso
```

Columns: `fecha` (date), `miembro` (member name), `entrada` (checkIn), `salida` (checkOut or empty), `duracion_min` (numeric minutes or "en curso").

Filename: `fablab-asistencia-YYYY-MM-DD.csv` for the selected day.

---

## 6. i18n Keys to Add (`i18n.js`)

```js
"admin.attendance_title":  { en: "Attendance",           es: "Asistencia" },
"admin.attendance_desc":   { en: "Check-in and check-out log by day.", es: "Registro de entradas y salidas por día." },
"admin.attendance_date":   { en: "Day",                  es: "Día" },
"admin.attendance_entry":  { en: "Entry",                es: "Entrada" },
"admin.attendance_exit":   { en: "Exit",                 es: "Salida" },
"admin.attendance_duration":{ en: "Duration",            es: "Duración" },
"admin.attendance_active": { en: "— active",             es: "— activo" },
"admin.attendance_ongoing":{ en: "ongoing",              es: "en curso" },
"admin.attendance_absent": { en: "No check-in today",    es: "Sin check-in hoy" },
"admin.attendance_export": { en: "Export attendance CSV",es: "Exportar CSV asistencia" },
"admin.attendance_empty":  { en: "No attendance records for this day.", es: "Sin registros de asistencia para este día." },
```

---

## 7. Files Modified

| File | Changes |
|------|---------|
| `app/data.js` | Add `fmtHHMM()` to `FabData`; migrations for `attendance` and `checkedInAt`; close open sessions in `reset()`/`startFresh()` |
| `app/main.jsx` | Rewrite `checkIn()` to write `checkedInAt` and push/complete `attendance` entries |
| `app/board.jsx` | `TopBar`: add time chip span in each `.checkin-row` for present members |
| `app/admin.jsx` | Add `AttendancePanel` component and wire it between Archive and Export panels; add `attendanceDate` state |
| `app/i18n.js` | Add all `admin.attendance_*` keys |
| `app/styles.css` | Add `--ok-soft` CSS variable; add `.checkin-time-chip` rule |

---

## 8. Edge Cases

| Case | Handling |
|------|---------|
| Midnight rollover | `checkOut` search uses no date filter — finds the most recent open entry regardless of `date` |
| Multiple sessions same day | Each check-in pushes a new entry; the table shows them as separate rows |
| Reset / startFresh with open sessions | `attendance` is wiped to `[]` along with all other data; open sessions are gone with it |
| `fmtDuration(0)` | `checkIn === checkOut` yields `"0m"` — acceptable edge |
| Member deleted with open session | Orphaned entry stays in attendance log with no matching member; the table skips rows whose `memberId` has no matching member in `state.members` |
| Cross-midnight duration | Guard: if `h2*60+m2 < h1*60+m1`, add 1440 mins before computing |

---

## 9. Out of Scope

- Real-time "en curso" duration ticker in the table (static display, no live update)
- Editing or deleting individual attendance entries
- Attendance history beyond what's in localStorage (no server-side persistence)
- Exporting the full attendance log across all days at once
