// Fablab Kanban Admin Panel — React 18 components
// Compiled by Babel standalone. All function components using hooks.

const { Icon, Avatar, MachineTag } = window;
const FabData = window.FabData;
const t = window.I18n ? window.I18n.t : function(k) { return k; };

// ---------------------------------------------------------------------------
// AdminLogin — master-password gate
// ---------------------------------------------------------------------------
function AdminLogin({ onUnlock, onClose, password, lang }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSubmit = () => {
    if (value === password) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="lock"><Icon name="lock" /></div>
        <h3>{t('admin.login_title', lang)}</h3>
        <p>{t('admin.login_desc', lang)}</p>
        <input
          ref={inputRef}
          className={'input' + (error ? ' err' : '')}
          type="password"
          placeholder={t('admin.login_placeholder', lang)}
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={handleKeyDown}
        />
        {error && <div className="login-err">{t('admin.login_error', lang)}</div>}
        <div className="field" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={onClose}>{t('admin.login_back', lang)}</button>
          <button className="btn btn-accent" onClick={handleSubmit}>{t('admin.login_unlock', lang)}</button>
        </div>
        <p style={{ marginTop: 16, opacity: 0.6, fontSize: 13 }}>{t('admin.login_hint', lang)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberRow — edit name, initials, and avatar colour for one member
// ---------------------------------------------------------------------------
function MemberRow({ member, onEdit, onRemove, lang }) {
  const handleNameChange = (e) => {
    const name = e.target.value;
    const parts = name.trim().split(/\s+/);
    let initials = '';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0]) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }
    onEdit({ ...member, name, initials });
  };

  const handleInitialsChange = (e) => {
    onEdit({ ...member, initials: e.target.value.toUpperCase() });
  };

  return (
    <div className="mrow">
      <Avatar member={member} size="lg" />
      <input
        className="input nm"
        value={member.name}
        onChange={handleNameChange}
        style={{ flex: 1, height: 36 }}
      />
      <input
        className="input ini"
        value={member.initials}
        onChange={handleInitialsChange}
        maxLength={3}
        style={{ width: 62, textAlign: 'center', fontWeight: 700 }}
      />
      <div className="swatches">
        {FabData.AVATAR_COLORS.map(color => (
          <button
            key={color}
            className={'swatch' + (member.color === color ? ' on' : '')}
            style={{ backgroundColor: color }}
            onClick={() => onEdit({ ...member, color })}
          />
        ))}
      </div>
      <button className="x" onClick={() => onRemove(member.id)} title={t('admin.machines_remove', lang)}>
        <Icon name="trash" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddMember — form to add a new member to the board
// ---------------------------------------------------------------------------
function AddMember({ onAdd, lang }) {
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState(FabData.AVATAR_COLORS[0]);

  const computeInitials = (nameStr) => {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0]) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return '';
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: FabData.uid(),
      name: name.trim(),
      initials: computeInitials(name),
      color,
      checkedIn: false,
    });
    setName('');
    setColor(FabData.AVATAR_COLORS[0]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="add-member">
      <div className="field">
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('admin.members_placeholder', lang)}
          style={{ flex: 1 }}
        />
      </div>
      <div className="swatches">
        {FabData.AVATAR_COLORS.map(c => (
          <button
            key={c}
            className={'swatch' + (color === c ? ' on' : '')}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button className="btn btn-accent" onClick={handleAdd}>
        <Icon name="plus" /> {t('admin.members_add', lang)}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompletedTasksPanel — tasks archived from the Done column, by day
// ---------------------------------------------------------------------------
function CompletedTasksPanel({ state, lang }) {
  const groups = state.completedTasks || [];

  const [selectedDate, setSelectedDate] = React.useState(() => {
    if (groups.length === 0) return FabData.todayStr();
    return [...groups].map(g => g.date).sort().pop();
  });

  const entries = React.useMemo(() => {
    const group = groups.find(g => g.date === selectedDate);
    return group ? group.cards : [];
  }, [state.completedTasks, selectedDate]);

  function getMember(id) {
    return (state.members || []).find(m => m.id === id);
  }

  function calcDurationMin(card) {
    if (!card.startedAt || !card.completedAt) return null;
    return Math.round((new Date(card.completedAt) - new Date(card.startedAt)) / 60000);
  }

  function fmtCompletedAt(card) {
    if (!card.completedAt) return '—';
    return FabData.fmtHHMM(new Date(card.completedAt));
  }

  const escCSV = val => '"' + (val || '').toString().replace(/"/g, '""') + '"';

  const exportCSV = () => {
    const header = ['fecha','tarea','prioridad','maquina','owner','asistentes','estimado_min','duracion_min','sobretiempo_min','completado_a'];
    const rows = [header];
    entries.forEach(c => {
      const owner = getMember(c.owner);
      const assistantNames = (c.assistants || []).map(id => {
        const m = getMember(id);
        return m ? m.name : id;
      }).join('|');
      const durationMin = calcDurationMin(c);
      const overtimeMin = durationMin !== null ? durationMin - (c.estMin || 0) : null;
      rows.push([
        selectedDate,
        escCSV(c.title),
        c.priority || '',
        c.machine || '',
        escCSV(owner ? owner.name : c.owner),
        escCSV(assistantNames),
        c.estMin || '',
        durationMin !== null ? durationMin : '',
        overtimeMin !== null ? overtimeMin : '',
        escCSV(fmtCompletedAt(c)),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-completadas-' + selectedDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('admin.completed_title', lang)}</h3>
        <p>{t('admin.completed_desc', lang)}</p>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {t('admin.completed_date', lang)}
          </label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160, height: 36 }}
          />
        </div>

        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('admin.completed_empty', lang)}</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{/* title + owner + assistants */}</th>
                <th>{t('admin.completed_estimated', lang)}</th>
                <th>{t('admin.completed_duration', lang)}</th>
                <th>{t('admin.completed_at', lang)}</th>
                <th>{t('admin.completed_overtime', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((c, i) => {
                const owner = getMember(c.owner);
                const durationMin = calcDurationMin(c);
                const overtimeMin = durationMin !== null ? durationMin - (c.estMin || 0) : null;
                return (
                  <tr key={c.id || i}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {owner && <Avatar member={owner} size="sm" />}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {owner ? owner.name : (c.owner || '—')}
                          </span>
                          {c.priority && <span className={'pri ' + c.priority} title={c.priority} />}
                          {c.machine && MachineTag && <MachineTag machineId={c.machine} />}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.title}</span>
                        {(c.assistants || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.assistants.map(id => {
                              const m = getMember(id);
                              return m ? <Avatar key={id} member={m} size="sm" /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {c.estMin ? FabData.fmtDuration(c.estMin * 60000) : '—'}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {durationMin !== null ? FabData.fmtDuration(durationMin * 60000) : '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {fmtCompletedAt(c)}
                    </td>
                    <td>
                      {c.overtime && overtimeMin !== null && overtimeMin > 0 ? (
                        <span className="overtime-badge">+{FabData.fmtDuration(overtimeMin * 60000)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {entries.length > 0 && (
          <button className="btn btn-accent" onClick={exportCSV} style={{ marginTop: 14 }}>
            {t('admin.completed_export', lang)}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CancelledTasksPanel — tasks deleted outside Done column, with reason
// ---------------------------------------------------------------------------
function CancelledTasksPanel({ state, lang }) {
  const groups = state.cancelledTasks || [];

  const [selectedDate, setSelectedDate] = React.useState(() => {
    if (groups.length === 0) return FabData.todayStr();
    return [...groups].map(g => g.date).sort().pop();
  });

  const entries = React.useMemo(() => {
    const group = groups.find(g => g.date === selectedDate);
    return group ? group.cards : [];
  }, [state.cancelledTasks, selectedDate]);

  function getMember(id) {
    return (state.members || []).find(m => m.id === id);
  }

  const COL_LABELS = {
    backlog:    t('col.backlog',     lang),
    ready:      t('col.ready',       lang),
    inprogress: t('col.inprogress',  lang),
    done:       t('col.done',        lang),
  };

  const escCSV = val => '"' + (val || '').toString().replace(/"/g, '""') + '"';

  const exportCSV = () => {
    const header = ['fecha','tarea','prioridad','maquina','owner','asistentes','columna','creado_en','razon'];
    const rows = [header];
    entries.forEach(c => {
      const owner = getMember(c.owner);
      const assistantNames = (c.assistants || []).map(id => {
        const m = getMember(id);
        return m ? m.name : id;
      }).join('|');
      rows.push([
        selectedDate,
        escCSV(c.title),
        c.priority || '',
        c.machine || '',
        escCSV(owner ? owner.name : c.owner),
        escCSV(assistantNames),
        c.col || '',
        c.createdAt || '',
        escCSV(c.cancelReason || ''),
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-canceladas-' + selectedDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('admin.cancelled_title', lang)}</h3>
        <p>{t('admin.cancelled_desc', lang)}</p>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            {t('admin.cancelled_date', lang)}
          </label>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160, height: 36 }}
          />
        </div>

        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{t('admin.cancelled_empty', lang)}</p>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{/* title + owner */}</th>
                <th>{t('admin.cancelled_column', lang)}</th>
                <th>{t('admin.cancelled_created', lang)}</th>
                <th>{t('admin.cancelled_reason', lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((c, i) => {
                const owner = getMember(c.owner);
                const createdAt = c.createdAt
                  ? new Date(c.createdAt).toLocaleTimeString(lang === 'es' ? 'es' : 'en', { hour: '2-digit', minute: '2-digit', hour12: false })
                  : '—';
                return (
                  <tr key={c.id || i}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {owner && <Avatar member={owner} size="sm" />}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {owner ? owner.name : (c.owner || '—')}
                          </span>
                          {c.priority && <span className={'pri ' + c.priority} title={c.priority} />}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.title}</span>
                        {(c.assistants || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.assistants.map(id => {
                              const m = getMember(id);
                              return m ? <Avatar key={id} member={m} size="sm" /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {COL_LABELS[c.col] || c.col || '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{createdAt}</td>
                    <td style={{ fontSize: 13, color: c.cancelReason ? 'var(--text)' : 'var(--text-3)', maxWidth: 200 }}>
                      {c.cancelReason
                        ? c.cancelReason.length > 80
                          ? c.cancelReason.slice(0, 80) + '…'
                          : c.cancelReason
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {entries.length > 0 && (
          <button className="btn btn-accent" onClick={exportCSV} style={{ marginTop: 14 }}>
            {t('admin.cancelled_export', lang)}
          </button>
        )}
      </div>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Admin — top-level admin panel with all sections
// ---------------------------------------------------------------------------
function Admin({ state, setState, onClose }) {
  var lang = state.lang || 'en';
  const [unlocked, setUnlocked] = React.useState(false);
  const [passwordValue, setPasswordValue] = React.useState(state.password || '');
  const [saved, setSaved] = React.useState(false);

  // Clear "Saved" feedback after 1.8 s
  React.useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  // Lab settings local state
  const [labName, setLabName] = React.useState(state.lab || '');
  const [idleMin, setIdleMin] = React.useState(state.idleMinutes || 3);
  const [labSaved, setLabSaved] = React.useState(false);

  React.useEffect(() => {
    if (!labSaved) return;
    const t = setTimeout(() => setLabSaved(false), 1800);
    return () => clearTimeout(t);
  }, [labSaved]);

  // Machine types local state
  const [machines, setMachines] = React.useState(
    (state.machines || []).map(function (m) { return Object.assign({}, m); })
  );
  const [machineSaved, setMachineSaved] = React.useState(false);

  React.useEffect(() => {
    if (!machineSaved) return;
    const t = setTimeout(() => setMachineSaved(false), 1800);
    return () => clearTimeout(t);
  }, [machineSaved]);

  // ---- Locked: show login ------------------------------------------------
  if (!unlocked) {
    return (
      <AdminLogin
        onUnlock={() => setUnlocked(true)}
        onClose={onClose}
        password={state.password}
        lang={state.lang}
      />
    );
  }

  // ---- Member CRUD -------------------------------------------------------
  const editMember = (updated) => {
    setState(prev => ({
      ...prev,
      members: prev.members.map(m => (m.id === updated.id ? updated : m)),
    }));
  };

  const removeMember = (id) => {
    setState(prev => ({
      ...prev,
      members: prev.members.filter(m => m.id !== id),
    }));
  };

  const addMember = (member) => {
    setState(prev => ({
      ...prev,
      members: [...prev.members, member],
    }));
  };

  // ---- Lab settings ------------------------------------------------------
  const handleLabSave = () => {
    setState(prev => ({ ...prev, lab: labName, idleMinutes: Math.max(1, Math.min(60, idleMin)) }));
    setLabSaved(true);
  };

  // ---- Machine CRUD ------------------------------------------------------
  const updateMachine = (idx, field, value) => {
    setMachines(prev => {
      var next = prev.slice();
      next[idx] = Object.assign({}, next[idx], {});
      next[idx][field] = value;
      if (field === 'label') {
        next[idx].id = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'custom';
      }
      return next;
    });
  };

  const removeMachine = (idx) => {
    setMachines(prev => prev.filter(function (_, i) { return i !== idx; }));
  };

  const addMachine = () => {
    if (machines.length >= 8) return;
    var id = 'm' + Date.now().toString(36);
    setMachines(prev => prev.concat([{
      id: id,
      label: 'New',
      color: '#495057',
      icon: 'ti-tool',
    }]));
  };

  const handleMachinesSave = () => {
    var cleaned = machines.map(function (m) { return Object.assign({}, m); });
    setState(prev => {
      var next = Object.assign({}, prev, { machines: cleaned });
      FabData.syncMachines(next.machines);
      return next;
    });
    setMachineSaved(true);
  };

  // ---- Password management -----------------------------------------------
  const handlePasswordSave = () => {
    setState(prev => ({ ...prev, password: passwordValue }));
    setSaved(true);
  };

  // ---- Export helpers ----------------------------------------------------
  const escCSV = (val) => {
    const s = (val || '').toString();
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const exportCSV = () => {
    const today = new Date().toISOString().slice(0, 10);
    const cols = ['id', 'title', 'column', 'priority', 'machine', 'owner', 'assistants', 'created', 'completed'];
    const rows = [cols];

    (state.cards || []).forEach(task => {
      const assistantNames = (task.assistants || [])
        .map(id => { const m = (state.members || []).find(m => m.id === id); return m ? m.name : id; })
        .join('|');
      rows.push([
        task.id,
        escCSV(task.title),
        task.col || '',
        task.priority || '',
        task.machine || '',
        task.owner || '',
        escCSV(assistantNames),
        task.createdAt || '',
        task.completedAt || '',
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-utp-' + today + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const today = new Date().toISOString().slice(0, 10);
    const data = { ...state, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fablab-utp-' + today + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInputRef = React.useRef(null);

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.value = "";  // allow re-importing the same filename
      importInputRef.current.click();
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (err) { alert(t('admin.import_error', lang)); return; }
      if (!confirm(t('admin.import_confirm', lang))) return;
      const migrated = FabData.migrate(parsed);
      FabData.saveNow(migrated)
        .then(() => {
          setState(migrated);
          setPasswordValue(migrated.password || '');
        })
        .catch(() => alert(t('admin.import_error', lang)));
    };
    reader.readAsText(file);
  };

  // ---- Reset demo data ---------------------------------------------------
  const handleReset = () => {
    if (confirm(t('admin.reset_confirm', lang))) {
      FabData.reset().then(fresh => {
        setState(fresh);
        setPasswordValue(fresh.password || '');
      });
    }
  };

  const handleStartFresh = () => {
    if (confirm(t('admin.fresh_confirm', lang))) {
      const fresh = FabData.buildEmpty(state.machines, state.lang);
      FabData.saveNow(fresh).catch(() => {});
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };

  // ---- System panel -------------------------------------------------------
  const handleSeedInit = () => {
    if (confirm(t('admin.seed_confirm', lang))) {
      const fresh = FabData.buildSeed();
      FabData.saveNow(fresh).catch(() => {});
      setState(fresh);
      setPasswordValue(fresh.password || '');
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  // ---- Render ------------------------------------------------------------
  return (
    <div className="admin">
      {/* Header bar */}
      <div className="admin-bar">
        <button className="btn btn-icon" onClick={onClose}>
          <Icon name="arrow-left" />
        </button>
        <h2>{t('admin.title', lang)}</h2>
        <span className="tag-admin">{t('admin.tag', lang)}</span>
      </div>

      <div className="admin-scroll">
        <div className="admin-wrap">
          {/* ---- Registered members ------------------------------------ */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.members_title', lang)}</h3>
              <p>{t('admin.members_desc', lang).replace('{n}', (state.members || []).length)}</p>
            </div>
            <div className="panel-body">
              {(state.members || []).map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onEdit={editMember}
                  onRemove={removeMember}
                  lang={lang}
                />
              ))}
              <AddMember onAdd={addMember} lang={lang} />
            </div>
          </div>

          {/* ---- Lab settings ------------------------------------------ */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.lab_title', lang)}</h3>
              <p>{t('admin.lab_desc', lang)}</p>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                  <label>{t('admin.lab_name', lang)}</label>
                  <input
                    className="input"
                    type="text"
                    value={labName}
                    onChange={e => setLabName(e.target.value)}
                  />
                </div>
                <div className="field" style={{ width: 120 }}>
                  <label>{t('admin.lab_idle', lang)}</label>
                  <input
                    className="input"
                    type="number"
                    min={1} max={60}
                    value={idleMin}
                    onChange={e => setIdleMin(parseInt(e.target.value, 10) || 1)}
                  />
                </div>
                <button className="btn btn-accent" onClick={handleLabSave}>
                  {labSaved ? t('admin.pw_saved', lang) : t('admin.pw_save', lang)}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Language --------------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.lang_title', lang)}</h3>
              <p>{t('admin.lang_desc', lang)}</p>
            </div>
            <div className="panel-body">
              <select
                className="select"
                value={state.lang || 'en'}
                onChange={e => setState(prev => ({ ...prev, lang: e.target.value }))}
                style={{ width: 200, height: 36 }}
              >
                <option value="en">{t('admin.lang_en', lang)}</option>
                <option value="es">{t('admin.lang_es', lang)}</option>
              </select>
            </div>
          </div>

          {/* ---- Machine types ----------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.machines_title', lang)}</h3>
              <p>{t('admin.machines_desc', lang)}</p>
            </div>
            <div className="panel-body">
              {machines.map(function (m, idx) {
                return (
                  <div key={m.id || idx} className="mrow">
                    <select
                      className="select"
                      value={m.icon}
                      onChange={function (e) { updateMachine(idx, 'icon', e.target.value); }}
                      style={{ width: 130, height: 36, fontSize: 13 }}
                    >
                      {FabData.MACHINE_ICONS.map(function (ic) {
                        return React.createElement('option', { key: ic, value: ic }, ic.replace('ti-', ''));
                      })}
                    </select>
                    <Icon name={m.icon || 'ti-tool'} />
                    <input
                      className="input"
                      value={m.label}
                      onChange={function (e) { updateMachine(idx, 'label', e.target.value); }}
                      style={{ flex: 1, height: 36 }}
                      placeholder={t('admin.machines_placeholder', lang)}
                    />
                    <div className="swatches">
                      {['#e23c34','#2b7fd4','#7c5cfc','#25a04a','#0e9da0','#f0a017','#c2255c','#495057'].map(function (c) {
                        return React.createElement('button', {
                          key: c,
                          className: 'swatch' + (m.color === c ? ' on' : ''),
                          style: { backgroundColor: c },
                          onClick: function () { updateMachine(idx, 'color', c); },
                        });
                      })}
                    </div>
                    <button
                      className="x"
                      onClick={function () { removeMachine(idx); }}
                      disabled={machines.length <= 1}
                      style={machines.length <= 1 ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                      title={machines.length <= 1 ? t('admin.machines_min', lang) : 'Remove'}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <button
                  className="btn"
                  onClick={addMachine}
                  disabled={machines.length >= 8}
                  style={machines.length >= 8 ? { opacity: 0.4 } : {}}
                >
                  <Icon name="plus" /> {t('admin.machines_add', lang)}
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {t('admin.machines_slots', lang).replace('{n}', machines.length)}
                </span>
                <div style={{ flex: 1 }} />
                <button className="btn btn-accent" onClick={handleMachinesSave}>
                  {machineSaved ? t('admin.pw_saved', lang) : t('admin.machines_save', lang)}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Master password --------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.pw_title', lang)}</h3>
              <p>{t('admin.pw_desc', lang)}</p>
            </div>
            <div className="panel-body">
              <div className="export-row">
                <input
                  className="input"
                  type="text"
                  value={passwordValue}
                  onChange={e => setPasswordValue(e.target.value)}
                  style={{ maxWidth: 280 }}
                />
                <button className="btn btn-accent" onClick={handlePasswordSave}>
                  {saved ? t('admin.pw_saved', lang) : t('admin.pw_save', lang)}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Completed tasks --------------------------------------- */}
          <CompletedTasksPanel state={state} lang={lang} />

          {/* ---- Cancelled tasks --------------------------------------- */}
          <CancelledTasksPanel state={state} lang={lang} />

          {/* ---- Attendance log ---------------------------------------- */}
          <AttendancePanel state={state} lang={lang} />

          {/* ---- Export data ------------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.export_title', lang)}</h3>
              <p>{t('admin.export_desc', lang)}</p>
            </div>
            <div className="panel-body">
              <div className="export-row">
                <button className="btn btn-accent" onClick={exportCSV}>{t('admin.export_csv', lang)}</button>
                <button className="btn btn-accent" onClick={exportJSON}>{t('admin.export_json', lang)}</button>
                <button className="btn btn-accent" onClick={handleImportClick}>{t('admin.import_json', lang)}</button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={handleImportFile}
                />
              </div>
              <button
                className="btn"
                onClick={handleReset}
                style={{ color: 'red', marginTop: 16 }}
              >
                {t('admin.reset', lang)}
              </button>
              <button
                className="btn"
                onClick={handleStartFresh}
                style={{ color: 'red', marginTop: 8 }}
              >
                {t('admin.fresh_btn', lang)}
              </button>
            </div>
          </div>

          {/* ---- System ------------------------------------------------- */}
          <div className="panel">
            <div className="panel-head">
              <h3>{t('admin.system_title', lang)}</h3>
              <p>{t('admin.system_desc', lang)}</p>
            </div>
            <div className="panel-body">
              {FabData.isNewInstall(state) && (
                <button
                  className="btn btn-accent"
                  onClick={handleSeedInit}
                  style={{ marginBottom: 12 }}
                >
                  {t('admin.seed_btn', lang)}
                </button>
              )}
              <div>
                <button className="btn" onClick={handleReload}>
                  {t('admin.reload_btn', lang)}
                </button>
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  {t('admin.reload_desc', lang)}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ---- Expose to global scope ------------------------------------------------
window.Admin = Admin;
