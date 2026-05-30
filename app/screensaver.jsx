// Fablab Kanban — Screensaver component
// Fullscreen live dashboard shown after idle timeout.

const { MACHINES, fmtDuration, progressOf, getTodayDone } = window.FabData;
const { Icon, Avatar } = window;
const t = window.I18n ? window.I18n.t : function(k) { return k; };

function Screensaver({ state, now, onExit }) {
  const lang = state.lang || 'en';
  // -----------------------------------------------------------------------
  // Dismiss on any user interaction
  // -----------------------------------------------------------------------
  React.useEffect(() => {
    const handler = (e) => { e.preventDefault(); onExit(); };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('wheel', handler, { passive: false });
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('wheel', handler);
    };
  }, [onExit]);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const memberMap = React.useMemo(() => {
    const map = {};
    (state.members || []).forEach((m) => { map[m.id] = m; });
    return map;
  }, [state.members]);

  const activeJobs = React.useMemo(
    () => (state.cards || []).filter((c) => c.col === 'inprogress'),
    [state.cards],
  );

  const checkedIn = React.useMemo(
    () => (state.members || []).filter((m) => m.checkedIn),
    [state.members],
  );

  const busyIds = React.useMemo(() => {
    const s = new Set();
    activeJobs.forEach(function(c) {
      s.add(c.owner);
      (c.assistants || []).forEach(function(id) { s.add(id); });
    });
    return s;
  }, [activeJobs]);

  const freeMembers = React.useMemo(
    () => checkedIn.filter((m) => !busyIds.has(m.id)),
    [checkedIn, busyIds],
  );

  const todayDone = React.useMemo(
    () => getTodayDone(state),
    [state],
  );

  const getOwner = React.useCallback(
    (card) => memberMap[card.owner] || null,
    [memberMap],
  );

  // Formatted clock string — updates whenever the `now` prop ticks.
  const clockTime = React.useMemo(() => {
    const t = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const d = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${t}  ·  ${d}`;
  }, [now]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="saver">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="saver-top">
        <div className="live">
          <span className="live-dot" />
          {t('saver.live', lang)}
        </div>
        <div className="saver-lab">{state.lab}</div>
        <div className="saver-clock">{clockTime}</div>
      </div>

      {/* ── Big stat numbers ──────────────────────────────────────────── */}
      <div className="stats">
        <div className="stat accent">
          <div className="num">{activeJobs.length}</div>
          <div className="lbl">{t('saver.stat_progress', lang)}</div>
        </div>
        <div className="stat">
          <div className="num">{checkedIn.length}</div>
          <div className="lbl">{t('saver.stat_checked_in', lang)}</div>
        </div>
        <div className="stat">
          <div className="num">{freeMembers.length}</div>
          <div className="lbl">{t('saver.stat_free', lang)}</div>
        </div>
        <div className="stat accent">
          <div className="num">{todayDone.length}</div>
          <div className="lbl">{t('saver.stat_done', lang)}</div>
        </div>
      </div>

      {/* ── Middle: active jobs + members ─────────────────────────────── */}
      <div className="saver-mid">
        {/* Active jobs panel */}
        <div className="saver-panel">
          <div className="saver-panel-head">
            <Icon name="player-play-filled" />
            {t('saver.active_jobs', lang)}
            {' '}{activeJobs.length}
          </div>
          <div className="saver-panel-body">
            {activeJobs.length === 0 && (
              <div className="saver-panel-empty">{t('saver.no_active_jobs', lang)}</div>
            )}
            {activeJobs.map((card) => {
              const owner = getOwner(card);
              const cardAssistants = (card.assistants || []).map(function(id) { return memberMap[id]; }).filter(Boolean);
              const allJobMembers = owner ? [owner].concat(cardAssistants) : cardAssistants;
              const visibleJobMembers = allJobMembers.slice(0, 3);
              const extraJobMembers = allJobMembers.length - 3;
              const machine = MACHINES[card.machine] || {
                color: '#666',
                icon: 'question-mark',
                label: card.machine || '?',
              };
              const remaining = card.startedAt
                ? Math.max(0, card.estMin * 60000 - (now - card.startedAt))
                : 0;

              return (
                <div className="job-row" key={card.id}>
                  <div className="av-stack">
                    {visibleJobMembers.map(function(m) { return <Avatar key={m.id} member={m} size="lg" />; })}
                    {extraJobMembers > 0 && <span className="av-extra" style={{ width: 36, height: 36, fontSize: 12 }}>+{extraJobMembers}</span>}
                  </div>
                  <div className="jt">
                    {card.title}
                    <div className="jsub">
                      {owner ? owner.name : t('saver.unknown', lang)}
                      {' '}
                      <span className="jtag">
                        <Icon name={machine.icon} />
                        {' '}{machine.label}
                      </span>
                    </div>
                  </div>
                  <div className="jbar-wrap">
                    <div className="jbar">
                      <i style={{ width: `${progressOf(card, now)}%` }} />
                    </div>
                  </div>
                  <div className="jtime">{t('saver.left', lang).replace('{t}', fmtDuration(remaining))}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Members panel */}
        <div className="saver-panel">
          <div className="saver-panel-head">
            <Icon name="users" />
            {t('saver.members', lang)}
            {' '}{t('saver.members_count', lang).replace('{a}', checkedIn.length).replace('{b}', state.members.length)}
          </div>
          <div className="saver-members">
            {(state.members || []).map((m) => {
              const isCheckedIn = m.checkedIn;
              const isBusy = busyIds.has(m.id);

              // First name + last initial
              const parts = (m.name || '').split(/\s+/);
              const first = parts[0] || '?';
              const lastInit = parts.length > 1 ? (parts[parts.length - 1].charAt(0) || '') : '';
              const displayName = lastInit ? first + ' ' + lastInit + '.' : first;

              // Status dot colour
              let dotClass = '';
              if (!isCheckedIn) dotClass = 'gray';
              else if (isBusy) dotClass = 'accent';
              else dotClass = 'green';

              return (
                <div
                  className={'saver-mchip' + (isCheckedIn ? '' : ' absent')}
                  key={m.id}
                >
                  <Avatar member={m} size="md" />
                  <span className="nm">{displayName}</span>
                  <span className={'sdot ' + dotClass} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom: completed today chips ─────────────────────────────── */}
      <div className="saver-bottom">
        <div className="lbl">{t('saver.completed_today', lang).replace('{n}', todayDone.length)}</div>
        <div className="done-chips">
          {todayDone.map((card) => {
            const machine = MACHINES[card.machine] || { color: '#666' };
            return (
              <div className="done-chip" key={card.id}>
                <Icon name="check" />
                {' '}{card.title}
                <span className="cdot" style={{ backgroundColor: machine.color }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Hint ──────────────────────────────────────────────────────── */}
      <div className="saver-hint">
        {t('saver.any_key', lang)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expose to global scope (consumed by Babel standalone and board entry point)
// ---------------------------------------------------------------------------
window.Screensaver = Screensaver;
