# Schema Versioning & Additive-Only Policy

**Date:** 2026-06-03
**Status:** Approved

## Problem

`data.json` lives on the Pi between deploys. The current `migrate()` function fills
in missing fields with defaults (additive-only path), but has no guard against the
reverse: old code loading data that was written by newer code. A botched rollback, or
a policy violation that slips through code review, could silently mangle live data
with no indication to the user.

## Solution

Two complementary layers:

1. **Policy (CLAUDE.md)** — prevents the problem from occurring
2. **Runtime guard (`data.js`)** — safety net if policy is ever violated

---

## Layer 1: CLAUDE.md Policy

A "Data schema rules" section enforcing:

- Schema changes must be **additive-only**: new fields with a default in `migrate()`.
  Never rename, remove, restructure, or change the type of an existing field.
- **Bump `SCHEMA_VERSION`** whenever any schema change is made (additive or otherwise).
- Any change that would be breaking requires **stopping and flagging to the human**
  before touching the schema or `migrate()`.

---

## Layer 2: Runtime Guard

### Constant

```js
const SCHEMA_VERSION = 1;  // increment with every schema change
```

### migrate() — version check (top of function)

```js
function migrate(state) {
  if ((state.schemaVersion || 0) > SCHEMA_VERSION) {
    var err = new Error(
      'Schema v' + state.schemaVersion + ' is newer than this app (v' +
      SCHEMA_VERSION + '). Update the app before opening this data.'
    );
    err.isSchemaVersionError = true;
    throw err;
  }
  // ... existing additive defaults ...
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}
```

### buildEmpty() / buildSeed()

Both include `schemaVersion: SCHEMA_VERSION` in the returned state object.

### AppRoot — differentiated error screen

`load()` already propagates thrown errors to `AppRoot`. Add a check on the error:

- **Schema version error** (`err.isSchemaVersionError`): show the error message text
  ("Update the app") with **no Retry button** — retrying the load will not help.
- **All other load errors** (network, server down): existing Retry button behavior,
  unchanged.

---

## Direction Asymmetry (documented)

| Scenario | Handled by |
|---|---|
| Older file + newer code | `migrate()` fills missing fields with defaults — safe |
| Newer file + older code | `schemaVersion` guard throws before any data is touched |

---

## Files Changed

| File | Change |
|---|---|
| `CLAUDE.md` | Add "Data schema rules" section under Conventions |
| `app/data.js` | Add `SCHEMA_VERSION` constant; update `migrate()`, `buildEmpty()`, `buildSeed()` |
| `app/main.jsx` | Check `err.isSchemaVersionError` in `AppRoot` error state |

## Out of Scope

- Field-level type validation — the policy is the first line of defense; the version
  integer is the safety net. Runtime type-checking of every field adds complexity
  without meaningful benefit given the additive-only constraint.
- User-facing migration tooling — not needed while changes are additive-only.
