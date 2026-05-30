// Fablab Kanban Board — React 18 components
// Compiled by Babel standalone. All function components using hooks.

const {
  MACHINES, MACHINE_ORDER, COLUMNS,
  fmtDuration, fmtAgo, progressOf,
  isOverdue, overdueMins, isStaleBacklog, isReadyNudged,
} = window.FabData;

const t = window.I18n ? window.I18n.t : function(k) { return k; };

// ---------------------------------------------------------------------------
// Icon — renders a Tabler icon <i> element
// ---------------------------------------------------------------------------
function Icon({ name, className }) {
  return (
    <i className={`ti ti-${name} ${className || ''}`} aria-hidden="true" />
  );
}

// ---------------------------------------------------------------------------
// Avatar — colored circle with initials
// ---------------------------------------------------------------------------
function Avatar({ member, size = 'md' }) {
  if (!member) return null;

  const initials = (member.name || '')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('');

  return (
    <div
      className={`av ${size}`}
      style={{ backgroundColor: member.color || '#888' }}
      title={member.name}
    >
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MachineTag — pill tag for a machine type
// ---------------------------------------------------------------------------
function MachineTag({ id }) {
  const m = MACHINES[id || ''] || MACHINES[MACHINE_ORDER[0]];
  const bg = m.color + '1F'; // ~12% opacity

  return (
    <span
      className="tag"
      style={{ backgroundColor: bg, color: m.color, borderColor: 'transparent' }}
    >
      <Icon name={m.icon} />
      {' '}{m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// TopBar — brand, machine availability, check-in popover, controls
// ---------------------------------------------------------------------------
function TopBar({
  lab, members, cards, now, lang,
  onCheckIn, onAddTask, onOpenAdmin, onPreviewSaver,
  onFullscreenToggle, isFullscreen, onOpenTutorial,
  checkedInMemberId,
}) {
  const [popOpen, setPopOpen] = React.useState(false);
  const popRef = React.useRef(null);

  // Close popover on outside click
  React.useEffect(() => {
    if (!popOpen) return;
    function handle(e) {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setPopOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [popOpen]);

  // Machine availability — busy if any in-progress card uses this machine
  const machineBusy = React.useMemo(() => {
    const busy = {};
    MACHINE_ORDER.forEach((id) => { busy[id] = false; });
    (cards || []).forEach((c) => {
      if (c.col === 'inprogress' && c.machine) {
        busy[c.machine] = true;
      }
    });
    return busy;
  }, [cards]);

  // Checked-in count
  const checkedInCount = (members || []).filter((m) => m.checkedIn).length;

  // Toggle check-in for a member
  const handleToggle = (memberId) => {
    onCheckIn && onCheckIn(memberId);
  };

  return (
    <div className="topbar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">
          <Icon name="tools" />
        </div>
        <div>
          <div className="brand-name">{lab || 'Fablab'}</div>
          <div className="brand-sub">{t('board.subtitle', lang)}</div>
        </div>
      </div>

      {/* Machine availability badges */}
      {MACHINE_ORDER.map((id) => {
        const m = MACHINES[id];
        const busy = machineBusy[id];
        return (
          <div key={id} className={`avail${busy ? ' busy' : ''}`}>
            <span className="avail-badge">
              <Icon name={m.icon} />
              {' '}{m.label}
              <span className={`avail-dot ${busy ? 'busy' : 'free'}`} />
            </span>
          </div>
        );
      })}

      <div className="divider-v" />

      {/* Check-in popover */}
      <div className="popover-wrap" ref={popRef}>
        <button
          className="btn btn-accent"
          onClick={() => setPopOpen((p) => !p)}
        >
          <Icon name="user-check" />
          {' '}{t('board.checkin', lang)}
          {checkedInCount > 0 && <span className="count"> {t('board.checkin_count', lang).replace('{n}', checkedInCount)}</span>}
        </button>
        {popOpen && (
          <div className="popover">
            <div className="popover-head">
              <Icon name="users" /> {t('checkin.title', lang)}
            </div>
            <div className="popover-list">
              {(members || []).map((m) => {
                var busyIds = {};
                (cards || []).forEach(function (c) { if (c.col === 'inprogress') { busyIds[c.owner] = true; (c.assistants || []).forEach(function(id) { busyIds[id] = true; }); } });
                var status = !m.checkedIn
                  ? t('member.not_checked_in', lang)
                  : (busyIds[m.id] ? t('member.busy', lang) : t('member.free', lang));
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
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen toggle */}
      <button className="btn btn-icon fullscreen-toggle" onClick={onFullscreenToggle} title={t('button.fullscreen_title', lang)}>
        <Icon name={isFullscreen ? 'arrows-minimize' : 'arrows-maximize'} />
      </button>

      {/* How to use */}
      <button className="btn btn-icon" onClick={onOpenTutorial} title={t('button.help_title', lang)}>
        <Icon name="help-circle" />
      </button>

      {/* Preview screensaver */}
      <button className="btn btn-icon" onClick={onPreviewSaver} title={t('button.saver_title', lang)}>
        <Icon name="device-desktop" />
      </button>

      {/* Admin settings */}
      <button className="btn btn-icon" onClick={onOpenAdmin} title={t('button.admin_title', lang)}>
        <Icon name="settings" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberStrip — horizontal strip showing all members with task status
// ---------------------------------------------------------------------------
function MemberStrip({ members, cards, lang }) {
  // Build lookup: for each checked-in member, find their active card
  const memberTask = React.useMemo(() => {
    const map = {};
    (cards || []).forEach((c) => {
      if (c.col === 'inprogress') {
        if (c.owner) map[c.owner] = c;
        (c.assistants || []).forEach(function (id) { if (!map[id]) map[id] = c; });
      }
    });
    return map;
  }, [cards]);

  return (
    <div className="member-strip">
      <span className="member-strip-label">
        <Icon name="users" /> {t('member.strip', lang)}
      </span>
      {(members || []).map((m) => {
        const isAbsent = !m.checkedIn;
        const task = memberTask[m.id];
        const isBusy = task && task.col === 'inprogress';
        return (
          <div
            key={m.id}
            className={`member-chip${isAbsent ? ' absent' : ''}`}
          >
            <Avatar member={m} size="lg" />
            <span className="nm">{m.name || m.id}</span>
            {isAbsent ? (
              <span className="task">{t('member.not_checked_in', lang)}</span>
            ) : task ? (
              <span className="task busy">{task.title}</span>
            ) : (
              <span className="task">{t('member.free', lang)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterTabs — "All" + one tab per machine
// ---------------------------------------------------------------------------
function FilterTabs({ filter, setFilter, cards, lang }) {
  const counts = React.useMemo(() => {
    const c = { all: (cards || []).length };
    MACHINE_ORDER.forEach((id) => { c[id] = 0; });
    (cards || []).forEach((card) => {
      if (card.machine && c[card.machine] !== undefined) {
        c[card.machine] += 1;
      }
    });
    return c;
  }, [cards]);

  return (
    <div className="filters">
      {/* All */}
      <button
        className={`filter-tab${filter === 'all' ? ' active' : ''}`}
        onClick={() => setFilter('all')}
      >
        <Icon name="layout-grid" /> {t('filter.all', lang)}
        <span className="count">{counts.all}</span>
      </button>

      {/* Per machine */}
      {MACHINE_ORDER.map((id) => {
        const m = MACHINES[id];
        return (
          <button
            key={id}
            className={`filter-tab${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
          >
            <span className="mdot" style={{ backgroundColor: m.color }} />
            {' '}{m.label}
            <span className="count">{counts[id]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card — single kanban card
// ---------------------------------------------------------------------------
const PRIORITY_DEFAULT = 'mid';

function Card({ card, member, assistantMembers, now, isSelected, onClick, onClaimStart, dnd, lang }) {
  const {
    id, title, desc, machine, priority, col,
    createdAt, startedAt, completedAt,
  } = card;

  // --- Computed state ---
  const overdue = isOverdue && isOverdue(card, now);
  const staleBacklog = isStaleBacklog && isStaleBacklog(card, now);
  const readyNudge = isReadyNudged && isReadyNudged(card, now);
  const progress = col === 'inprogress' && progressOf ? progressOf(card, now) : null;
  const elapsed = col === 'inprogress' && startedAt ? fmtDuration(now - startedAt) : null;
  const done = col === 'done';

  // --- Class list ---
  const classes = ['card'];
  if (isSelected) classes.push('selected');
  if (done) classes.push('done');
  if (overdue) classes.push('overdue');
  if (staleBacklog) classes.push('stale');
  if (readyNudge) classes.push('ready-nudge');
  if (dnd && dnd.draggingId === id) classes.push('dragging');

  // Rim style for in-progress cards with a machine
  const rimStyle =
    col === 'inprogress' && machine && MACHINES[machine]
      ? { borderLeftColor: MACHINES[machine].color, borderLeftWidth: '3px', borderLeftStyle: 'solid' }
      : {};
  if (col === 'inprogress' && machine) classes.push('rim');

  // Timestamp display
  const ts = done ? completedAt || createdAt : createdAt;
  const tsIcon = done ? 'circle-check-filled' : 'clock';

  // Priority class
  const priClass = priority || PRIORITY_DEFAULT;

  // Avatar stack
  const allMembers = member ? [member].concat(assistantMembers || []) : (assistantMembers || []);
  const visibleMembers = allMembers.slice(0, 3);
  const extraMembers = allMembers.length - 3;

  // Drag event handlers
  let dragProps = {};
  if (dnd) {
    dragProps = {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData('text/plain', id);
        dnd.onDragStart && dnd.onDragStart(id, e);
      },
      onDragEnd: (e) => {
        dnd.onDragEnd && dnd.onDragEnd(e);
      },
    };
  }

  return (
    <div
      className={classes.join(' ')}
      style={rimStyle}
      onClick={() => onClick && onClick(card)}
      {...dragProps}
    >
      {/* Drag grip */}
      {dnd && (
        <div className="drag-grip">
          <Icon name="grip-vertical" />
        </div>
      )}

      {/* Card top: priority + machine */}
      <div className="card-top">
        <span className={`pri ${priClass}`} />
        {machine && <MachineTag id={machine} />}
      </div>

      {/* Title + description */}
      <div className="card-title">{title}</div>
      {desc && <div className="card-desc">{desc}</div>}

      {/* Batch 3 — Overdue marker */}
      {overdue && (
        <div className="overdue-marker">
          <Icon name="alert-triangle" />
          {t('card.overdue_mins', lang).replace('{n}', overdueMins ? overdueMins(card, now) : '?')}
        </div>
      )}

      {/* Stale backlog marker */}
      {staleBacklog && (
        <div className="stale-marker">
          <Icon name="clock-pause" /> {t('card.stale', lang)}
        </div>
      )}

      {/* Progress bar for in-progress */}
      {progress !== null && (
        <div className="progress-block">
          <div className="progress-meta">
            <Icon name="clock-play" />
            {' '}<span className="elapsed">{t('card.elapsed', lang).replace('{t}', elapsed || '')}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                backgroundColor: machine && MACHINES[machine]
                  ? MACHINES[machine].color
                  : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* Card footer */}
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

      {/* Batch 2 — Claim & start button (only for Ready cards) */}
      {col === 'ready' && (
        <button
          className="claim-btn"
          onClick={(e) => {
            e.stopPropagation();
            onClaimStart && onClaimStart(card.id);
          }}
        >
          <Icon name="user-check" /> {t('card.claim_start', lang)}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column — one column on the board
// ---------------------------------------------------------------------------
function Column({
  col, cards, memberMap, now, lang,
  onAddTask, dnd, selectedCardId, onCardClick, onClaimStart,
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const dropRef = React.useRef(null);
  const bodyRef = React.useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    // Only remove when leaving the column itself
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
      setDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    setDragOver(false);
    const cardId = e.dataTransfer.getData('text/plain');
    if (dnd && dnd.onDrop) {
      dnd.onDrop(cardId, col.id);
    }
  };

  return (
    <div
      className={`column${dragOver ? ' drag-over' : ''}`}
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="column-head">
        <span className="hdot" style={{ backgroundColor: col.color }} />
        <span className="ttl">{t('col.' + col.id, lang)}</span>
        <span className="ct">{(cards || []).length}</span>
      </div>

      {/* Scrollable card area */}
      <div className="column-body" ref={bodyRef}>
        {(cards || []).length === 0 && (
          <div className="col-empty">{t('col.empty', lang)}</div>
        )}
        {(cards || []).map((card) => (
          <React.Fragment key={card.id}>
            {/* Drop-line indicator when dragging over this position */}
            {dnd && dnd.draggingId && dnd.draggingId !== card.id && (
              <div
                className="drop-line"
                data-card-id={card.id}
              />
            )}
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
          </React.Fragment>
        ))}
      </div>

      {/* Add task button */}
      <button
        className="btn add-task"
        onClick={() => onAddTask && onAddTask(col.id)}
      >
        <Icon name="plus" /> {t('col.add_task', lang)}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board — top-level board with all subcomponents
// ---------------------------------------------------------------------------
function Board({
  state, now, filter, setFilter,
  onCheckIn, onAddTask, onOpenAdmin, onPreviewSaver, onOpenTutorial,
  onMoveCard, onEditCard, onClaimStart,
  isFullscreen, onFullscreenToggle,
  checkedInMemberId,
  selectedCardId, setSelectedCardId,
}) {
  // Build member lookup map
  const memberMap = React.useMemo(() => {
    const m = {};
    (state.members || []).forEach((mb) => { m[mb.id] = mb; });
    return m;
  }, [state.members]);

  // --- Filter cards ---
  const filteredCards = React.useMemo(() => {
    if (!state.cards) return [];
    if (!filter || filter === 'all') return state.cards;
    return state.cards.filter((c) => c.machine === filter);
  }, [state.cards, filter]);

  // Group filtered cards by column
  const columnCards = React.useMemo(() => {
    const groups = {};
    COLUMNS.forEach((c) => { groups[c.id] = []; });
    filteredCards.forEach((c) => {
      if (groups[c.col]) groups[c.col].push(c);
      else groups[c.col] = [c];
    });
    return groups;
  }, [filteredCards]);

  // --- Drag-and-drop state ---
  const [draggingId, setDraggingId] = React.useState(null);
  const [dropTarget, setDropTarget] = React.useState(null);

  const dnd = {
    draggingId,
    onDragStart: (id) => {
      setDraggingId(id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setDropTarget(null);
    },
    onDrop: (cardId, colId) => {
      if (cardId && colId && onMoveCard) {
        onMoveCard(cardId, colId);
      }
      setDraggingId(null);
      setDropTarget(null);
    },
  };

  // --- Card click: open edit modal ---
  const handleCardClick = React.useCallback((card) => {
    if (onEditCard) {
      setSelectedCardId && setSelectedCardId(card.id);
      onEditCard(card);
    }
  }, [onEditCard, setSelectedCardId]);

  return (
    <div className="app">
      <TopBar
        lab={state.lab}
        members={state.members}
        cards={state.cards}
        now={now}
        lang={state.lang}
        onCheckIn={onCheckIn}
        onAddTask={onAddTask}
        onOpenAdmin={onOpenAdmin}
        onPreviewSaver={onPreviewSaver}
        onOpenTutorial={onOpenTutorial}
        onFullscreenToggle={onFullscreenToggle}
        isFullscreen={isFullscreen}
        checkedInMemberId={checkedInMemberId}
      />

      <MemberStrip
        members={state.members}
        cards={state.cards}
        lang={state.lang}
      />

      <FilterTabs
        filter={filter}
        setFilter={setFilter}
        cards={state.cards}
        lang={state.lang}
      />

      <div className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            col={col}
            cards={columnCards[col.id] || []}
            memberMap={memberMap}
            now={now}
            lang={state.lang}
            onAddTask={onAddTask}
            dnd={dnd}
            selectedCardId={selectedCardId}
            onCardClick={handleCardClick}
            onClaimStart={onClaimStart}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expose to global scope
// ---------------------------------------------------------------------------
Object.assign(window, { Icon, Avatar, MachineTag, Board });
