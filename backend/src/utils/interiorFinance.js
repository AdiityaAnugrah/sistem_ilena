const { Op } = require('sequelize');
const { invoiceCosts } = require('./interiorCosts');
const { interiorItemAmounts, interiorGoodsAmounts } = require('./interiorVat');
const money = v => Math.round(Number(v || 0));
const customerKey = name => String(name || 'Tanpa Nama').trim().toLowerCase().replace(/\s+/g, ' ');

function createInteriorFinance({ SuratJalanInterior, SuratJalanInteriorItem, PenjualanInteriorItem }) {
  function shipmentIds(inv) {
    if (inv.surat_jalan_ids) {
      try {
        const ids = JSON.parse(inv.surat_jalan_ids);
        return Array.isArray(ids) ? ids.map(Number).filter(id => Number.isInteger(id) && id > 0) : [];
      } catch { return []; }
    }
    return inv.surat_jalan_interior_id ? [Number(inv.surat_jalan_interior_id)] : [];
  }

  async function prepareInvoiceAmounts(invoices) {
    const ids = [...new Set(invoices.flatMap(shipmentIds))];
    if (!ids.length || (ids.length === 1 && invoices.length === 1)) return invoiceInteriorAmount;
    const shipments = new Map();
    // Chunk the IN clause, not the historical ledger: opening balances need all prior events.
    for (let offset = 0; offset < ids.length; offset += 500) {
      const rows = await SuratJalanInterior.findAll({
        where: { id: { [Op.in]: ids.slice(offset, offset + 500) } },
        include: [{ model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] }],
      });
      for (const row of rows) shipments.set(Number(row.id), row);
    }
    return inv => invoiceInteriorAmount(inv, shipments);
  }

  async function invoiceInteriorAmount(inv, shipments) {
    if (inv._ledgerAmount) return inv._ledgerAmount;
    const ids = shipmentIds(inv);

    let subtotal = 0;
    let invoiceGross = 0;
    if (ids.length > 0) {
      const sjs = shipments ? ids.map(id => shipments.get(id)).filter(Boolean) : await SuratJalanInterior.findAll({
        where: { id: { [Op.in]: ids } },
        include: [{ model: SuratJalanInteriorItem, as: 'items', include: [{ model: PenjualanInteriorItem, as: 'item' }] }],
      });
      for (const sj of sjs) {
        for (const sjItem of (sj.items || [])) {
          const amount = interiorItemAmounts(sjItem.item, inv.penjualan, sjItem.qty_kirim);
          subtotal += amount.subtotal;
          invoiceGross += amount.total;
        }
      }
    } else {
      const goods = interiorGoodsAmounts(inv.penjualan?.items || [], inv.penjualan);
      subtotal = goods.subtotal;
      invoiceGross = goods.total;
    }

    subtotal = money(subtotal);
    const ppn = money(invoiceGross) - money(subtotal);
    const costs = invoiceCosts(inv.penjualan, subtotal);
    return { subtotal: subtotal + costs.total, ppn, total: money(subtotal + ppn + costs.total) };
  }


  async function buildInteriorAdvanceState(interiorInvoices, interiorPayments) {
    const byPenjualan = new Map();
    const ensure = (id, penjualan) => {
      if (!byPenjualan.has(id)) byPenjualan.set(id, { penjualan, invoices: [], payments: [] });
      const row = byPenjualan.get(id);
      if (!row.penjualan && penjualan) row.penjualan = penjualan;
      return row;
    };

    for (const inv of interiorInvoices || []) {
      const id = Number(inv.penjualan_interior_id || inv.penjualan?.id);
      if (!id) continue;
      const amount = await invoiceInteriorAmount(inv);
      ensure(id, inv.penjualan).invoices.push({ inv, amount });
    }

    for (const p of interiorPayments || []) {
      const id = Number(p.penjualan_interior_id || p.penjualan?.id);
      if (!id) continue;
      ensure(id, p.penjualan).payments.push(p);
    }

    const normalPaymentAmounts = new Map();
    const usageByInvoice = new Map();
    const history = [];
    const rekapMap = new Map();

    for (const [penjualanId, row] of byPenjualan.entries()) {
      row.invoices.sort((a, b) => String(a.inv.tanggal).localeCompare(String(b.inv.tanggal)) || Number(a.inv.id) - Number(b.inv.id));
      row.payments.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || Number(a.id) - Number(b.id));

      const penjualan = row.penjualan || row.payments[0]?.penjualan || row.invoices[0]?.inv?.penjualan;
      const customer = penjualan?.nama_customer || 'Tanpa Nama';
      const key = `INTERIOR-UM-${penjualanId}`;
      const rekap = {
        key,
        penjualan_interior_id: penjualanId,
        customer_key: customerKey(customer),
        nama_customer: customer,
        no_po: penjualan?.no_po || '',
        faktur: penjualan?.faktur || 'NON_FAKTUR',
        uang_muka_masuk: 0,
        uang_muka_terpakai: 0,
        sisa_uang_muka: 0,
        jumlah_transaksi: 0,
        detail_url: `/dashboard/penjualan/interior/${penjualanId}`,
      };

      let remaining = 0;
      let outstanding = 0;
      const events = [
        ...row.invoices.map(value => ({ type: 'INVOICE', date: value.inv.tanggal, id: Number(value.inv.id), value })),
        ...row.payments.map(value => ({ type: 'PAYMENT', date: value.tanggal, id: Number(value.id), value })),
      ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.type === b.type ? a.id - b.id : a.type === 'INVOICE' ? -1 : 1));

      for (const event of events) {
        if (event.type === 'INVOICE') {
          const { inv, amount } = event.value;
          const invoiceTotal = money(amount.total);
          const used = Math.min(remaining, invoiceTotal);
          remaining = money(remaining - used);
          outstanding = money(outstanding + invoiceTotal - used);
          if (used <= 0) continue;
          usageByInvoice.set(inv.ledgerKey ?? Number(inv.id), used);
          rekap.uang_muka_terpakai += used;
          rekap.jumlah_transaksi += 1;
          history.push({
            id: `UM-TERPAKAI-${inv.ledgerKey ?? inv.id}`, key, penjualan_interior_id: penjualanId,
            tanggal: inv.tanggal, jenis: 'UANG_MUKA_TERPAKAI', referensi: inv.nomor_invoice,
            nama_customer: customer, no_po: rekap.no_po, faktur: rekap.faktur,
            keterangan: `Uang muka dipakai untuk Invoice Interior ${inv.nomor_invoice}`,
            masuk: 0, terpakai: used, sisa: remaining, bukti_endpoint: null, detail_url: rekap.detail_url,
          });
        } else {
          const pay = event.value;
          const amount = money(pay.jumlah);
          if (amount <= 0) continue;
          const normalAmount = Math.min(outstanding, amount);
          normalPaymentAmounts.set(Number(pay.id), normalAmount);
          outstanding = money(outstanding - normalAmount);
          const advanceAmount = money(amount - normalAmount);
          if (advanceAmount <= 0) continue;
          remaining = money(remaining + advanceAmount);
          rekap.uang_muka_masuk += advanceAmount;
          rekap.jumlah_transaksi += 1;
          history.push({
            id: `UM-MASUK-${pay.id}`, key, penjualan_interior_id: penjualanId,
            tanggal: pay.tanggal, jenis: 'UANG_MUKA_MASUK', referensi: pay.tipe,
            nama_customer: customer, no_po: rekap.no_po, faktur: rekap.faktur,
            keterangan: `Uang muka Interior ${pay.tipe}${pay.catatan ? ` - ${pay.catatan}` : ''}`,
            masuk: advanceAmount, terpakai: 0, sisa: remaining,
            bukti_endpoint: pay.bukti_bayar ? `/penjualan-interior/${penjualanId}/pembayaran/${pay.id}/bukti` : null,
            detail_url: rekap.detail_url,
          });
        }
      }

      if (rekap.uang_muka_masuk <= 0 && rekap.uang_muka_terpakai <= 0) continue;

      rekap.uang_muka_masuk = money(rekap.uang_muka_masuk);
      rekap.uang_muka_terpakai = money(rekap.uang_muka_terpakai);
      rekap.sisa_uang_muka = money(rekap.uang_muka_masuk - rekap.uang_muka_terpakai);
      rekap.status = rekap.sisa_uang_muka <= 0 ? 'HABIS_TERPAKAI' : rekap.uang_muka_terpakai > 0 ? 'TERPAKAI_SEBAGIAN' : 'BELUM_TERPAKAI';
      rekapMap.set(key, rekap);
    }

    history.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
    return { normalPaymentAmounts, usageByInvoice, history, rekapRows: [...rekapMap.values()] };
  }


  return { invoiceInteriorAmount, prepareInvoiceAmounts, buildInteriorAdvanceState };
}
module.exports = { createInteriorFinance };
