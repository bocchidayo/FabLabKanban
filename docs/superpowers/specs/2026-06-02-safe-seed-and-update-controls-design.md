# Safe Seed Init & Update Controls — Design Spec

**Date:** 2026-06-02
**Branch:** feat/checkin-features
**Status:** Approved

## Problem

`FabData.load()` falls back to `buildSeed()` when `localStorage` is empty. Any scenario that clears storage — new browser profile, future storage-key bump, accidental wipe — auto-populates the board with fake demo data (8 dummy members, sample machines, demo cards). On a Raspberry Pi / nginx installation this is dangerous: an admin running `git pull` then doing a hard reload in a fresh browser session would silently replace real lab data with seed data.

## Goals

1. New installs start empty — no auto-seeding.
2. An admin on a genuinely new install can opt-in to demo data via a UI button.
3. After `git pull`, the admin has a clear, labeled button to reload the app; the design makes it explicit that browser storage is never touched by code updates.

## Non-Goals

- No backend / git automation — the Pi stays pure static nginx.
- No changes to the existing migration path in `load()`.
- No removal of the existing "Reset demo data" / "Start Fresh" danger buttons (different purpose).

---

## Section 1 — Data Layer (`data.js`)

### Change: `load()` fallback

**Before:**
```js
var seed = buildSeed();
save(seed);
return seed;
```

**After:**
```js
var empty = buildEmpty();
save(empty);
return empty;
```

`buildSeed()` is unchanged and remains exposed on `window.FabData` for the admin button.

### New export: `isNewInstall(state)`

```js
function isNewInstall(state) {
  return (!state.members || state.members.length === 0) &&
         (!state.cards   || state.cards.length   === 0);
}
```

Returns `true` when both members and cards are empty. Machines are excluded from the check — `buildEmpty()` ships machines by default, so their presence alone does not indicate real data.

Exposed as `window.FabData.isNewInstall`.

---

## Section 2 — Admin UI (`admin.jsx`)

### New "System" panel

Added below the Export panel at the bottom of the admin scroll area.

```
┌─ System ───────────────────────────────────────────────────────┐
│ Initialization and update controls.                            │
│                                                                │
│ [Initialize Demo Data]   ← only shown when isNewInstall()     │
│                                                                │
│ [Reload App]             ← always visible                     │
│   After running `git pull` on the Pi, click this to apply     │
│   updates. Your data is safe — code updates never touch        │
│   browser storage.                                             │
└────────────────────────────────────────────────────────────────┘
```

### "Initialize Demo Data" button

| Property | Value |
|---|---|
| Visibility | `FabData.isNewInstall(state) === true` only |
| Style | `btn btn-accent` (not red — intentional, safe action) |
| Confirmation | "This will populate the board with demo members, machines, and cards. Only use on a new installation. Continue?" |
| On confirm | `FabData.buildSeed()` → `FabData.save()` → `setState()` |
| On cancel | No-op |

Once real data exists (any member or card added), the button disappears.

### "Reload App" button

| Property | Value |
|---|---|
| Visibility | Always |
| Style | `btn` (neutral) |
| Action | `window.location.reload()` |
| Label | i18n key `admin.reload_btn` |

No confirmation needed — a reload is low-risk and reversible.

---

## Section 3 — i18n (`i18n.js`)

New keys added to both `en` and `es` locales:

| Key | English | Spanish |
|---|---|---|
| `admin.system_title` | "System" | "Sistema" |
| `admin.system_desc` | "Initialization and update controls." | "Controles de inicialización y actualización." |
| `admin.seed_btn` | "Initialize Demo Data" | "Inicializar datos de demostración" |
| `admin.seed_confirm` | "This will populate the board with demo members, machines, and cards. Only use on a new installation. Continue?" | "Esto llenará el tablero con miembros, máquinas y tarjetas de demostración. Úsalo solo en una instalación nueva. ¿Continuar?" |
| `admin.reload_btn` | "Reload App" | "Recargar aplicación" |
| `admin.reload_desc` | "After running \`git pull\` on the Pi, click this to apply updates. Your data is safe — code updates never touch browser storage." | "Después de ejecutar \`git pull\` en la Pi, haz clic aquí para aplicar las actualizaciones. Tus datos están seguros: las actualizaciones de código nunca tocan el almacenamiento del navegador." |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Admin deletes all members and cards | Seed button reappears — valid recovery path, confirmation dialog protects against accidents |
| Future storage key bump (v3 → v4) | `load()` now falls back to `buildEmpty()`, so no surprise seed data |
| Admin runs `git pull` then hard-reloads in a fresh browser | Empty board shown (no seed data), admin uses "Reload App" or navigates normally |
| Admin clicks "Initialize Demo Data" on a board with only machines | Guard passes (members=0, cards=0), demo data loads — acceptable since machines ship with buildEmpty anyway |

---

## Files Changed

| File | Change |
|---|---|
| `app/data.js` | `load()` fallback: `buildSeed()` → `buildEmpty()`; add + expose `isNewInstall()` |
| `app/admin.jsx` | Add System panel with guard-based Seed Init button and always-visible Reload button |
| `app/i18n.js` | Add 6 new keys (en + es) |
