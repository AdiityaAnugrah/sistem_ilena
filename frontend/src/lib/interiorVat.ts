type InteriorItem = { qty?: number | string; harga_satuan?: number | string | null; subtotal?: number | string };
type InteriorTax = { pakai_ppn?: number | boolean; ppn_persen?: number | string | null };

export function interiorGoodsAmounts(items: InteriorItem[] = [], sale: InteriorTax = {}) {
  const sums = items.reduce<{ subtotal: number; total: number }>((sum, item) => {
    const qty = Number(item.qty || 0);
    const unit = item.harga_satuan !== undefined && item.harga_satuan !== null
      ? Number(item.harga_satuan) : Number(item.subtotal || 0) / Number(item.qty || 1);
    const rate = sale.pakai_ppn ? Number(sale.ppn_persen || 0) : 0;
    const inclusiveUnit = rate > 0 ? Math.round(unit * (1 + rate / 100)) : unit;
    return { subtotal: sum.subtotal + unit * qty, total: sum.total + inclusiveUnit * qty };
  }, { subtotal: 0, total: 0 });
  const subtotal = Math.round(sums.subtotal);
  const total = Math.round(sums.total);
  return { subtotal, ppn: total - subtotal, total };
}
