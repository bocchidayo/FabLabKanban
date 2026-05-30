# Design: Tutorial Check-in Step

**Date:** 2026-05-30
**Branch:** feat/checkin-features

---

## Overview

Add a dedicated Step 4 to the tutorial that spotlights the check-in button and explains the check-in action. The tutorial grows from 7 to 8 steps. Existing steps 4–7 are renumbered to 5–8. Step 3 (Member Strip) is also tightened to focus on reading presence status only, since the action is now in Step 4.

---

## 1. New step sequence

| # | Title (EN) | Title (ES) | Selector | Fallback | Position |
|---|-----------|-----------|----------|----------|----------|
| 1 | The Board | El Tablero | `.board` | `.app` | center |
| 2 | Reading a Card | Leyendo una Tarjeta | `.column-body .card:first-child` | `.board` | right |
| 3 | Member Strip | Tira de Miembros | `.member-strip` | `.topbar` | below |
| **4** | **Check-in** | **Registro de presencia** | **`.popover-wrap`** | **`.topbar`** | **below** |
| 5 | Creating a Card | Creando una Tarjeta | `.add-task:first-of-type` | `.column-body:first-of-type` | above |
| 6 | Moving Cards | Moviendo Tarjetas | `.column-body:nth-of-type(2) .card:first-child` | `.board` | right |
| 7 | Claim & Start | Tomar y Empezar | `.claim-btn:first-of-type` | `.column-body:nth-of-type(2)` | right |
| 8 | The Screensaver | El Salvapantallas | `.board` | `.app` | center |

---

## 2. Changes to `app/tutorial.jsx`

Insert a new step object at index 3 (0-based) in the `STEPS` array, after the current step 3 entry:

```js
    {
      title: t('tut.step4_title', lang),
      selector: ".popover-wrap",
      fallback: ".topbar",
      position: "below",
      text: t('tut.step4_text', lang),
    },
```

No other changes to `tutorial.jsx`. The `STEPS.length` reference and dynamic key resolution (`'tut.step' + (step+1)`) automatically handle the new count.

---

## 3. Changes to `app/i18n.js`

### 3a. Rename existing step keys 4→5, 5→6, 6→7, 7→8

The following existing entries must be renamed (key only, values unchanged):

| Old key | New key |
|---------|---------|
| `tut.step4_title` | `tut.step5_title` |
| `tut.step4_text` | `tut.step5_text` |
| `tut.step5_title` | `tut.step6_title` |
| `tut.step5_text` | `tut.step6_text` |
| `tut.step6_title` | `tut.step7_title` |
| `tut.step6_text` | `tut.step7_text` |
| `tut.step7_title` | `tut.step8_title` |
| `tut.step7_text` | `tut.step8_text` |

### 3b. Update step 3 text (remove action description, keep reading-only)

Current `tut.step3_text`:
```
en: "See who's in the lab at a glance. <strong>Green dot</strong> = free, <strong>orange dot</strong> = busy on a job, <strong>grayed out</strong> = not checked in. Click the <strong>Check in</strong> button in the top bar to toggle your status — your busy/free state is inferred from your active cards."
es: "Ve quién está en el laboratorio de un vistazo. <strong>Punto verde</strong> = libre, <strong>punto naranja</strong> = ocupado, <strong>atenuado</strong> = no registrado. Haz clic en <strong>Registrarse</strong> en la barra superior para cambiar tu estado — tu estado se deduce de tus tarjetas activas."
```

Replace with:
```
en: "See who's in the lab at a glance. <strong>Green dot</strong> = free, <strong>orange dot</strong> = busy on a job, <strong>grayed out</strong> = not checked in. The board uses this to know who's available for new work."
es: "Ve quién está en el laboratorio de un vistazo. <strong>Punto verde</strong> = libre, <strong>punto naranja</strong> = ocupado, <strong>atenuado</strong> = no registrado. El tablero usa esto para saber quién está disponible para nuevo trabajo."
```

Also update the title to remove "& Check-in":
```
en: "Member Strip"
es: "Tira de Miembros"
```

### 3c. Add new step 4 keys

Insert after the updated `tut.step3_text` entry:

```js
    "tut.step4_title": { en: "Check-in",                   es: "Registro de presencia" },
    "tut.step4_text":  {
      en: "The <strong>Check-in button</strong> in the top bar shows how many members are currently in the lab. Click it to open the presence list — tap any name to toggle that person <strong>in</strong> or <strong>out</strong>. Checked-in members appear active on the board; their free/busy status is inferred automatically from their active cards.",
      es: "El <strong>botón de registro</strong> en la barra superior muestra cuántos miembros están en el lab ahora mismo. Haz clic para abrir la lista de presencia — toca un nombre para registrarlo como <strong>dentro</strong> o <strong>fuera</strong>. Los miembros registrados aparecen activos en el tablero; su estado libre/ocupado se deduce automáticamente de sus tarjetas activas."
    },
```

---

## 4. Out of scope

- No changes to tutorial positioning logic, CSS, or animation
- No changes to any other tutorial navigation (dots, back/next buttons)
- Steps 1, 2, 5, 6, 7, 8 text and selectors are unchanged (only renumbered keys for 5-8)
