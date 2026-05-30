# Design: Archive Date Filter + Clean Start

**Date:** 2026-05-30
**Branch:** feat/initial-kanban-app

---

## 1. Archive Date Filter

### What it does
Adds two optional `type="date"` inputs — "Desde / From" and "Hasta / To" — at the top of the archived tasks panel in the admin panel. The user can fill one or both to narrow the displayed entries.

### Where it lives
`app/admin.jsx` — inside the existing archive `<div className="panel">`, above the entry list.

### Filter logic
- Computed via a new `filteredArchiveEntries` variable derived from the existing `archiveEntries` memo.
- Comparison is direct ISO string comparison (`YYYY-MM-DD`), no date parsing needed.
- Rules:
  - Both empty → show all entries (existing behavior)
  - Only "From" filled → show entries where `entry.date >= from`
  - Only "To" filled → show entries where `entry.date <= to`
  - Both filled → show entries where `from <= entry.date <= to`
- A small `×` button clears both fields at once.

### State
Two `useState` hooks in the Admin component: `archiveFrom` and `archiveTo`, both initialized to `''`.

### i18n keys to add (`app/i18n.js`)
| Key | EN | ES |
|-----|----|----|
| `admin.archive_from` | From | Desde |
| `admin.archive_to` | To | Hasta |
| `admin.archive_clear` | Clear filter | Limpiar |
| `admin.archive_none` | No entries match the selected dates. | No hay tareas en el rango seleccionado. |

### CSS
A small `.archive-filter` row: `display: flex; align-items: center; gap: 8px; margin-bottom: 12px;` with `input[type="date"]` styled to match existing `.input` class. The `×` button uses `.btn` at reduced size.

---

## 2. Clean Start Button

### What it does
Adds a "Comenzar sin datos demo / Start fresh" button below the existing "Reset to demo data" button in the admin panel. It wipes all cards and members, resets lab name and idle timeout to defaults, but keeps the configured machine categories (user may have already customized them).

### `buildEmpty()` in `app/data.js`
New exported function alongside the existing `buildSeed()` and `reset()`. Returns a state object with:
- `cards: []`
- `members: []`
- `archived: []`
- `lab: "FabLab"` (default name)
- `idleMinutes: 3`
- `password: "admin"`
- `lang: "es"`
- `lastReset: today`
- `machines` / `MACHINES` / `MACHINE_ORDER`: **kept from current state** (passed in as argument)

Signature: `buildEmpty(machinesArray)` — receives `state.machines` (the plain array already in state) so machine config survives.

### `app/admin.jsx` changes
- New handler `handleStartFresh` that calls `confirm()` with a bilingual warning, then calls `buildEmpty(state.machines)`, updates state and clears `passwordValue`.
- Button placed immediately after the existing Reset button, visually distinct (uses `.btn` with red color like Reset, but different label).

### i18n keys to add
| Key | EN | ES |
|-----|----|----|
| `admin.fresh_btn` | Start fresh | Comenzar sin datos demo |
| `admin.fresh_confirm` | This will delete ALL members and tasks and cannot be undone. Machine categories will be kept. Continue? | Esto eliminará TODOS los miembros y tareas y no se puede deshacer. Las categorías de máquinas se conservarán. ¿Continuar? |

---

## 3. README — First Deployment Section

### Content (bilingual, ES default)
A numbered checklist under a new `## Primer despliegue en producción` / `## First deployment` heading in the existing README. Steps:

1. Open the app in a browser (`http://localhost:5000` or the Pi's IP).
2. Click "Admin settings" in the top bar and enter the default password (`admin`).
3. Click **"Comenzar sin datos demo"** and confirm — removes all demo cards and members.
4. Go to "Lab settings": set the lab name and idle timeout.
5. Go to "Machine categories": adjust or keep the defaults.
6. Go to "Members": add the real team members (name, initials, avatar color).
7. Go to "Master password": change `admin` to a secure password.
8. Close admin — the board is ready to use.

Plain language, no technical assumptions, written for a lab coordinator not a developer.

---

## Out of scope
- No backend, no new files, no new components — only edits to existing `admin.jsx`, `data.js`, `i18n.js`, `styles.css`, and `README.md`.
- No pagination or server-side filtering — all data is already in memory.
- No export of filtered results (existing export always exports all archived data).
