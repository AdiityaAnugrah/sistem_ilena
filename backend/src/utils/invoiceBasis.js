const { Op } = require('sequelize');
const { selectLatestBySale } = require('./financialDocuments');
const { createInteriorFinance } = require('./interiorFinance');
const { buildEffectiveInteriorInvoices } = require('./interiorReceivables');
const { buildOnlineJournal } = require('./onlineJournal');
const { searchInteriorProjects } = require('./interiorLedgerScope');
const money = value => Math.round(Number(value || 0));
const customerKey = value => String(value || 'Tanpa Nama').trim().toLowerCase().replace(/\s+/g, ' ');
const plain = value => value?.toJSON ? value.toJSON() : value;
const inPeriod = (date, from, to) => (!from || date >= from) && (!to || date <= to);

function allocate(documents, payments, credits) {
  const entries = [], journal = [], balances = new Map();
  const line = (account_code, debit = 0, kredit = 0) => ({ account_code, debit, kredit });
  const events = [...documents.map(row => ({ ...row, event: 'INVOICE' })),
    ...payments.map(row => ({ ...row, event: 'PAYMENT' })), ...credits.map(row => ({ ...row, event: 'RETUR' }))];
  const priority = { INVOICE: 0, RETUR: 1, PAYMENT: 2 };
  events.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || priority[a.event] - priority[b.event] || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  for (const row of events) {
    const key = `${row.sumber}:${row.saleId}`;
    if (!balances.has(key)) balances.set(key, { due: 0, advance: 0, paid: 0 });
    const state = balances.get(key);
    const ledger = (id, jenis, debit, kredit, keterangan) => {
      if (!debit && !kredit) return;
      entries.push({ ...row, id, jenis, debit, kredit, keterangan });
    };
    const post = (id, jenis, nilai, lines, keterangan) => {
      if (nilai > 0) journal.push({ ...row, id, jenis, nilai, lines, keterangan });
    };
    if (row.event === 'INVOICE') {
      const used = Math.min(state.advance, row.gross);
      state.due += row.gross - used; state.advance -= used; state.paid += used;
      ledger(row.id, 'INVOICE', row.gross, 0, row.keterangan);
      post(row.id, 'INVOICE', row.gross, [line('1201', row.gross), line(row.sumber === 'OFFLINE' ? '4101' : '4102', 0, row.net), ...(row.tax ? [line('2101', 0, row.tax)] : [])], row.keterangan);
      ledger(`${row.id}-UM`, 'UANG_MUKA_TERPAKAI', 0, used, `Uang muka dipakai untuk Invoice ${row.sumber === 'INTERIOR' ? 'Interior' : 'Offline'} ${row.referensi}`);
      post(`${row.id}-UM`, 'UANG_MUKA_TERPAKAI', used, [line('2102', used), line('1201', 0, used)], 'Uang muka dipakai untuk invoice');
    } else if (row.event === 'PAYMENT') {
      const normal = Math.min(state.due, row.gross), advance = row.gross - normal;
      state.due -= normal; state.advance += advance; state.paid += normal;
      ledger(row.id, 'PEMBAYARAN', 0, normal, row.keterangan);
      const account = { TUNAI: '1101', TRANSFER: '1102', QRIS: '1103', EDC: '1104', MARKETPLACE: '1105' }[row.raw.metode] || '1109';
      post(row.id, 'PEMBAYARAN', row.gross, [line(account, row.gross), ...(normal ? [line('1201', 0, normal)] : []), ...(advance ? [line('2102', 0, advance)] : [])], row.keterangan);
    } else {
      const applied = Math.min(state.due, row.gross), excess = row.gross - applied;
      state.due -= applied; state.advance += excess; state.paid = Math.max(0, state.paid - excess);
      ledger(row.id, 'RETUR', 0, applied, row.keterangan);
      post(row.id, 'RETUR', row.gross, [line('4201', row.net), ...(row.tax ? [line('2101', row.tax)] : []), ...(applied ? [line('1201', 0, applied)] : []), ...(excess ? [line('2102', 0, excess)] : [])], row.keterangan);
    }
  }
  return { entries, journal, balances };
}

function createInvoiceBasis(models) {
  const finance = createInteriorFinance(models);
  async function load({ source = '', isTest = 0, to = '', scope = {} } = {}) {
    const documents = [], payments = [], credits = [], onlineEntries = [], onlineJournal = [];
    const documentWhere = to ? { tanggal: { [Op.lte]: to } } : {};
    const sources = ['OFFLINE', 'INTERIOR', 'ONLINE'].filter(value => !source || value === source);
    for (const sumber of sources) {
      const suffix = sumber === 'OFFLINE' ? 'Offline' : sumber === 'INTERIOR' ? 'Interior' : 'Online';
      const parent = models[`Penjualan${suffix}`], item = models[`Penjualan${suffix}Item`];
      const invoiceModel = sumber === 'OFFLINE' ? models.Invoice : models[`Invoice${suffix}`];
      const paymentModel = models[`Pembayaran${suffix}`];
      const saleWhere = { is_test: isTest, ...(scope.faktur ? { faktur: scope.faktur } : {}) };
      if (sumber === 'INTERIOR' && !scope.customer_key && scope.search) {
        saleWhere.id = { [Op.in]: await searchInteriorProjects(models, saleWhere, documentWhere, scope.search) };
      } else if (scope.customer_key) {
        const metadata = await parent.findAll({ where: saleWhere, attributes: ['id', sumber === 'OFFLINE' ? 'nama_penerima' : sumber === 'INTERIOR' ? 'nama_customer' : 'nama_pelanggan', 'faktur'] });
        saleWhere.id = { [Op.in]: metadata.filter(row => {
          const name = row.nama_customer || row.nama_penerima || row.nama_pelanggan;
          return [customerKey(name), `${sumber}:${row.faktur || 'NON_FAKTUR'}:${customerKey(name)}`].includes(scope.customer_key);
        }).map(row => row.id) };
      }
      const include = [{ model: parent, as: 'penjualan', where: saleWhere, include: [{ model: item, as: 'items' }] }];
      const [invoices, paid, subs, returned] = await Promise.all([
        invoiceModel.findAll({ where: documentWhere, include }),
        paymentModel.findAll({ where: documentWhere, include: [{ model: parent, as: 'penjualan', where: saleWhere }] }),
        sumber === 'INTERIOR' ? models.ProformaInvoice.findAll({ where: { ...documentWhere, nomor_sub_invoice: { [Op.ne]: null } }, include }) : [],
        sumber === 'OFFLINE' ? models.ReturOffline.findAll({ where: documentWhere, include: [{ model: parent, as: 'penjualan', where: saleWhere }, { model: item, as: 'item' }] })
          : sumber === 'ONLINE' ? models.ReturOnline.findAll({ where: { ...documentWhere, tipe: 'PENGEMBALIAN_DANA' }, include }) : [],
      ]);
      const normalize = (row, id, amount, keterangan) => {
        const sale = plain(row.penjualan), saleId = Number(row[`penjualan_${sumber.toLowerCase()}_id`] || sale?.id);
        return { id: `${sumber}-${id}`, sumber, saleId, sale, raw: row, tanggal: row.tanggal,
          customer: sale?.nama_customer || sale?.nama_penerima || sale?.nama_pelanggan || 'Tanpa Nama',
          faktur: sale?.faktur || 'NON_FAKTUR', no_po: sale?.no_po || sale?.id_pesanan || '',
          referensi: row.nomor_invoice || row.tipe || row.metode || sale?.id_pesanan || '',
          detail_url: `/dashboard/penjualan/${sumber.toLowerCase()}/${saleId}`,
          bukti_endpoint: row.bukti_bayar ? `/penjualan-${sumber.toLowerCase()}/${saleId}/pembayaran/${row.id}/bukti` : null,
          net: amount.net || 0, tax: amount.tax || 0, gross: amount.gross || 0, keterangan };
      };
      const cutoffInvoices = invoices.filter(row => !to || row.tanggal <= to);
      if (sumber === 'ONLINE') {
        const selected = selectLatestBySale(cutoffInvoices, 'penjualan_online_id').filter(row => row.penjualan?.status !== 'DIBATALKAN');
        const parents = new Map(selected.map(row => [Number(row.penjualan_online_id || row.penjualan?.id), row]));
        const sales = new Map([...paid, ...returned, ...selected].map(row => [Number(row.penjualan_online_id || row.penjualan?.id), row.penjualan]));
        const line = (account_code, debit = 0, kredit = 0) => ({ account_code, debit, kredit });
        for (const event of buildOnlineJournal(cutoffInvoices, paid.filter(row => !to || row.tanggal <= to), returned.filter(row => !to || row.tanggal <= to), line)) {
          const saleId = Number(event.detail_url.split('/').at(-1));
          const invoice = parents.get(saleId), sale = sales.get(saleId);
          const common = { ...event, saleId, sale: plain(sale), no_po: sale?.id_pesanan || '', faktur: sale?.faktur || 'NON_FAKTUR' };
          onlineJournal.push(common);
          const debit = event.lines.filter(row => row.account_code === '1201').reduce((sum, row) => sum + row.debit, 0);
          const kredit = event.lines.filter(row => row.account_code === '1201').reduce((sum, row) => sum + row.kredit, 0);
          if (debit || kredit) onlineEntries.push({ ...common, debit, kredit });
          if (event.jenis === 'INVOICE') documents.push({ ...common, raw: invoice, net: event.nilai, tax: 0, gross: event.nilai });
          if (event.jenis === 'RETUR' || event.jenis === 'PENYESUAIAN_RETUR') {
            const net = event.lines.filter(row => row.account_code === '4203').reduce((sum, row) => sum + row.debit, 0);
            if (net && invoice) credits.push({ ...common, net, tax: 0, gross: net });
          }
        }
        continue;
      }
      let effective;
      if (sumber === 'INTERIOR') {
        const amount = await finance.prepareInvoiceAmounts(cutoffInvoices);
        effective = await buildEffectiveInteriorInvoices(cutoffInvoices, subs.filter(row => !to || row.tanggal <= to), amount);
      } else effective = selectLatestBySale(cutoffInvoices, 'penjualan_offline_id');
      const sourceDocuments = [];
      for (const invoice of effective) {
        const amount = sumber === 'INTERIOR' ? await finance.invoiceInteriorAmount(invoice) : (() => {
          const subtotal = money((invoice.penjualan?.items || []).reduce((sum, row) => sum + Number(row.subtotal || 0), 0));
          const ppn = money(subtotal * Number(invoice.ppn_persen || 0) / 100);
          return { subtotal, ppn, total: subtotal + ppn };
        })();
        const label = sumber === 'INTERIOR' ? 'Interior' : 'Offline';
        const doc = normalize(invoice, `INVOICE-${invoice.ledgerKey ?? invoice.id}`, { net: amount.subtotal, tax: amount.ppn, gross: amount.total }, `${invoice.documentType === 'SUB_INVOICE' ? 'Sub-Invoice' : 'Invoice'} ${label} ${invoice.nomor_invoice}`);
        if (doc.gross > 0) { sourceDocuments.push(doc); documents.push(doc); }
      }
      for (const pay of paid.filter(row => !to || row.tanggal <= to)) {
        const amount = money(pay.jumlah);
        if (amount > 0) payments.push(normalize(pay, `PEMBAYARAN-${pay.id}`, { gross: amount }, `Pembayaran ${suffix} ${pay.tipe || pay.metode || ''}${pay.catatan ? ` - ${pay.catatan}` : ''}`));
      }
      if (sumber === 'OFFLINE') {
        const billed = new Map(sourceDocuments.map(row => [row.saleId, row]));
        const cumulative = new Map();
        for (const row of [...returned].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || a.id - b.id)) {
          if (to && row.tanggal > to) continue;
          const invoice = billed.get(Number(row.penjualan_offline_id || row.penjualan?.id));
          if (!invoice) continue;
          const base = Number(row.item?.qty) > 0 ? Number(row.item.subtotal || 0) / Number(row.item.qty) * Number(row.qty_retur || 0) : 0;
          const before = cumulative.get(invoice.saleId) || { net: 0, tax: 0 };
          const net = Math.min(invoice.net, money(before.net + base));
          const tax = invoice.tax - money((invoice.net - net) * Number(invoice.raw.ppn_persen || 0) / 100);
          cumulative.set(invoice.saleId, { net, tax });
          const credit = normalize(row, `RETUR-${row.id}`, { net: net - before.net, tax: tax - before.tax, gross: net - before.net + tax - before.tax }, `Retur Offline${row.catatan ? ` - ${row.catatan}` : ''}`);
          credit.referensi = `Retur #${row.id}`;
          credit.tanggal = row.tanggal < invoice.tanggal ? invoice.tanggal : row.tanggal;
          credits.push(credit);
        }
      }
    }
    const allocation = allocate(documents.filter(row => row.sumber !== 'ONLINE'), payments, credits.filter(row => row.sumber !== 'ONLINE'));
    const entries = [...allocation.entries, ...onlineEntries].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || String(a.id).localeCompare(String(b.id)));
    return { documents, credits, entries, journal: [...allocation.journal, ...onlineJournal], balances: allocation.balances };
  }
  return { load };
}

function invoiceProjects(data, { source = '', from = '', to = '' } = {}) {
  const groups = new Map();
  const creditsByProject = new Map(), entriesByProject = new Map(), paymentsByProject = new Map(), billedByProject = new Map();
  for (const doc of data.documents) {
    const key = `${doc.sumber}:${doc.saleId}`;
    billedByProject.set(key, (billedByProject.get(key) || 0) + doc.gross);
  }
  for (const credit of data.credits) {
    const key = `${credit.sumber}:${credit.saleId}`, total = creditsByProject.get(key) || { net: 0, tax: 0, gross: 0 };
    total.net += credit.net; total.tax += credit.tax; total.gross += credit.gross;
    creditsByProject.set(key, total);
  }
  for (const entry of data.entries) {
    const key = `${entry.sumber}:${entry.saleId}`, total = entriesByProject.get(key) || { due: 0, paid: 0 };
    total.due += entry.debit - entry.kredit;
    if (['PEMBAYARAN', 'UANG_MUKA_TERPAKAI'].includes(entry.jenis)) total.paid += entry.kredit;
    entriesByProject.set(key, total);
  }
  for (const entry of data.journal) if (entry.jenis === 'PEMBAYARAN') {
    const key = `${entry.sumber}:${entry.saleId}`, rows = paymentsByProject.get(key) || [];
    rows.push({ tipe: entry.raw?.tipe || entry.raw?.metode || 'PEMBAYARAN', tanggal: entry.tanggal, jumlah: entry.nilai });
    paymentsByProject.set(key, rows);
  }
  for (const doc of [...data.documents, ...data.credits]) {
    if ((source && doc.sumber !== source) || !inPeriod(doc.tanggal, from, to)) continue;
    const key = `${doc.sumber}:${doc.saleId}`;
    if (!groups.has(key)) groups.set(key, { id: doc.saleId, sumber: doc.sumber, sale: doc.sale, tanggal: doc.tanggal, net: 0, tax: 0, gross: 0, returned: 0, paid: 0, due: 0, pembayarans: [] });
    const row = groups.get(key);
    if (doc.tanggal > row.tanggal) row.tanggal = doc.tanggal;
  }
  for (const [rows, sign] of [[data.documents, 1], [data.credits, -1]]) for (const doc of rows) {
    if (!inPeriod(doc.tanggal, from, to)) continue;
    const project = groups.get(`${doc.sumber}:${doc.saleId}`);
    if (project) {
      project.net += sign * doc.net; project.tax += sign * doc.tax;
      if (sign < 0) project.returned += doc.net;
    }
  }
  for (const row of groups.values()) {
    const key = `${row.sumber}:${row.id}`, balance = data.balances.get(key);
    const credits = creditsByProject.get(key) || { net: 0, tax: 0, gross: 0 };
    row.returned = money(row.returned);
    row.net = money(row.net); row.tax = money(row.tax);
    // Sales are period movements; gross bill/payment/balance remain cumulative
    // through 'to', so old DP is not divided by only this month's final bill.
    row.gross = money(Math.max(0, (billedByProject.get(key) || 0) - credits.gross));
    row.due = money(balance ? balance.due : entriesByProject.get(key)?.due);
    row.paid = money(balance ? balance.paid : entriesByProject.get(key)?.paid);
    row.pembayarans = paymentsByProject.get(key) || [];
  }
  return [...groups.values()];
}
module.exports = { createInvoiceBasis, invoiceProjects };
