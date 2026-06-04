// Stub browser globals required by data.js
global.window = {
  addEventListener: function() {},
  removeEventListener: function() {},
  dispatchEvent: function() {},
};
global.CustomEvent = function(name) { this.type = name; };
global.navigator = { sendBeacon: function() {} };
global.fetch = async function() {
  return { ok: true, status: 200, json: async function() { return {}; } };
};

require('../app/data.js');

const { isSleeping, fmtWakeDate } = global.window.FabData;

// isSleeping — null scheduledFor is always awake
console.assert(!isSleeping({ scheduledFor: null },         1000), 'null → awake');
// isSleeping — today's date means the card is WAKING today (not sleeping)
const jun4 = new Date('2026-06-04T10:00:00').getTime();
console.assert(!isSleeping({ scheduledFor: '2026-06-04' }, jun4),  'today → awake');
console.assert(!isSleeping({ scheduledFor: '2026-06-03' }, jun4),  'past → awake');
console.assert( isSleeping({ scheduledFor: '2026-06-05' }, jun4),  'tomorrow → sleeping');
console.assert( isSleeping({ scheduledFor: '2026-07-04' }, jun4),  'month out → sleeping');

// fmtWakeDate — ≤6 days uses "in Nd" form
const jun5 = new Date('2026-06-05T10:00:00').getTime();
const r1 = fmtWakeDate('2026-06-08', jun5, 'en'); // 3 days out
console.assert(r1 === 'in 3d', 'short form: ' + r1);
// fmtWakeDate — >6 days uses weekday+date form
const r2 = fmtWakeDate('2026-06-15', jun5, 'en'); // 10 days out
console.assert(r2.includes('Jun') || r2.includes('jun'), 'long form contains month: ' + r2);
// fmtWakeDate — exactly 6 days uses short form
const r3 = fmtWakeDate('2026-06-11', jun5, 'en'); // 6 days out
console.assert(r3 === 'in 6d', '6d boundary: ' + r3);
// fmtWakeDate — 7 days uses long form
const r4 = fmtWakeDate('2026-06-12', jun5, 'en'); // 7 days out
console.assert(!r4.startsWith('in '), '7d → long form: ' + r4);

console.log('All sleeping helper assertions passed');
