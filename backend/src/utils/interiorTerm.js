const { interiorItemAmounts } = require('./interiorVat');
const { interiorCosts, interiorTotal } = require('./interiorCosts');
const money = value => Math.round(Number(value || 0));

function interiorTerm(sale, term) {
  const items = sale.items || [];
  const full = items.map(item => interiorItemAmounts(item, sale));
  const percent = Number(term.persen);
  const hasPercent = Number.isFinite(percent) && percent > 0 && percent <= 100;
  const hasNominal = term.jumlah !== undefined && term.jumlah !== null && String(term.jumlah).trim() !== '';
  const target = money(term.jumlah);
  const project = interiorTotal(sale).total;
  if (hasNominal && (!Number.isFinite(Number(term.jumlah)) || target <= 0 || target > project)) return null;
  if (!hasNominal && !hasPercent) return null;
  const lines = full.map(amount => ({ subtotal: money(amount.subtotal * percent / 100), total: money(amount.total * percent / 100) }));
  let costs = interiorCosts(sale, percent / 100);
  const percentageTotal = lines.reduce((sum, item) => sum + item.total, 0) + costs.total;
  // Proforma displays the stored nominal. A rounded percentage is only a label;
  // it must not silently change that nominal when a Sub-Invoice is issued.
  if (hasNominal && (!hasPercent || percentageTotal !== target)) {
    const allCosts = interiorCosts(sale);
    const weights = [...full.map(amount => Math.max(0, amount.total)), allCosts.biaya_assembly, allCosts.biaya_kirim];
    const weight = weights.reduce((sum, value) => sum + value, 0);
    if (weight <= 0) return null;
    const shares = weights.map((value, index) => ({ index, raw: value * target / weight, amount: Math.floor(value * target / weight) }));
    const rest = target - shares.reduce((sum, share) => sum + share.amount, 0);
    const ranked = [...shares].sort((a, b) => (b.raw - b.amount) - (a.raw - a.amount) || a.index - b.index);
    for (let n = 0; n < rest; n++) ranked[n].amount++;
    for (let index = 0; index < full.length; index++) {
      const total = shares[index].amount;
      const subtotal = full[index].total > 0 ? money(total * full[index].subtotal / full[index].total) : 0;
      lines[index] = { subtotal, total };
    }
    costs = { biaya_assembly: shares[full.length].amount, biaya_kirim: shares[full.length + 1].amount };
    costs.total = costs.biaya_assembly + costs.biaya_kirim;
  }
  const subtotal = lines.reduce((sum, item) => sum + item.subtotal, 0);
  const goods = lines.reduce((sum, item) => sum + item.total, 0);
  return { items: lines, costs, subtotal, ppn: goods - subtotal, total: goods + costs.total,
    percent: hasPercent ? percent : target / project * 100 };
}

function validateInteriorTerms(sale, terms) {
  if (!Array.isArray(terms)) throw Object.assign(new Error('Termin harus berupa daftar'), { status: 400 });
  const types = ['DP', 'TERMIN_1', 'TERMIN_2', 'TERMIN_3', 'PELUNASAN_AKHIR', 'PELUNASAN_PENUH'];
  let total = 0;
  for (const term of terms) {
    const allocation = term && interiorTerm(sale, term);
    if (!allocation || !types.includes(term.tipe || 'DP')) throw Object.assign(new Error('Nominal atau persentase termin tidak valid'), { status: 400 });
    total += allocation.total;
  }
  if (total > interiorTotal(sale).total) throw Object.assign(new Error('Total termin melebihi nilai proyek'), { status: 400 });
}
module.exports = { interiorTerm, validateInteriorTerms };
