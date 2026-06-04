const IDLE_MS = 3 * 60 * 1000;
const t = window.I18n ? window.I18n.t : function (k) { return k; };

function LoadingScreen() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", color: "var(--text-2)",
      font: "600 18px/1.4 Figtree, sans-serif" }}>
      Cargando… / Loading…
    </div>
  );
}

function ErrorScreen({ onRetry }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      gap: 16, alignItems: "center", justifyContent: "center", background: "var(--bg)",
      color: "var(--text-1)", textAlign: "center", padding: 24 }}>
      <div style={{ font: "700 20px/1.3 Figtree, sans-serif" }}>
        No se pudo conectar con el servicio de datos.<br />Could not reach the data service.
      </div>
      <button className="btn btn-accent" onClick={onRetry}>Reintentar / Retry</button>
    </div>
  );
}

function SchemaVersionScreen({ message }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      gap: 16, alignItems: "center", justifyContent: "center", background: "var(--bg)",
      color: "var(--text-1)", textAlign: "center", padding: 24 }}>
      <div style={{ font: "700 20px/1.3 Figtree, sans-serif" }}>
        Versión de datos incompatible.<br />Incompatible data version.
      </div>
      <div style={{ font: "400 15px/1.5 Figtree, sans-serif", color: "var(--text-2)",
        maxWidth: 480 }}>
        {message || "Actualiza la aplicación. / Update the application."}
      </div>
    </div>
  );
}

function App({ initialState }) {
  const [state, setState] = React.useState(initialState);
  const [screen, setScreen] = React.useState("board"); // "board" | "admin"
  const [filter, setFilter] = React.useState("all");
  const [modalCol, setModalCol] = React.useState(null); // null | columnId
  const [editingCard, setEditingCard] = React.useState(null); // null | card object
  const [saver, setSaver] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [selectedCardId, setSelectedCardId] = React.useState(null);
  const [checkedInMemberId, setCheckedInMemberId] = React.useState(null);
  const [cancellingCard, setCancellingCard] = React.useState(null);
  const [showCheatsheet, setShowCheatsheet] = React.useState(false);
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [undoToast, setUndoToast] = React.useState(null);

  // Persist state on every change (skip the first, freshly-loaded value)
  const firstSaveSkipped = React.useRef(false);
  React.useEffect(() => {
    if (!firstSaveSkipped.current) { firstSaveSkipped.current = true; return; }
    window.FabData.save(state);
  }, [state]);

  // Track save failures for the banner
  const [saveError, setSaveError] = React.useState(false);
  React.useEffect(() => {
    function onErr() { setSaveError(true); }
    function onOk() { setSaveError(false); }
    window.addEventListener("fabdata:saveerror", onErr);
    window.addEventListener("fabdata:saved", onOk);
    return () => {
      window.removeEventListener("fabdata:saveerror", onErr);
      window.removeEventListener("fabdata:saved", onOk);
    };
  }, []);

  // Live clock — ticks every second
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- BATCH 3: Daily reset check ----
  // Check every 60 seconds if the calendar day changed vs state.lastReset
  React.useEffect(() => {
    function checkReset() {
      const today = FabData.todayStr();
      if (state.lastReset && state.lastReset !== today) {
        const now = new Date();
        setState(s => FabData.performDailyReset(s, now));
      }
    }
    checkReset();
    const t = setInterval(checkReset, 60000);
    return () => clearInterval(t);
  }, [state.lastReset]);

  // ---- BATCH 1: Auto-fullscreen on load ----
  React.useEffect(() => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      }
    } catch (e) {}
  }, []);

  // Listen for fullscreen change events to keep isFullscreen in sync
  React.useEffect(() => {
    function onFS() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  // ---- BATCH 1: Idle detection for screensaver ----
  const idleRef = React.useRef(null);
  const undoTimerRef = React.useRef(null);
  React.useEffect(() => {
    const IDLE_MS = (state.idleMinutes || 3) * 60 * 1000;
    function reset() {
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => setSaver(true), IDLE_MS);
    }
    const evts = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"];
    if (!saver) {
      evts.forEach(e => window.addEventListener(e, reset, { passive: true }));
      reset();
    }
    return () => { evts.forEach(e => window.removeEventListener(e, reset)); clearTimeout(idleRef.current); };
  }, [saver, state.idleMinutes]);

  // ---- BATCH 2: Keyboard shortcuts ----
  React.useEffect(() => {
    function onKey(e) {
      // Never intercept when typing in inputs
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      // Don't intercept when modal, admin, or screensaver is open (except Esc and S)
      const hasModal = modalCol || editingCard || showCheatsheet || showTutorial;

      if (e.key === "?") {
        e.preventDefault();
        setShowTutorial(true);
        return;
      }

      if (e.key === "h") {
        e.preventDefault();
        setShowCheatsheet(s => !s);
        return;
      }

      if (showCheatsheet) {
        if (e.key === "Escape") { setShowCheatsheet(false); }
        return;
      }

      if (e.key === "Escape") {
        if (editingCard) { setEditingCard(null); return; }
        if (modalCol) { setModalCol(null); return; }
        if (saver) { setSaver(false); return; }
        return;
      }

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSaver(true);
        return;
      }

      if (hasModal || saver || screen === "admin") return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setModalCol("backlog");
        return;
      }

      // Number keys 1-6 for filter
      const filterMap = { "1": "all", "2": "laser", "3": "print", "4": "cnc", "5": "elec", "6": "soft" };
      if (filterMap[e.key]) {
        e.preventDefault();
        setFilter(filterMap[e.key]);
        return;
      }

      // Arrow keys: move selected card
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && selectedCardId) {
        e.preventDefault();
        const card = state.cards.find(c => c.id === selectedCardId);
        if (!card) return;
        const colIdx = FabData.COLUMNS.findIndex(c => c.id === card.col);
        const newIdx = e.key === "ArrowLeft" ? colIdx - 1 : colIdx + 1;
        if (newIdx < 0 || newIdx >= FabData.COLUMNS.length) return;
        moveCard(selectedCardId, FabData.COLUMNS[newIdx].id, null);
        return;
      }

      // Enter: edit selected card
      if (e.key === "Enter" && selectedCardId) {
        e.preventDefault();
        const card = state.cards.find(c => c.id === selectedCardId);
        if (card) setEditingCard(card);
        return;
      }

      // Tab: cycle selection within current column
      if (e.key === "Tab") {
        e.preventDefault();
        const visible = filter === "all" ? state.cards : state.cards.filter(c => c.machine === filter);
        if (selectedCardId) {
          const current = state.cards.find(c => c.id === selectedCardId);
          if (current) {
            const colCards = visible.filter(c => c.col === current.col);
            const ci = colCards.findIndex(c => c.id === selectedCardId);
            const next = e.shiftKey ? ci - 1 : ci + 1;
            if (next >= 0 && next < colCards.length) {
              setSelectedCardId(colCards[next].id);
            }
          }
        } else {
          // Select first card in first non-empty column
          for (const col of FabData.COLUMNS) {
            const colCards = visible.filter(c => c.col === col.id);
            if (colCards.length > 0) {
              setSelectedCardId(colCards[0].id);
              break;
            }
          }
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalCol, editingCard, showCheatsheet, saver, screen, selectedCardId, filter, state.cards]);

  // ---- Actions ----
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

  function createCard(data) {
    const card = {
      id: FabData.uid(),
      col: data.col, title: data.title, desc: data.desc,
      priority: data.priority, machine: data.machine, owner: data.owner,
      assistants: data.assistants || [],
      estMin: data.estMin || 120,
      createdAt: Date.now(),
    };
    if (data.col === "inprogress") { card.startedAt = Date.now(); }
    if (data.col === "done") card.completedAt = Date.now();
    setState(s => ({ ...s, cards: [card, ...s.cards] }));
    setModalCol(null);
  }

  function moveCard(cardId, targetCol, beforeId) {
    // Note: claimStart also calls moveCard internally — that path does NOT
    // trigger the undo toast. Do not add it without thinking through the
    // startedAt timestamp implications first.
    if (targetCol === 'done') {
      const card = state.cards.find(c => c.id === cardId);
      if (card) {
        pushUndoToast({
          type: 'done',
          cardId,
          prevCol: card.col,
          prevCompletedAt: null,
          prevStartedAt: card.col === 'inprogress' ? card.startedAt : undefined,
          label: t('undo.moved_to_done', state.lang).replace('{title}', card.title),
        });
      }
    }
    setState(s => {
      const cards = [...s.cards];
      const idx = cards.findIndex(c => c.id === cardId);
      if (idx < 0) return s;
      const [orig] = cards.splice(idx, 1);
      const moved = { ...orig };

      if (moved.col !== targetCol) {
        if (targetCol === "inprogress") {
          if (!moved.startedAt) moved.startedAt = Date.now();
          if (!moved.estMin) moved.estMin = 120;
        } else {
          delete moved.startedAt;
        }
        if (targetCol === "done") moved.completedAt = Date.now();
        else delete moved.completedAt;
        if (targetCol !== "backlog" && moved.scheduledFor) moved.scheduledFor = null;
        moved.col = targetCol;
      }

      let insertIdx = cards.length;
      if (beforeId) {
        const bi = cards.findIndex(c => c.id === beforeId);
        if (bi >= 0) insertIdx = bi;
      }
      cards.splice(insertIdx, 0, moved);
      return { ...s, cards };
    });
  }

  function editCard(cardId, updates) {
    setState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === cardId ? { ...c, ...updates } : c),
    }));
    setEditingCard(null);
  }

  async function handleWakeNow(cardId) {
    const newState = {
      ...state,
      cards: state.cards.map(c => c.id === cardId ? { ...c, scheduledFor: null } : c),
    };
    setState(newState);
    try {
      await FabData.saveNow(newState);
    } catch (e) {
      // saveNow failure is non-fatal — debounced save will retry
    }
  }

  function pushUndoToast(toast) {
    clearTimeout(undoTimerRef.current);
    const timerId = setTimeout(() => setUndoToast(null), 10_000);
    undoTimerRef.current = timerId;
    setUndoToast(toast);
  }

  function handleUndo() {
    clearTimeout(undoTimerRef.current);
    const toast = undoToast;
    setUndoToast(null);
    if (!toast) return;
    const card = state.cards.find(c => c.id === toast.cardId);
    if (!card) return; // card removed by concurrent action during toast window
    if (toast.type === 'wake') {
      setState(s => ({
        ...s,
        cards: s.cards.map(c =>
          c.id === toast.cardId ? { ...c, scheduledFor: toast.scheduledFor } : c
        ),
      }));
    } else if (toast.type === 'done') {
      setState(s => ({
        ...s,
        cards: s.cards.map(c =>
          c.id === toast.cardId
            ? {
                ...c,
                col: toast.prevCol,
                completedAt: toast.prevCompletedAt,
                ...(toast.prevStartedAt ? { startedAt: toast.prevStartedAt } : {}),
              }
            : c
        ),
      }));
    }
  }

  function archiveCompletedCard(s, card) {
    const overtime = !!(card.startedAt && card.completedAt && card.estMin &&
      (new Date(card.completedAt) - new Date(card.startedAt)) > card.estMin * 60000);
    const enriched = { ...card, overtime };
    const date = card.completedAt
      ? new Date(card.completedAt).toISOString().slice(0, 10)
      : FabData.todayStr();
    const completedTasks = [...(s.completedTasks || [])];
    const idx = completedTasks.findIndex(e => e.date === date);
    if (idx !== -1) {
      completedTasks[idx] = {
        ...completedTasks[idx],
        cards: [...(completedTasks[idx].cards || []), enriched],
      };
    } else {
      completedTasks.push({ date, cards: [enriched] });
    }
    return { ...s, cards: s.cards.filter(c => c.id !== card.id), completedTasks };
  }

  function deleteCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) { setEditingCard(null); return; }
    setEditingCard(null); // always close edit modal first
    if (card.col === 'done') {
      setState(s => archiveCompletedCard(s, card));
    } else {
      setCancellingCard(card); // opens CancelReasonModal
    }
  }

  function onConfirmCancel(cardId, reason) {
    const card = cancellingCard;
    if (!card || card.id !== cardId) { setCancellingCard(null); return; }
    const date = FabData.todayStr();
    const archived = { ...card, cancelReason: reason || '' };
    setState(s => {
      const cancelledTasks = [...(s.cancelledTasks || [])];
      const idx = cancelledTasks.findIndex(e => e.date === date);
      if (idx !== -1) {
        cancelledTasks[idx] = {
          ...cancelledTasks[idx],
          cards: [...(cancelledTasks[idx].cards || []), archived],
        };
      } else {
        cancelledTasks.push({ date, cards: [archived] });
      }
      return { ...s, cards: s.cards.filter(c => c.id !== cardId), cancelledTasks };
    });
    setCancellingCard(null);
  }

  function reassignCard(cardId, newOwnerId) {
    setState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === cardId ? { ...c, owner: newOwnerId } : c),
    }));
  }

  function claimStart(cardId) {
    if (!checkedInMemberId) {
      // No one checked in this session — move to In Progress without changing owner
      const card = state.cards.find(c => c.id === cardId);
      if (card) moveCard(cardId, "inprogress", null);
      return;
    }
    // Assign to the checked-in member and move to In Progress
    setState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === cardId ? { ...c, owner: checkedInMemberId } : c),
    }));
    moveCard(cardId, "inprogress", null);
  }

  return (
    <React.Fragment>
      {saveError && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
          background: "var(--danger, #e23c34)", color: "#fff", textAlign: "center",
          padding: "6px 12px", font: "600 13px/1.4 Figtree, sans-serif" }}>
          {t('app.save_failed', state.lang || 'es')}
        </div>
      )}
      <Board
        state={state} now={now} filter={filter} setFilter={setFilter}
        onCheckIn={checkIn}
        onAddTask={(col) => { setEditingCard(null); setModalCol(col); }}
        onOpenAdmin={() => setScreen("admin")}
        onPreviewSaver={() => setSaver(true)}
        onOpenTutorial={() => setShowTutorial(true)}
        onMoveCard={moveCard}
        onEditCard={(card) => { setModalCol(null); setEditingCard(card); }}
        onClaimStart={claimStart}
        isFullscreen={isFullscreen}
        onFullscreenToggle={toggleFullscreen}
        checkedInMemberId={checkedInMemberId}
        selectedCardId={selectedCardId}
        setSelectedCardId={setSelectedCardId}
      />

      {modalCol && (
        <CardModal
          state={state} defaultCol={modalCol}
          onClose={() => setModalCol(null)} onCreate={createCard}
        />
      )}

      {cancellingCard
        ? <CancelReasonModal
            card={cancellingCard}
            lang={state.lang || 'en'}
            onConfirm={onConfirmCancel}
            onClose={() => setCancellingCard(null)}
          />
        : editingCard
          ? <CardModal
              state={state} editingCard={editingCard}
              onClose={() => setEditingCard(null)}
              onSave={editCard}
              onDelete={deleteCard}
              onReassign={reassignCard}
              onWakeNow={handleWakeNow}
            />
          : null}

      {showCheatsheet && <Cheatsheet onClose={() => setShowCheatsheet(false)} lang={state.lang || 'en'} />}

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} lang={state.lang || 'en'} />}

      {screen === "admin" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, background: "var(--bg)" }}>
          <Admin state={state} setState={setState} onClose={() => setScreen("board")} />
        </div>
      )}

      {saver && <Screensaver state={state} now={now} onExit={() => setSaver(false)} />}
    </React.Fragment>
  );
}

function AppRoot() {
  const [phase, setPhase] = React.useState("loading"); // loading | ready | error | schema-error
  const [initial, setInitial] = React.useState(null);
  const [attempt, setAttempt] = React.useState(0);
  const [schemaError, setSchemaError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setSchemaError(null);
    window.FabData.load()
      .then(s => { if (!cancelled) { setInitial(s); setPhase("ready"); } })
      .catch(e => {
        if (!cancelled) {
          if (e.isSchemaVersionError) {
            setSchemaError(e.message);
            setPhase("schema-error");
          } else {
            setPhase("error");
          }
        }
      });
    return () => { cancelled = true; };
  }, [attempt]);

  if (phase === "loading") return <LoadingScreen />;
  if (phase === "schema-error") return <SchemaVersionScreen message={schemaError} />;
  if (phase === "error") return <ErrorScreen onRetry={() => setAttempt(a => a + 1)} />;
  return <App initialState={initial} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRoot />);
