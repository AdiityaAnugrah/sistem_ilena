const money = value => Math.round(Number(value || 0));
const plain = row => typeof row.toJSON === 'function' ? row.toJSON() : row;

// Sub-Invoice.total is the WHOLE project, not the selected installment.
// Match generateHTMLSubInvoice: round each item/percentage, then VAT for FAKTUR.
function subInvoiceTerms(doc) {
  let terms;
  try { terms = typeof doc.terms === 'string' ? JSON.parse(doc.terms) : doc.terms; } catch { return []; }
  if (!Array.isArray(terms)) return [];
  const sale = doc.penjualan || {};
  return terms.flatMap(term => {
    const percent = parseFloat(term.persen);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) return [];
    const subtotal = (sale.items || []).reduce((sum, item) => {
      const base = Number(item.subtotal) || Number(item.qty || 0) * Number(item.harga_satuan || 0);
      return sum + money(base * percent / 100);
    }, 0);
    const ppn = sale.faktur === 'FAKTUR' && sale.pakai_ppn
      ? money(subtotal * Number(sale.ppn_persen || 0) / 100) : 0;
    return [{ type: term.tipe || 'DP', subtotal, ppn, total: subtotal + ppn }];
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
    if (!states.has(saleId)) states.set(saleId, { shipments: 0, terms: new Map(), recognized: 0 });
    const state = states.get(saleId);
    let amount = event.amount;
    if (event.terms) {
      for (const term of event.terms) state.terms.set(term.type, Math.max(state.terms.get(term.type) || 0, term.total));
      amount = event.terms.reduce((sum, term) => ({ subtotal: sum.subtotal + term.subtotal, ppn: sum.ppn + term.ppn, total: sum.total + term.total }), { subtotal: 0, ppn: 0, total: 0 });
    } else {
      state.shipments = money(state.shipments + amount.total);
    }
    const ordinaryTerms = [...state.terms].reduce((sum, [type, total]) => sum + (type === 'PELUNASAN_PENUH' ? 0 : total), 0);
    const billed = money(Math.max(state.shipments, ordinaryTerms, state.terms.get('PELUNASAN_PENUH') || 0));
    const increase = money(billed - state.recognized);
    state.recognized = billed;
    if (increase <= 0) continue;
    const subtotal = amount.total > 0 ? money(amount.subtotal * increase / amount.total) : 0;
    result.push({ ...event.doc, _ledgerAmount: { subtotal, ppn: increase - subtotal, total: increase } });
  }
  return result;
}

module.exports = { buildEffectiveInteriorInvoices };
