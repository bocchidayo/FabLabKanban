# Check-in Timestamp Chip + Attendance Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add check-in timestamps to the topbar popover chip and a day-selectable attendance log table in the admin panel, persisted in localStorage.

**Architecture:** Extend the member model with `checkedInAt: ISO|null`; add a top-level `attendance: []` array to state; rewrite `checkIn()` in `main.jsx` to write both fields atomically inside `setState`; render a time chip in the existing `TopBar` popover rows; add a new `AttendancePanel` component in `admin.jsx` between the Archive and Export panels.

**Tech Stack:** React 18 UMD, Babel Standalone, plain JS (no build step). No test runner — verification is done in browser with `python3 -m http.server 5000`.

**Spec:** `docs/superpowers/specs/2026-05-30-checkin-timestamp-attendance-log.md`

---

### Task 1: i18n keys for attendance panel

**Files:**
- Modify: `app/i18n.js`

- [ ] **Step 1: Add attendance i18n keys**

In `app/i18n.js`, find the last line of the tutorial section:
```js
    "tut.skip":                  { en: "Skip tutorial",            es: "Saltar tutorial" },
```
Insert a new section immediately after that line and before the closing `};`:
```js
    // ---- attendance -------------------------------------------------------
    "admin.attendance_title":    { en: "Attendance",                         es: "Asistencia" },
    "admin.attendance_desc":     { en: "Check-in and check-out log by day.", es: "Registro de entradas y salidas por día." },
    "admin.attendance_date":     { en: "Day",                                es: "Día" },
    "admin.attendance_entry":    { en: "Entry",                              es: "Entrada" },
    "admin.attendance_exit":     { en: "Exit",                               es: "Salida" },
    "admin.attendance_duration": { en: "Duration",                           es: "Duración" },
    "admin.attendance_active":   { en: "— active",                           es: "— activo" },
    "admin.attendance_ongoing":  { en: "ongoing",                            es: "en curso" },
    "admin.attendance_absent":   { en: "No check-in today",                  es: "Sin check-in hoy" },
    "admin.attendance_export":   { en: "Export attendance CSV",              es: "Exportar CSV asistencia" },
    "admin.attendance_empty":    { en: "No attendance records for this day.", es: "Sin registros de asistencia para este día." },
```

- [ ] **Step 2: Verify in browser**

Start server if not running: `python3 -m http.server 5000`

Open `http://localhost:5000`. In DevTools console:
```js
window.I18n.t('admin.attendance_title', 'en')  // → "Attendance"
window.I18n.t('admin.attendance_title', 'es')  // → "Asistencia"
window.I18n.t('admin.attendance_absent', 'es') // → "Sin check-in hoy"
```
All three must return the string, not the key itself.

- [ ] **Step 3: Commit**

```bash
git add app/i18n.js
git commit -m "feat: add attendance i18n keys"
```

---

### Task 2: CSS — `--ok-soft` variable and `.checkin-time-chip` rule

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Add `--ok-soft` to `:root`**

In `app/styles.css`, find:
```css
  --coral-soft: #fef0ed;
```
Add `--ok-soft` on the line immediately after:
```css
  --coral-soft: #fef0ed;
  --ok-soft: #d3f9d8;
```

- [ ] **Step 2: Add `.checkin-time-chip` and `.attendance-table` rules**

Find:
```css
.checkin-toggle.out { background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border); }
```
Append the following two rules immediately after that line:
```css
.checkin-time-chip { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; background: var(--ok-soft); color: var(--ok); white-space: nowrap; }

.attendance-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
.attendance-table th { text-align: left; padding: 5px 8px; color: var(--text-3); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--border); }
.attendance-table td { padding: 8px 8px; border-bottom: 1px solid var(--surface-2); vertical-align: middle; }
```

- [ ] **Step 3: Verify in browser**

Reload `http://localhost:5000`. In DevTools console:
```js
getComputedStyle(document.documentElement).getPropertyValue('--ok-soft').trim()
// → "#d3f9d8"
```

- [ ] **Step 4: Commit**

```bash
git add app/styles.css
git commit -m "feat: add --ok-soft variable and checkin-time-chip CSS"
```

---

### Task 3: data.js — `fmtHHMM`, migrations, seed cleanup

**Files:**
- Modify: `app/data.js`

- [ ] **Step 1: Reset seed members to unchecked**

In `app/data.js`, find the entire `seedMembers` array (lines 64–73):
```js
  const seedMembers = [
    { id: "m1", name: "Aisha Rahman", initials: "AR", color: "#2b7fd4", checkedIn: true },
    { id: "m2", name: "Marco Silva",  initials: "MS", color: "#25a04a", checkedIn: true },
    { id: "m3", name: "Lena Vogt",    initials: "LV", color: "#7c5cfc", checkedIn: true },
    { id: "m4", name: "Tom Becker",   initials: "TB", color: "#e23c34", checkedIn: true },
    { id: "m5", name: "Priya Nair",   initials: "PN", color: "#0e9da0", checkedIn: true },
    { id: "m6", name: "Jonas Weiss",  initials: "JW", color: "#c2255c", checkedIn: false },
    { id: "m7", name: "Sara Khoury",  initials: "SK", color: "#f0a017", checkedIn: true },
    { id: "m8", name: "Diego Torres", initials: "DT", color: "#495057", checkedIn: false },
  ];
```
Replace with (all `checkedIn: false`, all `checkedInAt: null`):
```js
  const seedMembers = [
    { id: "m1", name: "Aisha Rahman", initials: "AR", color: "#2b7fd4", checkedIn: false, checkedInAt: null },
    { id: "m2", name: "Marco Silva",  initials: "MS", color: "#25a04a", checkedIn: false, checkedInAt: null },
    { id: "m3", name: "Lena Vogt",    initials: "LV", color: "#7c5cfc", checkedIn: false, checkedInAt: null },
    { id: "m4", name: "Tom Becker",   initials: "TB", color: "#e23c34", checkedIn: false, checkedInAt: null },
    { id: "m5", name: "Priya Nair",   initials: "PN", color: "#0e9da0", checkedIn: false, checkedInAt: null },
    { id: "m6", name: "Jonas Weiss",  initials: "JW", color: "#c2255c", checkedIn: false, checkedInAt: null },
    { id: "m7", name: "Sara Khoury",  initials: "SK", color: "#f0a017", checkedIn: false, checkedInAt: null },
    { id: "m8", name: "Diego Torres", initials: "DT", color: "#495057", checkedIn: false, checkedInAt: null },
  ];
```

- [ ] **Step 2: Add `attendance: []` to `buildSeed()`**

Find the return statement inside `buildSeed()`:
```js
    return {
      lab: "FABLAB UTP",
      password: "admin",
      idleMinutes: 3,
      members: clone(seedMembers),
      machines: machines,
      cards: cards,
      archived: [],
      lastReset: todayStr,
      lang: "en",
    };
```
Replace with:
```js
    return {
      lab: "FABLAB UTP",
      password: "admin",
      idleMinutes: 3,
      members: clone(seedMembers),
      machines: machines,
      cards: cards,
      archived: [],
      attendance: [],
      lastReset: todayStr,
      lang: "en",
    };
```

- [ ] **Step 3: Add `attendance: []` to `buildEmpty()`**

Find the return statement inside `buildEmpty()`:
```js
    return {
      lab: "FabLab",
      password: "admin",
      idleMinutes: 3,
      members: [],
      machines: machines,
      cards: [],
      archived: [],
      lastReset: todayStr(),
      lang: lang || 'es',
    };
```
Replace with:
```js
    return {
      lab: "FabLab",
      password: "admin",
      idleMinutes: 3,
      members: [],
      machines: machines,
      cards: [],
      archived: [],
      attendance: [],
      lastReset: todayStr(),
      lang: lang || 'es',
    };
```

- [ ] **Step 4: Add migrations in `load()`**

Find the last migration line in `load()`:
```js
        (state.archived || []).forEach(function (day) {
          (day.cards || []).forEach(function (c) { if (!c.assistants) c.assistants = []; });
        });
```
Add two new migration lines immediately after that block (before the `// Sync globals` comment):
```js
        // Ensure attendance log exists
        if (!state.attendance) state.attendance = [];
        // Ensure all members have checkedInAt
        state.members.forEach(function (m) { if (!('checkedInAt' in m)) m.checkedInAt = null; });
```

- [ ] **Step 5: Add `fmtHHMM` helper**

Find the `uid()` function:
```js
  function uid() { return "x" + Math.random().toString(36).slice(2, 9); }
```
Add `fmtHHMM` on the line immediately after:
```js
  function fmtHHMM(date) {
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
```

- [ ] **Step 6: Expose `fmtHHMM` via `window.FabData`**

Find the exposed API object at the bottom of data.js. It currently ends with:
```js
    getTodayDone: getTodayDone,
  };
```
Add `fmtHHMM` before the closing `};`:
```js
    getTodayDone: getTodayDone,
    fmtHHMM: fmtHHMM,
  };
```

- [ ] **Step 7: Verify in browser**

Reload `http://localhost:5000`. In DevTools console:
```js
// fmtHHMM helper works
window.FabData.fmtHHMM(new Date())          // → "HH:MM" e.g. "14:35"

// Fresh seed has no checked-in members
window.FabData.load().members.every(m => !m.checkedIn)  // → true (after clearing localStorage)
// To test: localStorage.removeItem('fablab_utp_v3'); location.reload()

// attendance key exists on loaded state
JSON.parse(localStorage.getItem('fablab_utp_v3')).attendance  // → []
```

- [ ] **Step 8: Commit**

```bash
git add app/data.js
git commit -m "feat: data — fmtHHMM helper, attendance migration, seed members unchecked"
```

---

### Task 4: main.jsx — rewrite `checkIn()` with timestamp and attendance tracking

**Files:**
- Modify: `app/main.jsx`

- [ ] **Step 1: Replace `checkIn()`**

Find the current `checkIn` function in `app/main.jsx`:
```js
  function checkIn(memberId) {
    setState(s => ({
      ...s,
      members: s.members.map(m => m.id === memberId ? { ...m, checkedIn: !m.checkedIn } : m),
    }));
    setCheckedInMemberId(memberId);
  }
```
Replace with:
```js
  function checkIn(memberId) {
    const now = new Date();
    setState(s => {
      const member = s.members.find(m => m.id === memberId);
      if (!member) return s;
      const isCheckingIn = !member.checkedIn;

      const members = s.members.map(m =>
        m.id === memberId
          ? { ...m, checkedIn: isCheckingIn, checkedInAt: isCheckingIn ? now.toISOString() : null }
          : m
      );

      let attendance = [...(s.attendance || [])];
      if (isCheckingIn) {
        attendance.push({
          memberId,
          date: FabData.todayStr(),
          checkIn: FabData.fmtHHMM(now),
          checkOut: null,
        });
      } else {
        const reversed = [...attendance].reverse();
        const lastOpenIdx = reversed.findIndex(e => e.memberId === memberId && e.checkOut === null);
        if (lastOpenIdx !== -1) {
          const realIdx = attendance.length - 1 - lastOpenIdx;
          attendance[realIdx] = { ...attendance[realIdx], checkOut: FabData.fmtHHMM(now) };
        }
      }

      return { ...s, members, attendance };
    });
    setCheckedInMemberId(memberId);
  }
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:5000`. Open the check-in popover (top bar "Check in" button).

1. Click a member's toggle to check them in.
2. In DevTools console:
```js
const s = JSON.parse(localStorage.getItem('fablab_utp_v3'));
s.members.find(m => m.checkedIn)       // → member object with checkedInAt set to ISO string
s.attendance                            // → [{ memberId, date, checkIn: "HH:MM", checkOut: null }]
```
3. Click the same member's toggle to check them out.
```js
const s2 = JSON.parse(localStorage.getItem('fablab_utp_v3'));
s2.members.find(m => m.id === <same id>).checkedIn    // → false
s2.members.find(m => m.id === <same id>).checkedInAt  // → null
s2.attendance[s2.attendance.length - 1].checkOut       // → "HH:MM"
```

- [ ] **Step 3: Commit**

```bash
git add app/main.jsx
git commit -m "feat: checkIn — write checkedInAt and attendance log entries"
```

---

### Task 5: board.jsx — time chip in check-in popover rows

**Files:**
- Modify: `app/board.jsx`

- [ ] **Step 1: Add chip between name and status in popover rows**

In `app/board.jsx`, inside `TopBar`, find the `.checkin-row` return:
```jsx
                return (
                  <div key={m.id} className="checkin-row">
                    <Avatar member={m} size="sm" />
                    <span className="nm">{m.name || m.id}</span>
                    <span className="status">{status}</span>
                    <button
                      className={`checkin-toggle ${m.checkedIn ? 'in' : 'out'}`}
                      onClick={() => handleToggle(m.id)}
                    >
                      {m.checkedIn ? t('checkin.in', lang) : t('checkin.out', lang)}
                    </button>
                  </div>
```
Replace with:
```jsx
                return (
                  <div key={m.id} className="checkin-row">
                    <Avatar member={m} size="sm" />
                    <span className="nm">{m.name || m.id}</span>
                    {m.checkedIn && m.checkedInAt && (
                      <span className="checkin-time-chip">
                        {new Date(m.checkedInAt).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    )}
                    <span className="status">{status}</span>
                    <button
                      className={`checkin-toggle ${m.checkedIn ? 'in' : 'out'}`}
                      onClick={() => handleToggle(m.id)}
                    >
                      {m.checkedIn ? t('checkin.in', lang) : t('checkin.out', lang)}
                    </button>
                  </div>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:5000`. Open the check-in popover.

1. Check in a member (click their toggle).
2. Close and reopen the popover — the checked-in member's row now shows a green pill badge between their name and status with the entry time (e.g. `14:35`).
3. Checked-out members have no badge.
4. Switch language to Español (Admin → Language → Español) and verify the time still formats correctly.

- [ ] **Step 3: Commit**

```bash
git add app/board.jsx
git commit -m "feat: topbar — show check-in time chip for present members"
```

---

### Task 6: admin.jsx — `AttendancePanel` component and wiring

**Files:**
- Modify: `app/admin.jsx`

- [ ] **Step 1: Add `AttendancePanel` component**

In `app/admin.jsx`, find the line just above the `Admin` top-level function:
```js
// ---------------------------------------------------------------------------
// Admin — top-level admin panel with all sections
// ---------------------------------------------------------------------------
function Admin({ state, setState, onClose }) {
```
Insert the entire `AttendancePanel` component before that block:
```jsx
// ---------------------------------------------------------------------------
// AttendancePanel — daily check-in / check-out log
// ---------------------------------------------------------------------------
function AttendancePanel({ state, lang }) {
  const [attendanceDate, setAttendanceDate] = React.useState(FabData.todayStr());

  const entries = (state.attendance || []).filter(e => e.date === attendanceDate);
  const presentMemberIds = new Set(entries.map(e => e.memberId));
  const absentMembers = (state.members || []).filter(m => !presentMemberIds.has(m.id));

  function getMember(id) {
    return (state.members || []).find(m => m.id === id);
  }

  function calcDurationMins(checkIn, checkOut) {
    if (!checkOut) return null;
    const [h1, m1] = checkIn.split(':').map(Number);
    const [h2, m2] = checkOut.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins < 0) mins += 1440;
    return mins;
  }

  function fmtDur(checkIn, checkOut) {
    const mins = calcDurationMins(checkIn, checkOut);
    if (mins === null) return t('admin.attendance_ongoing', lang);
    return FabData.fmtDuration(mins * 60000);
  }

  const escCSV = val => '"' + (val || '').toString().replace(/"/g, '""') + '"';

  const exportCSV = () => {
    const header = ['fecha', 'miembro', 'entrada', 'salida', 'duracion_min'];
    const rows = [header];
    entries.forEach(e => {
      const member = getMember(e.memberId);
      const mins = calcDurationMins(e.checkIn, e.checkOut);
      rows.push([
        attendanceDate,
        escCSV(member ? member.name : e.memberId),
        e.checkIn || '',
        e.checkOut || '',
        mins !== null ? mins : t('admin.attendance_ongoing', lang),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-asistencia-' + attendanceDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('admin.attendance_title', lang)}</h3>
        <p>{t('admin.attendance_desc', lang)}</p>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {t('admin.attendance_date', lang)}
          </label>
          <input
            type="date"
            className="input"
            value={attendanceDate}
            onChange={e => setAttendanceDate(e.target.value)}
            style={{ width: 160, height: 36 }}
          />
        </div>

        {entries.length === 0 && absentMembers.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('admin.attendance_empty', lang)}</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th></th>
                <th>↓ {t('admin.attendance_entry', lang)}</th>
                <th>↑ {t('admin.attendance_exit', lang)}</th>
                <th>{t('admin.attendance_duration', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const member = getMember(e.memberId);
                const isActive = !e.checkOut;
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {member && <Avatar member={member} size="sm" />}
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {member ? member.name : e.memberId}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--ok)', fontWeight: 700 }}>{e.checkIn}</td>
                    <td style={{ color: isActive ? 'var(--text-3)' : 'var(--p-high)', fontWeight: isActive ? 400 : 700 }}>
                      {isActive ? t('admin.attendance_active', lang) : e.checkOut}
                    </td>
                    <td style={{ color: isActive ? 'var(--text-3)' : 'var(--text-2)', fontSize: 13 }}>
                      {fmtDur(e.checkIn, e.checkOut)}
                    </td>
                  </tr>
                );
              })}
              {absentMembers.map(m => (
                <tr key={m.id} style={{ opacity: 0.4 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar member={m} size="sm" />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                    </div>
                  </td>
                  <td colSpan={3} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {t('admin.attendance_absent', lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {entries.length > 0 && (
          <button className="btn btn-accent" onClick={exportCSV} style={{ marginTop: 14 }}>
            {t('admin.attendance_export', lang)}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `AttendancePanel` into the Admin JSX**

In `app/admin.jsx`, find the comment and opening of the Export panel:
```jsx
          {/* ---- Export data ------------------------------------------- */}
          <div className="panel">
```
Insert the `AttendancePanel` call on the line immediately before that comment:
```jsx
          {/* ---- Attendance log ---------------------------------------- */}
          <AttendancePanel state={state} lang={lang} />

          {/* ---- Export data ------------------------------------------- */}
          <div className="panel">
```

- [ ] **Step 3: Verify in browser — empty state**

Reload `http://localhost:5000`. Open Admin (settings icon → password `admin`).
Scroll to the new **Attendance** panel (between Archive and Export).
- Panel renders with title "Attendance" (EN) or "Asistencia" (ES).
- Day selector shows today's date.
- Body shows "No attendance records for this day." (no data yet).

- [ ] **Step 4: Verify in browser — with data**

1. Close admin. Check in 2–3 members via the top-bar popover.
2. Re-open admin. Scroll to Attendance panel.
3. Today's date is selected — checked-in members appear in the table with green entry times and "— active" / "en curso" in the exit column.
4. Check out one member. Reload admin. That row now shows a red exit time and a calculated duration (e.g. `5m`).
5. All members NOT in the attendance list for today appear at the bottom in gray with "Sin check-in hoy".
6. Click **Export attendance CSV** — a file `fablab-asistencia-YYYY-MM-DD.csv` downloads with correct columns.
7. Switch language to Español — panel titles, column headers, and status strings update.

- [ ] **Step 5: Verify edge case — absent members list when no entries**

Navigate the date selector to a past date with no records. The table still shows all members in the "absent" gray rows. The Export button is hidden (only shows when `entries.length > 0`).

- [ ] **Step 6: Commit**

```bash
git add app/admin.jsx
git commit -m "feat: admin — add AttendancePanel with day selector, table, and CSV export"
```
