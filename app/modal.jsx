/* ============================================================
   FABLAB UTP — Modal components
   CardModal (create / edit) & Cheatsheet
   ============================================================ */
(function () {
  var _React = React;
  var useState = _React.useState;
  var useEffect = _React.useEffect;
  var useRef = _React.useRef;
  var Fragment = _React.Fragment;
  var I18n = window.I18n || { t: function(k) { return k; } };
  var t = function(key, lang) { return I18n.t(key, lang); };
  var Icon = window.Icon;

  // ---- helpers -----------------------------------------------------------
  var FabData = window.FabData;
  var MACHINES = FabData.MACHINES;
  var MACHINE_ORDER = FabData.MACHINE_ORDER;
  var COLUMNS = FabData.COLUMNS;
  var uid = FabData.uid;

  var PRIORITIES = [
    { id: "high", label: "High", color: "var(--p-high)" },
    { id: "mid",  label: "Mid",  color: "var(--p-mid)"  },
    { id: "low",  label: "Low",  color: "var(--p-low)"  },
  ];

  // ============================================================ CardModal
  function CardModal(props) {
    var state        = props.state;
    var defaultCol   = props.defaultCol;
    var editingCard  = props.editingCard;
    var onClose      = props.onClose;
    var onCreate     = props.onCreate;
    var onSave       = props.onSave;
    var onDelete     = props.onDelete;
    var onReassign   = props.onReassign;
    var isEdit       = !!editingCard;
    var members      = state.members;
    var lang         = state.lang || 'en';

    // ---- form state -----------------------------------------------------
    var _owner    = useState(isEdit && editingCard ? editingCard.owner || "" : "");
    var _title    = useState(isEdit && editingCard ? editingCard.title || "" : "");
    var _desc     = useState(isEdit && editingCard ? editingCard.desc || "" : "");
    var _machine  = useState(isEdit && editingCard ? editingCard.machine || null : null);
    var _priority = useState(isEdit && editingCard ? editingCard.priority || "mid" : "mid");
    var _estMin   = useState(isEdit && editingCard ? editingCard.estMin || 120 : 120);
    var _assistants = useState(isEdit && editingCard ? (editingCard.assistants || []) : []);

    var owner    = _owner[0];    var setOwner    = _owner[1];
    var title    = _title[0];    var setTitle     = _title[1];
    var desc     = _desc[0];     var setDesc      = _desc[1];
    var machine  = _machine[0];  var setMachine   = _machine[1];
    var priority = _priority[0]; var setPriority  = _priority[1];
    var estMin   = _estMin[0];   var setEstMin    = _estMin[1];
    var assistants = _assistants[0]; var setAssistants = _assistants[1];

    var _touched      = useState(false);
    var touched       = _touched[0]; var setTouched = _touched[1];

    var _showDelete   = useState(false);
    var showDelete    = _showDelete[0]; var setShowDelete = _showDelete[1];

    var titleRef = useRef(null);

    // column label for header subtitle
    var colLabel = t('col.' + (editingCard ? editingCard.col : (defaultCol || 'backlog')), lang);

    var valid = owner && title.trim() && desc.trim();

    // ---- focus title on mount -------------------------------------------
    useEffect(function () {
      setTimeout(function () {
        if (titleRef.current) titleRef.current.focus();
      }, 50);
    }, []);

    // ---- handlers --------------------------------------------------------
    function handleSubmit() {
      setTouched(true);
      if (!owner || !title.trim() || !desc.trim()) return;

      var fields = {
        owner: owner,
        assistants: assistants,
        title: title.trim(),
        desc: desc.trim(),
        machine: machine,
        priority: priority,
        estMin: parseInt(estMin, 10) || 120,
      };

      if (isEdit) {
        onSave(editingCard.id, fields);
      } else {
        fields.col = defaultCol || "backlog";
        onCreate(fields);
      }
      onClose();
    }

    function handleDelete() {
      onDelete(editingCard.id);
      onClose();
    }

    function toggleAssistant(memberId) {
      setAssistants(function(prev) {
        return prev.includes(memberId)
          ? prev.filter(function(id) { return id !== memberId; })
          : prev.concat([memberId]);
      });
    }

    function handleReassign(e) {
      var newId = e.target.value;
      setOwner(newId);
      setAssistants(function(prev) { return prev.filter(function(id) { return id !== newId; }); });
      if (newId !== editingCard.owner) {
        onReassign(editingCard.id, newId);
      }
    }

    function handleOverlayClick(e) {
      if (e.target === e.currentTarget) onClose();
    }

    function toggleMachine(mId) {
      setMachine(machine === mId ? null : mId);
    }

    // ---- keyboard: Esc closes, Cmd+Enter submits ------------------------
    useEffect(function () {
      function onKey(e) {
        if (e.key === "Escape") { onClose(); return; }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { handleSubmit(); }
      }
      window.addEventListener("keydown", onKey);
      return function () { window.removeEventListener("keydown", onKey); };
    });

    // ---- render ----------------------------------------------------------
    return React.createElement(Fragment, null,

      /* ---- overlay & modal ---- */
      React.createElement("div", { className: "overlay", onClick: handleOverlayClick },
        React.createElement("div", { className: "modal" },

          /* ---- head ---- */
          React.createElement("div", { className: "modal-head" },
            React.createElement("h3", null, isEdit ? t('modal.edit_task', lang) : t('modal.new_task', lang)),
            React.createElement("span", { className: "sub" },
              t('modal.adding_to', lang).replace('{col}', colLabel),
            ),
          ),

          /* ---- body ---- */
          React.createElement("div", { className: "modal-body" },

            // Owner
            React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.owner', lang),
                React.createElement("span", { className: "req" }, "*"),
              ),
              React.createElement("select", {
                className: "select" + (touched && !owner ? " err" : ""),
                value: owner,
                onChange: isEdit ? handleReassign : function(e) {
                  var newId = e.target.value;
                  setOwner(newId);
                  setAssistants(function(prev) { return prev.filter(function(id) { return id !== newId; }); });
                },
              },
                React.createElement("option", { value: "", disabled: true }, t('field.owner_placeholder', lang)),
                members.map(function (m) {
                  var label = m.name + (m.checkedIn ? "" : t('field.owner_unchecked', lang));
                  return React.createElement("option", { key: m.id, value: m.id }, label);
                }),
              ),
            ),

            members.length > 1 ? React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.assistants', lang), ' ',
                React.createElement("span", { style: { fontSize: 12, color: 'var(--text-3)', fontWeight: 500 } },
                  t('field.assistants_hint', lang)
                )
              ),
              React.createElement("div", { className: "assistant-chips" },
                members
                  .filter(function(m) { return m.id !== owner; })
                  .map(function(m) {
                    var isOn = assistants.includes(m.id);
                    return React.createElement("button", {
                      key: m.id,
                      type: "button",
                      className: "assistant-chip" + (isOn ? " on" : ""),
                      onClick: function() { toggleAssistant(m.id); }
                    },
                      React.createElement("span", {
                        className: "av sm",
                        style: { backgroundColor: m.color || '#888', flexShrink: 0 }
                      }, (m.name || '').split(' ').map(function(w){ return w[0]; }).join('').slice(0, 2).toUpperCase()),
                      React.createElement("span", null, m.name)
                    );
                  })
              )
            ) : null,

            // Title
            React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.title', lang),
                React.createElement("span", { className: "req" }, "*"),
              ),
              React.createElement("input", {
                ref: titleRef,
                className: "input" + (touched && !title.trim() ? " err" : ""),
                type: "text",
                placeholder: t('field.title_placeholder', lang),
                value: title,
                onChange: function (e) { setTitle(e.target.value); },
              }),
            ),

            // Description
            React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.desc', lang),
                React.createElement("span", { className: "req" }, "*"),
              ),
              React.createElement("textarea", {
                className: "textarea" + (touched && !desc.trim() ? " err" : ""),
                placeholder: t('field.desc_placeholder', lang),
                rows: 3,
                value: desc,
                onChange: function (e) { setDesc(e.target.value); },
              }),
            ),

            // Machine segment
            React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.machine', lang),
                React.createElement("span", { className: "hint" }, '· ' + t('field.machine_optional', lang)),
              ),
              React.createElement("div", { className: "seg" },
                MACHINE_ORDER.map(function (mId) {
                  var m = MACHINES[mId];
                  var isOn = machine === mId;
                  return React.createElement("button", {
                    key: mId,
                    className: "seg-opt" + (isOn ? " on" : ""),
                    "data-on": isOn ? m.color : undefined,
                    style: isOn ? { color: m.color } : undefined,
                    onClick: function () { toggleMachine(mId); },
                    type: "button",
                  },
                    React.createElement("span", {
                      className: "mdot",
                      style: { background: m.color },
                    }),
                    m.label,
                  );
                }),
              ),
            ),

            // Priority segment
            React.createElement("div", { className: "field" },
              React.createElement("label", null, t('field.priority', lang)),
              React.createElement("div", { className: "seg" },
                PRIORITIES.map(function (p) {
                  var isOn = priority === p.id;
                  return React.createElement("button", {
                    key: p.id,
                    className: "seg-opt" + (isOn ? " on" : ""),
                    "data-on": isOn ? "true" : undefined,
                    style: isOn ? { color: p.color } : undefined,
                    onClick: function () { setPriority(p.id); },
                    type: "button",
                  },
                    React.createElement("span", { className: "pri " + p.id }),
                    t('priority.' + p.id, lang),
                  );
                }),
              ),
            ),

            // Est. duration
            React.createElement("div", { className: "field" },
              React.createElement("label", null,
                t('field.est_duration', lang),
                React.createElement("span", { className: "hint" }, t('field.minutes', lang)),
              ),
              React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                React.createElement("input", {
                  className: "input",
                  type: "number",
                  placeholder: t('field.est_placeholder', lang),
                  min: 1,
                  value: estMin,
                  onChange: function (e) { setEstMin(e.target.value); },
                  style: { width: "120px" },
                }),
                React.createElement("span", {
                  style: { fontSize: "13px", fontWeight: 600, color: "var(--text-3)" },
                }, t('field.minutes', lang)),
              ),
            ),
          ),

          /* ---- delete confirmation ---- */
          isEdit && showDelete
            ? React.createElement("div", {
                className: "delete-confirm",
                style: { margin: "0 20px 16px" },
              },
                React.createElement("p", null, t('action.delete_warning', lang)),
                React.createElement("div", { className: "row" },
                  React.createElement("button", {
                    className: "btn",
                    onClick: function () { setShowDelete(false); },
                    type: "button",
                  }, t('action.cancel', lang)),
                  React.createElement("button", {
                    className: "btn btn-danger",
                    onClick: handleDelete,
                    type: "button",
                  }, t('action.delete_confirm', lang)),
                ),
              )
            : null,

          /* ---- reassign row (edit mode, above footer) ---- */
          isEdit
            ? React.createElement("div", {
                className: "reassign-row",
                style: { margin: "0 20px 16px" },
              },
                React.createElement("label", null, t('field.reassign_owner', lang)),
                React.createElement("select", {
                  className: "select",
                  value: owner,
                  onChange: handleReassign,
                },
                  members.map(function (m) {
                    return React.createElement("option", { key: m.id, value: m.id }, m.name);
                  }),
                ),
              )
            : null,

          /* ---- foot ---- */
          React.createElement("div", { className: "modal-foot" },
            React.createElement("div", { className: "kbd" },
              React.createElement("kbd", null, "Esc"),
              t('kbd.esc_cancel', lang),
            ),
            React.createElement("div", { className: "sp" }),

            isEdit
              ? React.createElement(Fragment, null,
                  React.createElement("button", {
                    className: "btn btn-icon",
                    onClick: function () { setShowDelete(!showDelete); },
                    title: t('action.delete', lang),
                    type: "button",
                  },
                    React.createElement(Icon, { name: "trash" }),
                  ),
                  React.createElement("button", {
                    className: "btn",
                    onClick: onClose,
                    type: "button",
                  }, t('action.cancel', lang)),
                  React.createElement("button", {
                    className: "btn btn-accent",
                    disabled: !valid && touched,
                    onClick: handleSubmit,
                    type: "button",
                  }, t('action.save', lang)),
                )
              : React.createElement(Fragment, null,
                  React.createElement("button", {
                    className: "btn",
                    onClick: onClose,
                    type: "button",
                  }, t('action.cancel', lang)),
                  React.createElement("button", {
                    className: "btn btn-accent",
                    disabled: !valid && touched,
                    onClick: handleSubmit,
                    type: "button",
                  },
                    React.createElement(Icon, { name: "plus" }),
                    " " + t('action.create_task', lang),
                    React.createElement("div", { className: "kbd" },
                      React.createElement("kbd", null, "⌘"),
                      React.createElement("kbd", null, "Enter"),
                    ),
                  ),
                ),
          ),
        ),
      ),
    );
  }

  // ============================================================ Cheatsheet
  function Cheatsheet(props) {
    var onClose = props.onClose;
    var lang = props.lang || 'en';

    var SHORTCUTS = [
      { label: t('cheat.new_task', lang),      keys: ["N"] },
      { label: t('cheat.filter_board', lang),  keys: ["1–6"] },
      { label: t('cheat.screensaver', lang),   keys: ["S"] },
      { label: t('cheat.close', lang),         keys: ["Esc"] },
      { label: t('cheat.move_card', lang),     keys: ["←", "→"] },
      { label: t('cheat.edit_card', lang),     keys: ["Enter"] },
      { label: t('cheat.select_next', lang),   keys: ["Tab"] },
      { label: t('cheat.tutorial', lang),      keys: ["?"] },
      { label: t('cheat.cheatsheet', lang),    keys: ["h"] },
    ];

    // ---- keyboard: Esc or ? closes --------------------------------------
    useEffect(function () {
      function onKey(e) {
        if (e.key === "Escape" || e.key === "h") onClose();
      }
      window.addEventListener("keydown", onKey);
      return function () { window.removeEventListener("keydown", onKey); };
    });

    function handleOverlayClick(e) {
      if (e.target === e.currentTarget) onClose();
    }

    // ---- render ----------------------------------------------------------
    return React.createElement("div", {
      className: "cheatsheet-overlay",
      onClick: handleOverlayClick,
    },
      React.createElement("div", { className: "cheatsheet-popover" },
        React.createElement("h3", null, t('cheatsheet.title', lang)),

        SHORTCUTS.map(function (s, i) {
          var children = [
            React.createElement("span", { className: "label", key: "l" }, s.label),
          ];
          s.keys.forEach(function (k, j) {
            children.push(React.createElement("kbd", { key: "k" + j }, k));
          });
          return React.createElement("div", { className: "cheatsheet-row", key: i }, children);
        }),

        React.createElement("div", { className: "cheatsheet-close" },
          t('cheat.dismiss', lang),
        ),
      ),
    );
  }

  // ============================================================ CancelReasonModal
  function CancelReasonModal(props) {
    var card = props.card;
    var lang = props.lang || 'en';
    var onConfirm = props.onConfirm;
    var onClose = props.onClose;

    var _reason = useState('');
    var reason = _reason[0]; var setReason = _reason[1];

    // Esc closes without deleting
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') onClose(); }
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, []);

    function handleOverlayClick(e) {
      if (e.target === e.currentTarget) onClose();
    }

    return React.createElement('div', { className: 'overlay', onClick: handleOverlayClick },
      React.createElement('div', { className: 'modal', style: { maxWidth: 420 } },

        React.createElement('div', { className: 'modal-head' },
          React.createElement('h3', null, t('cancel.title', lang)),
          React.createElement('span', { className: 'sub' }, card.title),
        ),

        React.createElement('div', { className: 'modal-body' },
          React.createElement('textarea', {
            className: 'textarea',
            rows: 3,
            style: { width: '100%', resize: 'vertical' },
            placeholder: t('cancel.placeholder', lang),
            value: reason,
            onChange: function (e) { setReason(e.target.value); },
            autoFocus: true,
          }),
        ),

        React.createElement('div', { className: 'modal-foot' },
          React.createElement('div', { className: 'sp' }),
          React.createElement('button', {
            className: 'btn',
            onClick: onClose,
            type: 'button',
          }, t('cancel.keep', lang)),
          React.createElement('button', {
            className: 'btn btn-coral',
            onClick: function () { onConfirm(card.id, reason); },
            type: 'button',
          }, t('cancel.confirm', lang)),
        ),
      ),
    );
  }

  // ---- export to window --------------------------------------------------
  window.CardModal = CardModal;
  window.Cheatsheet = Cheatsheet;
  window.CancelReasonModal = CancelReasonModal;
})();
