function returnedQuantities(returns, deliveries) {
  const result = new Map();
  for (const row of returns) {
    const id = Number(row.penjualan_interior_item_id);
    result.set(id, (result.get(id) || 0) + Number(row.qty_retur || 0));
  }
  for (const doc of deliveries) for (const row of doc.items || []) {
    const id = Number(row.penjualan_interior_item_id);
    result.set(id, (result.get(id) || 0) - Number(row.qty || 0));
  }
  return result;
}
module.exports = { returnedQuantities };
