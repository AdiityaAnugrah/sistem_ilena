const { interiorTerm } = require('./interiorTerm');
const money = value => Math.round(Number(value || 0));
const plain = row => typeof row.toJSON === 'function' ? row.toJSON() : row;

// Sub-Invoice.total is the WHOLE project, not the selected installment.
// Match Sub-Invoice: allocate each VAT-inclusive line to the selected term.
function subInvoiceTerms(doc) {
  let terms;
  try { terms = typeof doc.terms === 'string' ? JSON.parse(doc.terms) : doc.terms; } catch { return []; }
  if (!Array.isArray(terms)) return [];
  const sale = doc.penjualan || {};
  return terms.flatMap(term => {
    const amount = term && interiorTerm(sale, term);
    if (!amount) return [];
    return [{ type: term.tipe || 'DP', subtotal: amount.subtotal + amount.costs.total, ppn: amount.ppn, total: amount.total }];
  });
}

// Shipment invoices and installment invoices represent the same project debt.
// Recognize only the increase in max(cumulative shipments, cumulative terms).
// Reissued terms use a per-type high-water mark; full settlement replaces, not
// adds to, ordinary terms. Distinct DP/termin/final installments stay separate.
async function buildEffectiveInteriorInvoices(invoices = [], proformas = [], getInvoiceAmount) {
  const events = [];
  for (const row of invoices) {
    const doc = plain(row);
    events.push({ doc: { ...doc, ledgerKey: Number(doc.id) }, amount: await getInvoiceAmount(row) });
  }
  for (const row of proformas) {
    const doc = plain(row);
    if (!String(doc.nomor_sub_invoice || '').trim()) continue;
    const terms = subInvoiceTerms(doc);
    if (!terms.length) continue;
    events.push({ doc: { ...doc, ledgerKey: `SUB-${doc.id}`, documentType: 'SUB_INVOICE', nomor_invoice: doc.nomor_sub_invoice }, terms });
  }
  events.sort((a, b) => String(a.doc.tanggal).localeCompare(String(b.doc.tanggal))
    || Number(a.doc.id) - Number(b.doc.id)
    || String(a.doc.ledgerKey).localeCompare(String(b.doc.ledgerKey)));
  const states = new Map();
  const result = [];
  for (const event of events) {
    const saleId = Number(event.doc.penjualan_interior_id || event.doc.penjualan?.id);
    if (!saleId) continue;
    if (!states.has(saleId)) states.set(saleId, { shipments: { subtotal: 0, total: 0 }, terms: new Map(), recognized: 0, recognizedNet: 0 });
    const state = states.get(saleId);
    let amount = event.amount;
    if (event.terms) {
      const documentTerms = new Map();
      for (const term of event.terms) {
        const before = documentTerms.get(term.type) || { subtotal: 0, total: 0 };
        documentTerms.set(term.type, { subtotal: before.subtotal + term.subtotal, total: before.total + term.total });
      }
      for (const [type, value] of documentTerms) if (value.total >= (state.terms.get(type)?.total || 0)) state.terms.set(type, value);
      amount = event.terms.reduce((sum, term) => ({ subtotal: sum.subtotal + term.subtotal, ppn: sum.ppn + term.ppn, total: sum.total + term.total }), { subtotal: 0, ppn: 0, total: 0 });
    } else {
      state.shipments.total = money(state.shipments.total + amount.total);
      state.shipments.subtotal = money(state.shipments.subtotal + amount.subtotal);
    }
    const ordinaryTerms = [...state.terms].reduce((sum, [type, value]) => type === 'PELUNASAN_PENUH' ? sum : ({ subtotal: sum.subtotal + value.subtotal, total: sum.total + value.total }), { subtotal: 0, total: 0 });
    const target = [ordinaryTerms, state.terms.get('PELUNASAN_PENUH') || { subtotal: 0, total: 0 }, state.shipments]
      .reduce((best, value) => value.total >= best.total ? value : best);
    const billed = money(target.total);
    const increase = money(billed - state.recognized);
    const subtotal = money(target.subtotal - state.recognizedNet);
    state.recognized = billed;
    state.recognizedNet = money(target.subtotal);
    if (increase === 0 && subtotal === 0) continue;
    result.push({ ...event.doc, _ledgerAmount: { subtotal, ppn: increase - subtotal, total: increase } });
  }
  return result;
}

module.exports = { buildEffectiveInteriorInvoices };
