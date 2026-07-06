'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { CircularProgress, Pagination } from '@mui/material';
import { ArrowRight, CheckCircle, Clock, RefreshCw, Info, ChevronDown, Download } from 'lucide-react';
import { getSocket } from '@/lib/socket';

const today = () => new Date().toISOString().split('T')[0];
const firstOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
  <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>{label}</p>
    <p className="text-xl font-black" style={{ color }}>{value}</p>
    {sub && <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{sub}</p>}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    DRAFT:     { label: 'Draft',    bg: '#f8fafc', color: '#64748b' },
    ACTIVE:    { label: 'Aktif',    bg: '#eff6ff', color: '#2563eb' },
    COMPLETED: { label: 'Selesai', bg: '#f0fdf4', color: '#16a34a' },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const escapeXml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const excelCell = (value: unknown, type: 'String' | 'Number' = 'String', style?: string) => {
  const safeValue = type === 'Number' ? Math.round(Number(value || 0)) : escapeXml(value);
  return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${type}">${safeValue}</Data></Cell>`;
};

const sheetName = (name: string) => escapeXml(name.slice(0, 31));
const money = (value: unknown) => Math.round(Number(value || 0));

function worksheetXml(name: string, columns: number[], rows: string, freezeRow = 4) {
  return `
  <Worksheet ss:Name="${sheetName(name)}">
    <Table>
      ${columns.map(width => `<Column ss:Width="${width}"/>`).join('')}
      ${rows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/><FrozenNoSplit/><SplitHorizontal>${freezeRow}</SplitHorizontal><TopRowBottomPane>${freezeRow}</TopRowBottomPane>
      <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;
}

function buildWorkbookXml(title: string, worksheets: string[]) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16" ss:Color="#0f172a"/><Alignment ss:Vertical="Center"/></Style>
    <Style ss:ID="Meta"><Font ss:Size="10" ss:Color="#64748b"/></Style>
    <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#ffffff"/><Interior ss:Color="#b91c1c" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#7f1d1d"/></Borders></Style>
    <Style ss:ID="Number"><NumberFormat ss:Format="#,##0"/></Style>
    <Style ss:ID="Currency"><NumberFormat ss:Format="Rp #,##0"/></Style>
    <Style ss:ID="Summary"><Font ss:Bold="1"/><Interior ss:Color="#fef2f2" ss:Pattern="Solid"/></Style>
  </Styles>
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(title)}</Title>
  </DocumentProperties>
  ${worksheets.join('')}
</Workbook>`;
}

function downloadExcelXml(filename: string, xml: string) {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function KeuanganPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'offline' | 'interior'>('offline');
  const [offlineSubTab, setOfflineSubTab] = useState<'penjualan' | 'display'>('penjualan');
  const [showInfo, setShowInfo] = useState(false);

  // Filter — default semua data
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);
  const [exportLoading, setExportLoading] = useState<'offline' | 'interior' | 'gabungan' | null>(null);

  // Offline state
  const [offlineData, setOfflineData] = useState<any>(null);
  const [offlinePage, setOfflinePage] = useState(1);
  const [offlineLoading, setOfflineLoading] = useState(true);

  // Interior state
  const [interiorData, setInteriorData] = useState<any>(null);
  const [interiorPage, setInteriorPage] = useState(1);
  const [interiorLoading, setInteriorLoading] = useState(true);

  // Realtime: simpan filter & tab terbaru di ref agar bisa dipakai di socket handler
  const stateRef = useRef({ offlinePage, offlineSubTab, interiorPage, from, to });
  useEffect(() => { stateRef.current = { offlinePage, offlineSubTab, interiorPage, from, to }; });

  const fetchOffline = useCallback(async (page: number, tab: string, f: string, t: string) => {
    setOfflineLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', tab, ...(f ? { from: f } : {}), ...(t ? { to: t } : {}) });
      const res = await api.get(`/keuangan/offline?${params}`);
      setOfflineData(res.data);
    } catch { setOfflineData(null); }
    finally { setOfflineLoading(false); }
  }, []);

  const fetchInterior = useCallback(async (page: number, f: string, t: string) => {
    setInteriorLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(f ? { from: f } : {}), ...(t ? { to: t } : {}) });
      const res = await api.get(`/keuangan/interior?${params}`);
      setInteriorData(res.data);
    } catch { setInteriorData(null); }
    finally { setInteriorLoading(false); }
  }, []);

  useEffect(() => { fetchOffline(offlinePage, offlineSubTab, from, to); }, [offlinePage, offlineSubTab, fetchOffline]);
  useEffect(() => { fetchInterior(interiorPage, from, to); }, [interiorPage, fetchInterior]);

  // Realtime — listen ke room penjualan offline & interior
  useEffect(() => {
    const socket = getSocket();
    socket.emit('room:join', { room: 'penjualan-offline-list' });
    socket.emit('room:join', { room: 'penjualan-interior-list' });

    const refresh = () => {
      const s = stateRef.current;
      fetchOffline(s.offlinePage, s.offlineSubTab, s.from, s.to);
      fetchInterior(s.interiorPage, s.from, s.to);
    };

    socket.on('data:updated', refresh);
    return () => {
      socket.emit('room:leave', { room: 'penjualan-offline-list' });
      socket.emit('room:leave', { room: 'penjualan-interior-list' });
      socket.off('data:updated', refresh);
    };
  }, [fetchOffline, fetchInterior]);

  const handleFilter = () => {
    setOfflinePage(1);
    setInteriorPage(1);
    fetchOffline(1, offlineSubTab, from, to);
    fetchInterior(1, from, to);
  };

  const handleReset = () => {
    const f = firstOfYear(), t = today();
    setFrom(f); setTo(t);
    setOfflinePage(1); setInteriorPage(1);
    fetchOffline(1, offlineSubTab, f, t);
    fetchInterior(1, f, t);
  };

  const handleAllData = () => {
    setFrom(''); setTo('');
    setOfflinePage(1); setInteriorPage(1);
    fetchOffline(1, offlineSubTab, '', '');
    fetchInterior(1, '', '');
  };

  const fetchAllKeuangan = async (kind: 'offline' | 'interior', tab?: 'penjualan' | 'display') => {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const rows: any[] = [];
    let summary: any = null;

    do {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(kind === 'offline' && tab ? { tab } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      const res = await api.get(`/keuangan/${kind}?${params}`);
      summary = summary || res.data.summary;
      rows.push(...(res.data.list || []));
      totalPages = res.data.totalPages || 1;
      page += 1;
    } while (page <= totalPages);

    return { summary, rows };
  };

  const filterLabel = `${from ? formatDate(from) : '...'} - ${to ? formatDate(to) : '...'}`;

  const buildSummarySheet = (name: string, title: string, rows: Array<[string, number | string]>) => worksheetXml(
    name,
    [230, 150],
    `
      <Row ss:Height="26">${excelCell(title, 'String', 'Title')}</Row>
      <Row>${excelCell(`Periode: ${filterLabel}`, 'String', 'Meta')}</Row>
      <Row>${excelCell(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 'String', 'Meta')}</Row>
      <Row>${excelCell('Metrik', 'String', 'Header')}${excelCell('Nilai', 'String', 'Header')}</Row>
      ${rows.map(([label, value]) => `<Row>${excelCell(label)}${typeof value === 'number' ? excelCell(value, 'Number', 'Currency') : excelCell(value)}</Row>`).join('')}
    `,
  );

  const buildOfflinePenjualanSheet = (rows: any[]) => {
    const total = rows.reduce((sum, row) => sum + money(row.total), 0);
    return worksheetXml('Offline Penjualan', [55, 92, 190, 95, 85, 125, 95, 145, 120], `
      <Row ss:Height="26">${excelCell('Penjualan Offline', 'String', 'Title')}</Row>
      <Row>${excelCell(`Periode: ${filterLabel}`, 'String', 'Meta')}</Row>
      <Row>${excelCell(`Total transaksi: ${rows.length}`, 'String', 'Summary')}${excelCell('')}${excelCell(`Total nilai: ${formatRupiah(total)}`, 'String', 'Summary')}</Row>
      <Row>${['ID', 'Tanggal', 'Nama Penerima', 'Faktur', 'Status', 'Sumber', 'Pelunasan', 'Progress', 'Total'].map(h => excelCell(h, 'String', 'Header')).join('')}</Row>
      ${rows.map(row => `
        <Row>
          ${excelCell(row.id, 'Number', 'Number')}
          ${excelCell(formatDate(row.tanggal))}
          ${excelCell(row.nama_penerima)}
          ${excelCell(row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur')}
          ${excelCell(row.status)}
          ${excelCell(row.from_display ? 'Dari Display' : 'Penjualan Langsung')}
          ${excelCell(row.belumLunas ? 'Belum Lunas' : 'Lunas')}
          ${excelCell(row.progressLabel || '-')}
          ${excelCell(row.total, 'Number', 'Currency')}
        </Row>`).join('')}
    `);
  };

  const buildOfflineDisplaySheet = (rows: any[]) => {
    const totalNilai = rows.reduce((sum, row) => sum + money(row.nilaiTotal), 0);
    const totalSisa = rows.reduce((sum, row) => sum + money(row.nilaiSisa), 0);
    const totalLaku = rows.reduce((sum, row) => sum + money(row.nilaiTerjual), 0);
    const totalLakuBelumLunas = rows.reduce((sum, row) => sum + money(row.nilaiTerjualBelumLunas), 0);
    return worksheetXml('Offline Display', [55, 92, 190, 85, 100, 145, 120, 120, 120, 135], `
      <Row ss:Height="26">${excelCell('Display / Piutang Offline', 'String', 'Title')}</Row>
      <Row>${excelCell(`Periode: ${filterLabel}`, 'String', 'Meta')}</Row>
      <Row>${excelCell(`Total display: ${rows.length}`, 'String', 'Summary')}${excelCell('')}${excelCell(`Total nilai: ${formatRupiah(totalNilai)}`, 'String', 'Summary')}${excelCell(`Sisa piutang: ${formatRupiah(totalSisa)}`, 'String', 'Summary')}${excelCell(`Sudah terjual: ${formatRupiah(totalLaku)}`, 'String', 'Summary')}${excelCell(`Laku belum lunas: ${formatRupiah(totalLakuBelumLunas)}`, 'String', 'Summary')}</Row>
      <Row>${['ID', 'Tanggal', 'Nama Toko/Penerima', 'Status', 'Kondisi', 'Progress', 'Total Nilai', 'Sisa Piutang', 'Sudah Terjual', 'Laku Belum Lunas'].map(h => excelCell(h, 'String', 'Header')).join('')}</Row>
      ${rows.map(row => `
        <Row>
          ${excelCell(row.id, 'Number', 'Number')}
          ${excelCell(formatDate(row.tanggal))}
          ${excelCell(row.nama_penerima)}
          ${excelCell(row.status)}
          ${excelCell(row.adaSisa ? 'Ada Sisa' : 'Semua Terjual')}
          ${excelCell(row.nilaiTerjualBelumLunas > 0 ? 'Ada Laku Belum Lunas' : (!row.adaSisa && row.nilaiTerjual > 0 ? 'Display Selesai' : 'Display Berjalan'))}
          ${excelCell(row.nilaiTotal, 'Number', 'Currency')}
          ${excelCell(row.nilaiSisa, 'Number', 'Currency')}
          ${excelCell(row.nilaiTerjual, 'Number', 'Currency')}
          ${excelCell(row.nilaiTerjualBelumLunas, 'Number', 'Currency')}
        </Row>`).join('')}
    `);
  };

  const buildInteriorSheet = (rows: any[]) => {
    const totalNilai = rows.reduce((sum, row) => sum + money(row.grandTotal), 0);
    const totalBayar = rows.reduce((sum, row) => sum + money(row.terbayar), 0);
    const totalSisa = rows.reduce((sum, row) => sum + money(row.sisa), 0);
    return worksheetXml('Interior', [55, 92, 190, 105, 95, 85, 95, 120, 120, 120, 70], `
      <Row ss:Height="26">${excelCell('Penjualan Interior', 'String', 'Title')}</Row>
      <Row>${excelCell(`Periode: ${filterLabel}`, 'String', 'Meta')}</Row>
      <Row>${excelCell(`Total proyek: ${rows.length}`, 'String', 'Summary')}${excelCell('')}${excelCell(`Total nilai: ${formatRupiah(totalNilai)}`, 'String', 'Summary')}${excelCell(`Terbayar: ${formatRupiah(totalBayar)}`, 'String', 'Summary')}${excelCell(`Outstanding: ${formatRupiah(totalSisa)}`, 'String', 'Summary')}</Row>
      <Row>${['ID', 'Tanggal', 'Customer', 'No. PO', 'Faktur', 'Status', 'Pelunasan', 'Grand Total', 'Terbayar', 'Sisa', 'Progress'].map(h => excelCell(h, 'String', 'Header')).join('')}</Row>
      ${rows.map(row => `
        <Row>
          ${excelCell(row.id, 'Number', 'Number')}
          ${excelCell(formatDate(row.tanggal))}
          ${excelCell(row.nama_customer)}
          ${excelCell(row.no_po || '-')}
          ${excelCell(row.faktur || '-')}
          ${excelCell(row.status)}
          ${excelCell(row.lunas ? 'Lunas' : 'Belum Lunas')}
          ${excelCell(row.grandTotal, 'Number', 'Currency')}
          ${excelCell(row.terbayar, 'Number', 'Currency')}
          ${excelCell(row.sisa, 'Number', 'Currency')}
          ${excelCell(`${row.persen}%`)}
        </Row>`).join('')}
    `);
  };

  const handleExport = async (mode: 'offline' | 'interior' | 'gabungan') => {
    setExportLoading(mode);
    try {
      const worksheets: string[] = [];
      let offlinePenjualan: any = null;
      let offlineDisplay: any = null;
      let interior: any = null;

      if (mode === 'offline' || mode === 'gabungan') {
        [offlinePenjualan, offlineDisplay] = await Promise.all([
          fetchAllKeuangan('offline', 'penjualan'),
          fetchAllKeuangan('offline', 'display'),
        ]);
      }
      if (mode === 'interior' || mode === 'gabungan') {
        interior = await fetchAllKeuangan('interior');
      }

      if (mode === 'gabungan') {
        worksheets.push(buildSummarySheet('Ringkasan Gabungan', 'Ringkasan Keuangan Gabungan', [
          ['Omzet Offline', offlinePenjualan?.summary?.totalOmzet || 0],
          ['Penjualan Offline Belum Lunas', offlinePenjualan?.summary?.totalBelumLunas || 0],
          ['Piutang Display', offlinePenjualan?.summary?.totalPiutang || 0],
          ['Display Laku Belum Lunas', offlinePenjualan?.summary?.totalDisplayBelumLunas || 0],
          ['Nilai Proyek Interior', interior?.summary?.totalNilaiProyek || 0],
          ['Terbayar Interior', interior?.summary?.totalTerbayar || 0],
          ['Outstanding Interior', interior?.summary?.totalOutstanding || 0],
        ]));
      } else if (mode === 'offline') {
        worksheets.push(buildSummarySheet('Ringkasan Offline', 'Ringkasan Keuangan Offline', [
          ['Total Omzet Penjualan', offlinePenjualan?.summary?.totalOmzet || 0],
          ['Penjualan Belum Lunas', offlinePenjualan?.summary?.totalBelumLunas || 0],
          ['Piutang Display', offlinePenjualan?.summary?.totalPiutang || 0],
          ['Sudah Terjual dari Display', offlinePenjualan?.summary?.totalTerjualDisplay || 0],
          ['Display Laku Belum Lunas', offlinePenjualan?.summary?.totalDisplayBelumLunas || 0],
        ]));
      } else {
        worksheets.push(buildSummarySheet('Ringkasan Interior', 'Ringkasan Keuangan Interior', [
          ['Total Nilai Proyek', interior?.summary?.totalNilaiProyek || 0],
          ['Total Terbayar', interior?.summary?.totalTerbayar || 0],
          ['Total Outstanding', interior?.summary?.totalOutstanding || 0],
        ]));
      }

      if (offlinePenjualan) worksheets.push(buildOfflinePenjualanSheet(offlinePenjualan.rows));
      if (offlineDisplay) worksheets.push(buildOfflineDisplaySheet(offlineDisplay.rows));
      if (interior) worksheets.push(buildInteriorSheet(interior.rows));

      downloadExcelXml(`keuangan-${mode}-${from || 'awal'}_${to || 'akhir'}.xls`, buildWorkbookXml(`Export Keuangan ${mode}`, worksheets));
    } finally {
      setExportLoading(null);
    }
  };

  const summary = offlineData?.summary;
  const intSummary = interiorData?.summary;

  const bulanLabel = (() => {
    if (!from && !to) return 'Semua Waktu';
    const f = from ? new Date(from).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '...';
    const t = to ? new Date(to).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '...';
    return `${f} – ${t}`;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#0f172a' }}>Keuangan</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{bulanLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
          <RefreshCw className="h-3 w-3" />
          Realtime
        </div>
      </div>

      {/* Filter tanggal */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Dari Tanggal</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Sampai Tanggal</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }} />
        </div>
        <button onClick={handleFilter}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #FA2F2F, #d41a1a)' }}>
          Terapkan
        </button>
        <button onClick={handleReset}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#f1f5f9', color: '#475569' }}>
          Tahun Ini
        </button>
        <button onClick={handleAllData}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' }}>
          Semua Data
        </button>
        <div className="flex flex-wrap gap-2">
          {([
            ['offline', 'Export Offline'],
            ['interior', 'Export Interior'],
            ['gabungan', 'Export Gabungan'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => handleExport(mode)}
              disabled={exportLoading !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
              style={{ background: '#0f172a', color: '#fff' }}
            >
              <Download className="h-3.5 w-3.5" />
              {exportLoading === mode ? 'Export...' : label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab utama */}
      <div className="flex gap-2">
        {(['offline', 'interior'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === t ? 'linear-gradient(135deg, #FA2F2F, #d41a1a)' : '#fff',
              color: activeTab === t ? '#fff' : '#64748b',
              border: activeTab === t ? 'none' : '1px solid #e2e8f0',
              boxShadow: activeTab === t ? '0 2px 8px rgba(250,47,47,0.25)' : 'none',
            }}>
            {t === 'offline' ? 'Offline' : 'Interior'}
          </button>
        ))}
      </div>

      {/* ── TAB OFFLINE ── */}
      {activeTab === 'offline' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard label="Total Omzet Penjualan" value={summary ? formatRupiah(summary.totalOmzet) : '-'} color="#0f172a" />
            <SummaryCard
              label="Penjualan Belum Lunas"
              value={summary ? formatRupiah(summary.totalBelumLunas) : '-'}
              sub={summary ? `Dari display: ${formatRupiah(summary.totalDisplayBelumLunas)}` : undefined}
              color="#dc2626"
            />
            <SummaryCard label="Piutang Display" value={summary ? formatRupiah(summary.totalPiutang) : '-'} sub="Display belum selesai, net retur" color="#f97316" />
            <SummaryCard label="Sudah Terjual dari Display" value={summary ? formatRupiah(summary.totalTerjualDisplay) : '-'} color="#16a34a" />
          </div>

          {/* Info cara kerja */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e0f2fe', background: '#f0f9ff' }}>
            <button
              onClick={() => setShowInfo(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" style={{ color: '#0369a1' }} />
                <span className="text-sm font-semibold" style={{ color: '#0369a1' }}>Cara Kerja Keuangan Offline</span>
              </div>
              <ChevronDown
                className="h-4 w-4 transition-transform duration-200"
                style={{ color: '#0369a1', transform: showInfo ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {showInfo && (
              <div className="px-4 pb-4 space-y-4">
                {/* Flow diagram */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
                  {/* Step 1 */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#fff', border: '1px solid #bae6fd' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#0369a1' }}>1</div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#0c4a6e' }}>Buat Display</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>Barang dititipkan ke toko</p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 flex-shrink-0 hidden sm:block" style={{ color: '#94a3b8' }} />
                  <div className="w-px h-4 sm:hidden" style={{ background: '#cbd5e1', marginLeft: 20 }} />

                  {/* Step 2 */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#fff', border: '1px solid #fed7aa' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#f97316' }}>2</div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#7c2d12' }}>Masuk Piutang Display</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>Uang belum diterima</p>
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 flex-shrink-0 hidden sm:block" style={{ color: '#94a3b8' }} />
                  <div className="w-px h-4 sm:hidden" style={{ background: '#cbd5e1', marginLeft: 20 }} />

                  {/* Step 3 */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#fff', border: '1px solid #bbf7d0' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#16a34a' }}>3</div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: '#14532d' }}>Ada yang Beli</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>Terjual → masuk Omzet</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #bae6fd' }} />

                {/* Penjelasan tiap kartu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#0f172a' }}>Total Omzet Penjualan</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      Total nilai penjualan langsung <em>dan</em> penjualan item display yang sudah terbeli pelanggan.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#0f172a' }}>Penjualan Belum Lunas</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      Nilai transaksi penjualan offline yang statusnya belum Selesai, termasuk barang display yang sudah laku.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#0f172a' }}>Piutang Display</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      Nilai barang display yang belum selesai dan masih ada sisa net setelah retur. Ini belum dihitung sebagai omzet.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#0f172a' }}>Sudah Terjual dari Display</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      Bagian dari omzet yang asalnya dari item display. Ini sub-bagian dari Total Omzet, bukan angka terpisah.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-tab */}
          <div className="flex gap-2">
            {([['penjualan', 'Penjualan Langsung'], ['display', 'Display / Piutang']] as const).map(([val, label]) => (
              <button key={val} onClick={() => { setOfflineSubTab(val); setOfflinePage(1); fetchOffline(1, val, from, to); }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: offlineSubTab === val ? '#0f172a' : '#f8fafc',
                  color: offlineSubTab === val ? '#fff' : '#64748b',
                  border: offlineSubTab === val ? 'none' : '1px solid #e2e8f0',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {offlineLoading ? (
            <div className="flex justify-center py-16"><CircularProgress size={28} sx={{ color: '#FA2F2F' }} /></div>
          ) : !offlineData?.list?.length ? (
            <div className="text-center py-16 text-sm" style={{ color: '#94a3b8' }}>Tidak ada data</div>
          ) : offlineSubTab === 'penjualan' ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8edf5' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Tanggal', 'Nama Penerima', 'Faktur', 'Pelunasan', 'Progress', 'Total', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left" style={{ color: '#94a3b8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offlineData.list.map((row: any, idx: number) => (
                    <tr key={row.id} style={{ borderBottom: idx < offlineData.list.length - 1 ? '1px solid #f8fafc' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td className="px-4 py-3 text-sm" style={{ color: '#475569' }}>{formatDate(row.tanggal)}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1e293b' }}>{row.nama_penerima}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: row.faktur === 'FAKTUR' ? '#eff6ff' : '#f8fafc', color: row.faktur === 'FAKTUR' ? '#2563eb' : '#64748b' }}>
                          {row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.lunas ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>Lunas</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>Belum Lunas</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[140px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: '#475569' }}>{row.progressLabel || '-'}</span>
                            <span className="text-[10px]" style={{ color: '#94a3b8' }}>{row.progressLevel || 0}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${row.progressLevel || 0}%`, background: row.lunas ? '#16a34a' : '#FA2F2F' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: '#0f172a' }}>{formatRupiah(row.total)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/dashboard/penjualan/offline/${row.id}`)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.borderColor = '#fecaca'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}>
                          <ArrowRight className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #f1f5f9', background: '#f8fafc' }}>
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right" style={{ color: '#475569' }}>Total Halaman Ini</td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: '#FA2F2F' }}>
                      {formatRupiah(offlineData.list.reduce((s: number, r: any) => s + r.total, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            // Display tab
            <div className="space-y-3">
              {offlineData.list.map((row: any) => (
                <div key={row.id} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#1e293b' }}>{row.nama_penerima}</span>
                        <StatusBadge status={row.status} />
                        {row.adaSisa ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#c2410c' }}>Ada Sisa</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>Semua Terjual</span>
                        )}
                        {row.nilaiTerjualBelumLunas > 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>Ada Laku Belum Lunas</span>
                        ) : !row.adaSisa && row.nilaiTerjual > 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ecfdf5', color: '#059669' }}>Display Selesai</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb' }}>Display Berjalan</span>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{formatDate(row.tanggal)}</p>
                    </div>
                    <button onClick={() => router.push(`/dashboard/penjualan/offline/${row.id}`)}
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.borderColor = '#fecaca'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}>
                      <ArrowRight className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    <div className="p-2.5 rounded-xl text-center" style={{ background: '#f8fafc' }}>
                      <p className="text-xs" style={{ color: '#94a3b8' }}>Total Nilai</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#1e293b' }}>{formatRupiah(row.nilaiTotal)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl text-center" style={{ background: '#fff7ed' }}>
                      <p className="text-xs" style={{ color: '#f97316' }}>Sisa Piutang</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#c2410c' }}>{formatRupiah(row.nilaiSisa)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl text-center" style={{ background: '#f0fdf4' }}>
                      <p className="text-xs" style={{ color: '#16a34a' }}>Sudah Terjual</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#15803d' }}>{formatRupiah(row.nilaiTerjual)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl text-center" style={{ background: '#fef2f2' }}>
                      <p className="text-xs" style={{ color: '#dc2626' }}>Laku Belum Lunas</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#b91c1c' }}>{formatRupiah(row.nilaiTerjualBelumLunas)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(offlineData?.totalPages ?? 0) > 1 && (
            <div className="flex justify-center">
              <Pagination count={offlineData.totalPages} page={offlinePage}
                onChange={(_, v) => setOfflinePage(v)} color="primary" size="small" />
            </div>
          )}
        </div>
      )}

      {/* ── TAB INTERIOR ── */}
      {activeTab === 'interior' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Nilai Proyek" value={intSummary ? formatRupiah(intSummary.totalNilaiProyek) : '-'} color="#0f172a" />
            <SummaryCard label="Total Terbayar" value={intSummary ? formatRupiah(intSummary.totalTerbayar) : '-'} color="#16a34a" />
            <SummaryCard label="Total Outstanding" value={intSummary ? formatRupiah(intSummary.totalOutstanding) : '-'} sub="Sisa belum dibayar" color="#f97316" />
          </div>

          {/* List */}
          {interiorLoading ? (
            <div className="flex justify-center py-16"><CircularProgress size={28} sx={{ color: '#FA2F2F' }} /></div>
          ) : !interiorData?.list?.length ? (
            <div className="text-center py-16 text-sm" style={{ color: '#94a3b8' }}>Tidak ada data</div>
          ) : (
            <div className="space-y-3">
              {interiorData.list.map((row: any) => (
                <div key={row.id} className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #e8edf5', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold" style={{ color: '#1e293b' }}>{row.nama_customer}</span>
                        <StatusBadge status={row.status} />
                        {row.lunas ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <CheckCircle className="h-3 w-3" /> Lunas
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#c2410c' }}>
                            <Clock className="h-3 w-3" /> Belum Lunas
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>PO: {row.no_po} · {formatDate(row.tanggal)}</p>
                    </div>
                    <button onClick={() => router.push(`/dashboard/penjualan/interior/${row.id}`)}
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.borderColor = '#fecaca'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}>
                      <ArrowRight className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: '#94a3b8' }}>
                      <span>{formatRupiah(row.terbayar)} terbayar</span>
                      <span>{row.persen}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${row.persen}%`, background: row.lunas ? '#16a34a' : 'linear-gradient(90deg, #FA2F2F, #f97316)' }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span style={{ color: '#94a3b8' }}>Total: {formatRupiah(row.grandTotal)}</span>
                      {!row.lunas && <span style={{ color: '#c2410c', fontWeight: 600 }}>Sisa: {formatRupiah(row.sisa)}</span>}
                    </div>
                  </div>

                  {/* Riwayat pembayaran */}
                  {row.pembayarans?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {row.pembayarans.map((pb: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#eff6ff', color: '#2563eb' }}>
                          {pb.tipe.replace('_', ' ')} · {formatRupiah(pb.jumlah)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {(interiorData?.totalPages ?? 0) > 1 && (
            <div className="flex justify-center">
              <Pagination count={interiorData.totalPages} page={interiorPage}
                onChange={(_, v) => setInteriorPage(v)} color="primary" size="small" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
