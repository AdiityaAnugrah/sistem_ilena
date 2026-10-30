const money = value => Math.round(Number(value || 0));

function optionalCost(value, label) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  const validType = typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim()));
  const amount = Number(value);
  if (!validType || !Number.isFinite(amount) || amount < 0 || amount > 999999999.99) {
    throw Object.assign(new Error(`${label} harus berupa angka 0 sampai 999999999.99`), { status: 400 });
  }
  return amount === 0 ? null : amount;
}

function itemSubtotal(sale = {}) {
  return (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || Number(item.qty || 0) * Number(item.harga_satuan || 0)), 0);
}

// Optional project costs are added separately; the existing goods VAT rule stays intact.
// Partial shipment/term invoices receive only their proportional share of these costs.
function interiorCosts(sale = {}, ratio = 1) {
  const proportion = Math.max(0, Math.min(1, Number(ratio) || 0));
  const biaya_assembly = money(Number(sale.biaya_assembly || 0) * proportion);
  const biaya_kirim = money(Number(sale.biaya_kirim || 0) * proportion);
  return { biaya_assembly, biaya_kirim, total: biaya_assembly + biaya_kirim };
}

function invoiceCosts(sale = {}, goodsSubtotal) {
  const projectSubtotal = itemSubtotal(sale);
  return interiorCosts(sale, projectSubtotal > 0 ? Number(goodsSubtotal) / projectSubtotal : 1);
}

function interiorTotal(sale = {}, goodsSubtotal = itemSubtotal(sale)) {
  const subtotal = money(goodsSubtotal);
  const ppn = sale.pakai_ppn ? money(subtotal * Number(sale.ppn_persen || 0) / 100) : 0;
  const costs = interiorCosts(sale);
  return { subtotal, ppn, ...costs, total: subtotal + ppn + costs.total };
}

module.exports = { optionalCost, itemSubtotal, interiorCosts, invoiceCosts, interiorTotal };
