function interiorItemAmounts(item = {}, sale = {}, quantity) {
  item = item || {};
  sale = sale || {};
  const qty = Number(quantity ?? item.qty ?? 0);
  const unit = item.harga_satuan !== undefined && item.harga_satuan !== null
    ? Number(item.harga_satuan) : Number(item.subtotal || 0) / Number(item.qty || 1);
  const rate = sale.pakai_ppn ? Number(sale.ppn_persen || 0) : 0;
  // Match the existing Interior invoice: round the VAT-inclusive unit, then multiply qty.
  const inclusiveUnit = rate > 0 ? Math.round(unit * (1 + rate / 100)) : unit;
  const subtotal = unit * qty;
  const total = inclusiveUnit * qty;
  return { subtotal, ppn: total - subtotal, total };
}

function interiorGoodsAmounts(items = [], sale = {}) {
  const sums = items.reduce((sum, item) => {
    const amount = interiorItemAmounts(item, sale);
    return { subtotal: sum.subtotal + amount.subtotal, total: sum.total + amount.total };
  }, { subtotal: 0, total: 0 });
  const subtotal = Math.round(sums.subtotal);
  const total = Math.round(sums.total);
  return { subtotal, ppn: total - subtotal, total };
}

function interiorTermAmounts(items = [], sale = {}, percent = 100) {
  const sums = items.reduce((sum, item) => {
    const amount = interiorItemAmounts(item, sale);
    return { subtotal: sum.subtotal + Math.round(amount.subtotal * percent / 100), total: sum.total + Math.round(amount.total * percent / 100) };
  }, { subtotal: 0, total: 0 });
  return { ...sums, ppn: sums.total - sums.subtotal };
}

module.exports = { interiorItemAmounts, interiorGoodsAmounts, interiorTermAmounts };
