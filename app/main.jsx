const IDLE_MS = 3 * 60 * 1000;

function App() {
  const [state, setState] = React.useState(() => window.FabData.load());
  const [screen, setScreen] = React.useState("board"); // "board" | "admin"
  const [filter, setFilter] = React.useState("all");
  const [modalCol, setModalCol] = React.useState(null); // null | columnId
  const [editingCard, setEditingCard] = React.useState(null); // null | card object
  const [saver, setSaver] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [selectedCardId, setSelectedCardId] = React.useState(null);
  const [checkedInMemberId, setCheckedInMemberId] = React.useState(null);
  const [showCheatsheet, setShowCheatsheet] = React.useState(false);
  const [showTutorial, setShowTutorial] = React.useState(false);

  // Persist state on every change
  React.useEffect(() => { window.FabData.save(state); }, [state]);

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
        setState(s => FabData.archiveDoneCards(s));
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

  function deleteCard(cardId) {
    setState(s => ({
      ...s,
      cards: s.cards.filter(c => c.id !== cardId),
    }));
    setEditingCard(null);
  }

  function reassignCard(cardId, newOwnerId) {
    setState(s => ({
      ...s,
      cards: s.cards.map(c => c.id === cardId ? { ...c, owner: newOwnerId } : c),
    }));
  }

  function claimStart(cardId) {
    // If no one is checked in, prompt to pick a member
    if (!checkedInMemberId) {
      const checkedIn = state.members.filter(m => m.checkedIn);
      if (checkedIn.length === 0) {
        // Just use the card's current owner
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          moveCard(cardId, "inprogress", null);
        }
        return;
      }
      // Use the first checked-in member
      const firstCheckedIn = checkedIn[0].id;
      setState(s => ({
        ...s,
        cards: s.cards.map(c => c.id === cardId ? { ...c, owner: firstCheckedIn } : c),
      }));
      moveCard(cardId, "inprogress", null);
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

      {editingCard && (
        <CardModal
          state={state} editingCard={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={editCard}
          onDelete={deleteCard}
          onReassign={reassignCard}
        />
      )}

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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
