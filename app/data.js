/* ============================================================
   FABLAB UTP — mock data layer (stands in for SQLite)
   Persisted to localStorage under a versioned key.

   v3 — adds: configurable machine types, idle timeout,
   board name editing. MACHINES/MACHINE_ORDER are now mutable
   objects — components see updates through their references.
   ============================================================ */
(function () {
  const STORAGE_KEY = "fablab_utp_v3";

  // ---- machine definitions (mutable — syncMachines updates these) ------
  const MACHINES = {};
  const MACHINE_ORDER = [];

  // ---- seed machines (real hex colours, NOT CSS vars) ------------------
  const SEED_MACHINES = [
    { id: "laser",  label: "Laser",       color: "#e23c34", icon: "ti-flame" },
    { id: "print",  label: "3D Print",    color: "#2b7fd4", icon: "ti-cube" },
    { id: "cnc",    label: "CNC",         color: "#7c5cfc", icon: "ti-router" },
    { id: "elec",   label: "Electronics", color: "#25a04a", icon: "ti-cpu" },
    { id: "soft",   label: "Software",    color: "#0e9da0", icon: "ti-code" },
  ];

  // Icon options shown in the admin machine editor
  const MACHINE_ICONS = [
    "ti-flame", "ti-cube", "ti-3d-cube-sphere", "ti-router",
    "ti-cpu", "ti-code", "ti-scissors", "ti-tool",
    "ti-pencil", "ti-camera", "ti-vinyl", "ti-music",
    "ti-brush", "ti-plant", "ti-building-factory",
  ];

  // ---- columns ---------------------------------------------------------
  const COLUMNS = [
    { id: "backlog",    label: "Backlog",     color: "var(--text-3)" },
    { id: "ready",      label: "Ready",       color: "var(--m-print)" },
    { id: "inprogress", label: "In Progress", color: "var(--accent)" },
    { id: "done",       label: "Done",        color: "var(--ok)" },
  ];

  const AVATAR_COLORS = [
    "#2b7fd4", "#25a04a", "#7c5cfc", "#e23c34",
    "#0e9da0", "#c2255c", "#f0a017", "#495057",
  ];

  // ---- sync global machines from state ---------------------------------
  function syncMachines(machines) {
    // Clear existing keys from the mutable MACHINES object
    var keys = Object.keys(MACHINES);
    for (var i = 0; i < keys.length; i++) delete MACHINES[keys[i]];
    // Populate from the given array
    for (var j = 0; j < machines.length; j++) {
      var m = machines[j];
      MACHINES[m.id] = m;
    }
    // Update MACHINE_ORDER in-place
    MACHINE_ORDER.length = 0;
    for (var k = 0; k < machines.length; k++) {
      MACHINE_ORDER.push(machines[k].id);
    }
  }

  // ---- seed members ----------------------------------------------------
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

  // ---- seed cards ------------------------------------------------------
  const seedCards = [
    // backlog
    { id: "c1", col: "backlog", title: "Laser-cut enclosure panels", desc: "3mm acrylic, 4 side panels + lid for the air-quality sensor box.", priority: "high", machine: "laser", owner: "m3", estMin: 45, createdMin: 95 },
    { id: "c2", col: "backlog", title: "Design PCB for sensor node", desc: "Route the ESP32 carrier board, add USB-C and battery JST.", priority: "mid", machine: "elec", owner: "m5", estMin: 120, createdMin: 180 },
    { id: "c3", col: "backlog", title: "Model replacement gear in CAD", desc: "Reverse-engineer the broken 18-tooth gear from the label printer.", priority: "low", machine: "soft", owner: "m7", estMin: 60, createdMin: 240 },
    { id: "c4", col: "backlog", title: "Update lab safety signage", desc: "Refresh laser + soldering station warning posters for the new layout.", priority: "low", machine: null, owner: "m1", estMin: 30, createdMin: 320 },
    // ready
    { id: "c5", col: "ready", title: "Print prototype bracket v3", desc: "PETG, 40% infill. Reinforced mounting tab from last review.", priority: "mid", machine: "print", owner: "m5", estMin: 180, createdMin: 60 },
    { id: "c6", col: "ready", title: "Engrave wooden name tags", desc: "Batch of 24 birch tags for the weekend workshop attendees.", priority: "low", machine: "laser", owner: "m7", estMin: 45, createdMin: 130 },
    { id: "c7", col: "ready", title: "Mill aluminum mounting plate", desc: "6061 stock, 4 holes + pocket. Fixture is already set up.", priority: "high", machine: "cnc", owner: "m2", estMin: 90, createdMin: 200 },
    // in progress
    { id: "c8", col: "inprogress", title: "CNC cut acrylic dashboard sign", desc: "Reception wayfinding sign, 600x200mm.", priority: "mid", machine: "cnc", owner: "m2", estMin: 175, startedMin: 95 },
    { id: "c9", col: "inprogress", title: "Solder LED driver board", desc: "Hand-place 0805 passives, then reflow the driver IC.", priority: "high", machine: "elec", owner: "m4", estMin: 90, startedMin: 38 },
    { id: "c10", col: "inprogress", title: "3D print drone frame", desc: "Carbon-fill nylon, full arm set. Long job.", priority: "mid", machine: "print", owner: "m1", estMin: 180, startedMin: 142 },
    // done (today)
    { id: "c11", col: "done", title: "Laser-cut gift boxes", desc: "Run of 30 finger-joint boxes for the open-day giveaway.", priority: "mid", machine: "laser", owner: "m3", estMin: 60, doneMin: 40 },
    { id: "c12", col: "done", title: "Flash firmware to controllers", desc: "Batch-flashed 12 motor controllers with v2.4.", priority: "low", machine: "soft", owner: "m4", estMin: 30, doneMin: 115 },
    { id: "c13", col: "done", title: "Print spare clips batch", desc: "PLA, 50 cable clips for the workbenches.", priority: "low", machine: "print", owner: "m1", estMin: 90, doneMin: 190 },
    { id: "c14", col: "done", title: "Cut gasket seals", desc: "Rubber sheet, 8 custom gaskets for the vacuum former.", priority: "mid", machine: "cnc", owner: "m7", estMin: 45, doneMin: 260 },
  ];

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function buildSeed() {
    var now = Date.now();
    var todayStr = new Date(now).toISOString().slice(0, 10);
    var cards = seedCards.map(function (c) {
      var card = Object.assign({}, c);
      card.createdAt = now - (c.createdMin || c.startedMin || c.doneMin || 0) * 60000;
      if (c.startedMin != null) card.startedAt = now - c.startedMin * 60000;
      if (c.doneMin != null) card.completedAt = now - c.doneMin * 60000;
      delete card.createdMin; delete card.startedMin; delete card.doneMin;
      return card;
    });
    var machines = clone(SEED_MACHINES);
    syncMachines(machines);
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
  }

  function buildEmpty(machinesArray, lang) {
    var machines = (machinesArray || []).map(function (m) { return Object.assign({}, m); });
    syncMachines(machines);
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
  }

  // ---- persist ---------------------------------------------------------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      // Migrate from v2 if v3 key is missing
      if (!raw) {
        raw = localStorage.getItem("fablab_utp_v2");
      }
      if (raw) {
        var state = JSON.parse(raw);
        // Migrations
        if (!state.archived) state.archived = [];
        if (!state.lastReset) state.lastReset = "";
        if (!state.machines || !state.machines.length) state.machines = clone(SEED_MACHINES);
        if (!state.idleMinutes) state.idleMinutes = 3;
        if (!state.lang) state.lang = "en";
        // Convert CSS-var colours to hex on existing machines
        (state.machines || []).forEach(function (m) {
          if (m.color && m.color.indexOf("var(") === 0) {
            var found = SEED_MACHINES.find(function (s) { return s.id === m.id; });
            if (found) m.color = found.color;
          }
        });
        // Ensure all cards have estMin
        (state.cards || []).forEach(function (c) { if (!c.estMin) c.estMin = 120; });
        // Sync globals so components see the loaded machines
        syncMachines(state.machines);
        save(state);
        return state;
      }
    } catch (e) { /* ignore */ }
    var seed = buildSeed();
    save(seed);
    return seed;
  }

  function save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  }

  // ---- helpers ---------------------------------------------------------
  function fmtDuration(ms) {
    var mins = Math.max(0, Math.floor(ms / 60000));
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  }

  function fmtAgo(ts, now) {
    var mins = Math.max(0, Math.floor((now - ts) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    var h = Math.floor(mins / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function progressOf(card, now) {
    if (!card.startedAt || !card.estMin) return 0;
    var elapsed = now - card.startedAt;
    var total = card.estMin * 60000;
    return Math.min(100, Math.round((elapsed / total) * 100));
  }

  function uid() { return "x" + Math.random().toString(36).slice(2, 9); }

  // ---- overdue / stale helpers -----------------------------------------
  function isOverdue(card, now) {
    if (card.col !== "inprogress" || !card.startedAt || !card.estMin) return false;
    return (now - card.startedAt) > card.estMin * 60000;
  }

  function overdueMins(card, now) {
    if (!isOverdue(card, now)) return 0;
    var elapsed = now - card.startedAt;
    var estimated = card.estMin * 60000;
    return Math.floor((elapsed - estimated) / 60000);
  }

  function isStaleBacklog(card, now) {
    if (card.col !== "backlog") return false;
    return (now - card.createdAt) > 3 * 24 * 60 * 60 * 1000;
  }

  function isReadyNudged(card, now) {
    if (card.col !== "ready") return false;
    return (now - card.createdAt) > 24 * 60 * 60 * 1000;
  }

  // ---- daily reset -----------------------------------------------------
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function archiveDoneCards(state) {
    var today = todayStr();
    var doneCards = state.cards.filter(function (c) { return c.col === "done"; });
    if (doneCards.length === 0) return state;
    var activeCards = state.cards.filter(function (c) { return c.col !== "done"; });
    var archived = state.archived || [];
    archived.push({ date: state.lastReset || today, cards: doneCards });
    return Object.assign({}, state, {
      cards: activeCards,
      archived: archived,
      lastReset: today,
    });
  }

  function getTodayDone(state) {
    var today = todayStr();
    return state.cards.filter(function (c) {
      return c.col === "done" && c.completedAt &&
        new Date(c.completedAt).toISOString().slice(0, 10) === today;
    });
  }

  // ---- exposed API -----------------------------------------------------
  window.FabData = {
    MACHINES: MACHINES,
    MACHINE_ORDER: MACHINE_ORDER,
    SEED_MACHINES: SEED_MACHINES,
    MACHINE_ICONS: MACHINE_ICONS,
    COLUMNS: COLUMNS,
    AVATAR_COLORS: AVATAR_COLORS,
    load: load,
    save: save,
    reset: reset,
    buildEmpty: buildEmpty,
    syncMachines: syncMachines,
    fmtDuration: fmtDuration,
    fmtAgo: fmtAgo,
    progressOf: progressOf,
    uid: uid,
    isOverdue: isOverdue,
    overdueMins: overdueMins,
    isStaleBacklog: isStaleBacklog,
    isReadyNudged: isReadyNudged,
    todayStr: todayStr,
    archiveDoneCards: archiveDoneCards,
    getTodayDone: getTodayDone,
  };
})();
