const { Op, fn, col, where } = require('sequelize');
const key = row => `${row.faktur || 'NON_FAKTUR'}:${String(row.nama_customer || 'Tanpa Nama').trim().toLowerCase().replace(/\s+/g, ' ')}`;

// Discover customer groups from lightweight document metadata first. Load all
// history for those groups afterwards, including other projects and old advances.
async function searchInteriorProjects(models, saleWhere, documentWhere, search) {
  const { PenjualanInterior, InvoiceInterior, PembayaranInterior, ProformaInvoice } = models;
  const textMatch = (description, reference) => where(fn('LOCATE', String(search).toLowerCase(), fn('LOWER', fn('CONCAT_WS', ' ',
    fn('COALESCE', fn('NULLIF', col('penjualan.nama_customer'), ''), 'Tanpa Nama'),
    fn('NULLIF', col('penjualan.no_po'), ''), description, fn('NULLIF', reference, ''), 'INTERIOR',
  ))), { [Op.gt]: 0 });
  const include = [{ model: PenjualanInterior, as: 'penjualan', where: saleWhere, attributes: ['id', 'nama_customer', 'faktur'] }];
  const invoiceMatch = (alias, reference, label) => {
    const ref = col(`${alias}.${reference}`);
    return { [Op.or]: [
      textMatch(fn('CONCAT', label, ' Interior ', ref), ref),
      textMatch(fn('CONCAT', 'Uang muka dipakai untuk Invoice Interior ', ref), ref),
    ] };
  };
  const [invoices, payments, subs] = await Promise.all([
    InvoiceInterior.findAll({ attributes: ['penjualan_interior_id'], include,
      where: { ...documentWhere, ...invoiceMatch('invoice_interior', 'nomor_invoice', 'Invoice') } }),
    PembayaranInterior.findAll({ attributes: ['penjualan_interior_id'], include, where: { ...documentWhere,
      [Op.and]: [textMatch(fn('CONCAT', 'Pembayaran Interior ', col('pembayaran_interior.tipe'),
        fn('COALESCE', fn('CONCAT', ' - ', fn('NULLIF', col('pembayaran_interior.catatan'), '')), '')),
      col('pembayaran_interior.tipe'))] } }),
    ProformaInvoice.findAll({ attributes: ['penjualan_interior_id'], include,
      where: { ...documentWhere, nomor_sub_invoice: { [Op.ne]: null }, ...invoiceMatch('proforma_invoice', 'nomor_sub_invoice', 'Sub-Invoice') } }),
  ]);
  const matched = new Set([...invoices, ...payments, ...subs].filter(row => row.penjualan).map(row => key(row.penjualan)));
  if (!matched.size) return [];
  const projects = await PenjualanInterior.findAll({ where: saleWhere, attributes: ['id', 'nama_customer', 'faktur'] });
  return projects.filter(row => matched.has(key(row))).map(row => Number(row.id));
}

module.exports = { searchInteriorProjects };
