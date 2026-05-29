/* ============================================================
   FABLAB UTP — On-demand tutorial overlay
   Spotlight + tooltip walkthrough. Pure CSS/JS, no libraries.
   7 steps, skippable at any time, no forced onboarding.
   ============================================================ */
const t = window.I18n ? window.I18n.t : function(k) { return k; };

function Tutorial({ onClose, lang = 'en' }) {
  const [step, setStep] = React.useState(0);
  const [spot, setSpot] = React.useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tip, setTip] = React.useState({ top: 0, left: 0 });

  const STEPS = [
    {
      title: t('tut.step1_title', lang),
      selector: ".board",
      fallback: ".app",
      position: "center",
      text: t('tut.step1_text', lang),
    },
    {
      title: t('tut.step2_title', lang),
      selector: ".column-body .card:first-child",
      fallback: ".board",
      position: "right",
      text: t('tut.step2_text', lang),
    },
    {
      title: t('tut.step3_title', lang),
      selector: ".member-strip",
      fallback: ".topbar",
      position: "below",
      text: t('tut.step3_text', lang),
    },
    {
      title: t('tut.step4_title', lang),
      selector: ".add-task:first-of-type",
      fallback: ".column-body:first-of-type",
      position: "above",
      text: t('tut.step4_text', lang),
    },
    {
      title: t('tut.step5_title', lang),
      selector: ".column-body:nth-of-type(2) .card:first-child",
      fallback: ".board",
      position: "right",
      text: t('tut.step5_text', lang),
    },
    {
      title: t('tut.step6_title', lang),
      selector: ".claim-btn:first-of-type",
      fallback: ".column-body:nth-of-type(2)",
      position: "right",
      text: t('tut.step6_text', lang),
    },
    {
      title: t('tut.step7_title', lang),
      selector: ".board",
      fallback: ".app",
      position: "center",
      text: t('tut.step7_text', lang),
    },
  ];

  // ---- measure target element and position spotlight + tooltip ----------
  React.useEffect(() => {
    function measure() {
      var s = STEPS[step];
      var el = document.querySelector(s.selector);
      if (!el) el = document.querySelector(s.fallback);
      if (!el) el = document.querySelector(".app");

      var r = el.getBoundingClientRect();
      var pad = 6;
      var newSpot = {
        top: r.top - pad,
        left: r.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
      setSpot(newSpot);

      // Position tooltip relative to viewport
      var tw = 330; // tooltip width
      var margin = 20;

      var pos = s.position || "right";
      var tx, ty;

      if (pos === "center") {
        tx = (window.innerWidth - tw) / 2;
        ty = (window.innerHeight - 200) / 2;
      } else if (pos === "right") {
        tx = r.right + 24;
        ty = r.top + r.height / 2 - 100;
        if (tx + tw > window.innerWidth - margin) tx = r.left - tw - 24;
        if (tx < margin) tx = margin;
      } else if (pos === "left") {
        tx = r.left - tw - 24;
        ty = r.top + r.height / 2 - 100;
        if (tx < margin) tx = r.right + 24;
        if (tx + tw > window.innerWidth - margin) tx = window.innerWidth - tw - margin;
      } else if (pos === "below") {
        tx = r.left + r.width / 2 - tw / 2;
        ty = r.bottom + 24;
        if (tx < margin) tx = margin;
        if (tx + tw > window.innerWidth - margin) tx = window.innerWidth - tw - margin;
      } else if (pos === "above") {
        tx = r.left + r.width / 2 - tw / 2;
        ty = r.top - 240;
        if (ty < margin) ty = r.bottom + 24;
        if (tx < margin) tx = margin;
        if (tx + tw > window.innerWidth - margin) tx = window.innerWidth - tw - margin;
      }

      ty = Math.max(margin, Math.min(ty, window.innerHeight - 280));
      setTip({ top: ty, left: tx });
    }

    measure();
    window.addEventListener("resize", measure);
    return function () { window.removeEventListener("resize", measure); };
  }, [step]);

  // ---- keyboard --------------------------------------------------------
  React.useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") { setStep(function (s) { return Math.max(0, s - 1); }); return; }
      if (e.key === "ArrowRight") {
        setStep(function (s) { return s < STEPS.length - 1 ? s + 1 : s; });
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  var isLast = step === STEPS.length - 1;
  var isFirst = step === 0;
  var current = STEPS[step];

  return (
    <div className="tutorial-overlay" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      {/* Spotlight — transparent div with massive box-shadow creating the cutout */}
      <div
        className="tutorial-spotlight"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
        }}
      />

      {/* Tooltip card */}
      <div
        className="tutorial-tooltip"
        style={{ top: tip.top, left: tip.left }}
      >
        <div className="tutorial-step-badge">{t('tut.step_counter', lang).replace('{a}', step+1).replace('{b}', STEPS.length)}</div>
        <h3>{current.title}</h3>
        <p dangerouslySetInnerHTML={{ __html: t('tut.step' + (step+1) + '_text', lang) }} />

        <div className="tutorial-nav">
          {!isFirst ? (
            <button className="btn" onClick={function () { setStep(step - 1); }}>
              <Icon name="arrow-left" /> {t('tut.back', lang)}
            </button>
          ) : <span />}
          <span className="tutorial-dots">
            {STEPS.map(function (_, i) {
              return React.createElement("span", {
                key: i,
                className: "tutorial-dot" + (i === step ? " active" : ""),
                onClick: function () { setStep(i); },
              });
            })}
          </span>
          {!isLast ? (
            <button className="btn btn-accent" onClick={function () { setStep(step + 1); }}>
              {t('tut.next', lang)} <Icon name="arrow-right" />
            </button>
          ) : (
            <button className="btn btn-accent" onClick={onClose}>
              {t('tut.done', lang)} <Icon name="check" />
            </button>
          )}
        </div>

        <button className="tutorial-skip" onClick={onClose}>
          {t('tut.skip', lang)}
        </button>
      </div>
    </div>
  );
}

window.Tutorial = Tutorial;
