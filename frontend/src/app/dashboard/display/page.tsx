'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import DateInput from '@/components/ui/DateInput';
import { formatDate, formatRupiah } from '@/lib/utils';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Pagination, Button, Tabs, Tab,
  TextField, InputAdornment, IconButton,
} from '@mui/material';
import {
  Plus, Eye, RefreshCw, Store, ShoppingBag, Search, Download,
  PackageCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useListSync } from '@/hooks/useListSync';

const STATUS_CONFIG: Record<string, { label: string; color: 'default' | 'info' | 'success' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  ACTIVE: { label: 'Aktif', color: 'info' },
  COMPLETED: { label: 'Selesai', color: 'success' },
};

const dateInputStyle = {
  width: '100%',
  height: 40,
  padding: '8px 12px',
  borderRadius: '10px',
  background: '#fff',
  border: '1px solid #e0e0e0',
  fontSize: 14,
  color: '#334155',
};

interface ProductItem {
  id?: number;
  barang_id?: string;
  varian_nama?: string | null;
  qty?: number | string;
  harga_satuan?: number | string;
  subtotal?: number | string;
  barang?: {
    nama?: string | null;
  } | null;
}

interface DisplayDoc {
  nomor_sp?: string;
  nomor_surat?: string;
  tanggal?: string;
}

interface DisplayRow {
  id: number;
  tipe?: 'DISPLAY' | 'PENJUALAN';
  tanggal: string;
  nama_penerima: string;
  no_hp_penerima?: string | null;
  no_po?: string | null;
  status: string;
  faktur?: string;
  items?: ProductItem[];
  suratPengantars?: DisplayDoc[];
  suratJalans?: DisplayDoc[];
}

type QueryParams = Record<string, string | number>;
type DisplaySummary = {
  totalQty: number;
  totalNilai: number;
};

const emptySummary: DisplaySummary = { totalQty: 0, totalNilai: 0 };

const getItems = (row: DisplayRow) => Array.isArray(row?.items) ? row.items : [];
const getQty = (items: ProductItem[]) => items.reduce((s, i) => s + Number(i.qty || 0), 0);
const getTotal = (items: ProductItem[]) => items.reduce((s, i) => s + Number(i.subtotal || 0), 0);

function ProductSummary({ items }: { items: ProductItem[] }) {
  if (!items.length) {
    return <Typography variant="caption" color="text.disabled">Tidak ada produk</Typography>;
  }

  const visible = items.slice(0, 3);
  const hidden = Math.max(0, items.length - visible.length);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 260 }}>
      {visible.map((item: ProductItem, idx) => (
        <Box key={item.id || `${item.barang_id}-${item.varian_nama || idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Chip
            label={`${item.qty || 0} pcs`}
            size="small"
            sx={{ height: 20, borderRadius: '6px', fontSize: 10, fontWeight: 800, bgcolor: '#f1f5f9', color: '#475569', flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.25 }}>
              {item.barang?.nama || item.barang_id || '-'}
            </Typography>
            <Typography variant="caption" sx={{ color: item.varian_nama ? '#6d28d9' : '#94a3b8', fontWeight: item.varian_nama ? 700 : 500, display: 'block', lineHeight: 1.2 }}>
              {item.varian_nama || 'Tanpa varian'}
            </Typography>
          </Box>
        </Box>
      ))}
      {hidden > 0 && (
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
          +{hidden} produk lainnya
        </Typography>
      )}
    </Box>
  );
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function excelCell(value: unknown, type: 'String' | 'Number' = 'String', style = '') {
  const safeValue = type === 'Number' ? Number(value || 0) : escapeXml(value);
  const styleAttr = style ? ` ss:StyleID="${style}"` : '';
  return `<Cell${styleAttr}><Data ss:Type="${type}">${safeValue}</Data></Cell>`;
}

function buildExcelXml({
  title,
  rows,
  filters,
}: {
  title: string;
  rows: DisplayRow[];
  filters: string;
}) {
  const itemRows = rows.flatMap((row: DisplayRow) => {
    const items = getItems(row);
    const docs = row.tipe === 'DISPLAY'
      ? row.suratPengantars?.map((sp: DisplayDoc) => sp.nomor_sp).join(', ')
      : row.suratJalans?.map((sj: DisplayDoc) => sj.nomor_surat).join(', ');
    const displayTotal = getTotal(items);

    if (!items.length) {
      return [[
        row.id, formatDate(row.tanggal), row.nama_penerima, row.no_hp_penerima || '-',
        row.no_po || '-', docs || '-', '-', '-', 0, 0, 0, row.status,
      ]];
    }

    return items.map((item: ProductItem) => [
      row.id,
      formatDate(row.tanggal),
      row.nama_penerima,
      row.no_hp_penerima || '-',
      row.no_po || '-',
      docs || '-',
      item.barang?.nama || item.barang_id || '-',
      item.varian_nama || 'Tanpa varian',
      Number(item.qty || 0),
      Number(item.harga_satuan || 0),
      Number(item.subtotal || 0),
      row.status,
      displayTotal,
    ]);
  });

  const totalQty = itemRows.reduce((sum, row) => sum + Number(row[8] || 0), 0);
  const totalNilai = itemRows.reduce((sum, row) => sum + Number(row[10] || 0), 0);

  const header = ['ID', 'Tanggal', 'Nama Toko/Penerima', 'No. HP', 'No. PO', 'No. Dokumen', 'Produk', 'Varian', 'Qty', 'Harga Satuan', 'Subtotal', 'Status'];
  const bodyXml = itemRows.map(row => `
    <Row>
      ${excelCell(row[0], 'Number')}
      ${excelCell(row[1])}
      ${excelCell(row[2])}
      ${excelCell(row[3])}
      ${excelCell(row[4])}
      ${excelCell(row[5])}
      ${excelCell(row[6])}
      ${excelCell(row[7])}
      ${excelCell(row[8], 'Number', 'Number')}
      ${excelCell(row[9], 'Number', 'Currency')}
      ${excelCell(row[10], 'Number', 'Currency')}
      ${excelCell(row[11])}
    </Row>`).join('');

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
    <Style ss:ID="Summary"><Font ss:Bold="1"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/></Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(title).slice(0, 31)}">
    <Table>
      <Column ss:Width="48"/><Column ss:Width="92"/><Column ss:Width="180"/><Column ss:Width="105"/>
      <Column ss:Width="95"/><Column ss:Width="150"/><Column ss:Width="190"/><Column ss:Width="120"/>
      <Column ss:Width="55"/><Column ss:Width="100"/><Column ss:Width="110"/><Column ss:Width="80"/>
      <Row ss:Height="26">${excelCell(title, 'String', 'Title')}</Row>
      <Row>${excelCell(`Filter: ${filters || 'Semua data'}`, 'String', 'Meta')}</Row>
      <Row>${excelCell(`Total transaksi: ${rows.length}`, 'String', 'Summary')}${excelCell('')}${excelCell(`Total qty: ${totalQty}`, 'String', 'Summary')}${excelCell('')}${excelCell(`Total nilai: Rp ${Math.round(totalNilai).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`, 'String', 'Summary')}</Row>
      <Row>${header.map(h => excelCell(h, 'String', 'Header')).join('')}</Row>
      ${bodyXml}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane>
      <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
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

export default function DisplayPage() {
  const [tab, setTab] = useState(0);

  const [search, setSearch] = useState('');
  const [tanggalDari, setTanggalDari] = useState('');
  const [tanggalSampai, setTanggalSampai] = useState('');
  const [filterVersion, setFilterVersion] = useState(0);
  const [exportLoading, setExportLoading] = useState(false);

  // Display Aktif
  const [data, setData] = useState<DisplayRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [displaySummary, setDisplaySummary] = useState<DisplaySummary>(emptySummary);
  const [loading, setLoading] = useState(false);

  // Sudah Laku
  const [lakuData, setLakuData] = useState<DisplayRow[]>([]);
  const [lakuTotal, setLakuTotal] = useState(0);
  const [lakuSummary, setLakuSummary] = useState<DisplaySummary>(emptySummary);
  const [lakuLoading, setLakuLoading] = useState(false);

  const buildParams = (mode: 'display' | 'laku', p = page, exportAll = false) => {
    const params: QueryParams = {
      tipe: mode === 'display' ? 'DISPLAY' : 'PENJUALAN',
      page: exportAll ? 1 : p,
      limit: exportAll ? 10000 : 20,
    };
    if (mode === 'laku') params.from_display = '1';
    if (search.trim()) params.search = search.trim();
    if (tanggalDari) params.tanggal_dari = tanggalDari;
    if (tanggalSampai) params.tanggal_sampai = tanggalSampai;
    return params;
  };

  const fetchDisplay = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: buildParams('display', p) });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setDisplaySummary(res.data.summary || emptySummary);
    } catch {
      toast.error('Gagal memuat data display');
    } finally {
      setLoading(false);
    }
  };

  const fetchLaku = async () => {
    setLakuLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: buildParams('laku', 1, true) });
      setLakuData(res.data.data || []);
      setLakuTotal(res.data.total || 0);
      setLakuSummary(res.data.summary || emptySummary);
    } catch {
      setLakuData([]);
      setLakuTotal(0);
      setLakuSummary(emptySummary);
    } finally {
      setLakuLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilterVersion(v => v + 1);
  };

  const resetFilters = () => {
    setSearch('');
    setTanggalDari('');
    setTanggalSampai('');
    setPage(1);
    setFilterVersion(v => v + 1);
  };

  const exportExcel = async () => {
    setExportLoading(true);
    try {
      const mode = tab === 0 ? 'display' : 'laku';
      const res = await api.get('/penjualan-offline', { params: buildParams(mode, 1, true) });
      const rows = res.data.data || [];
      const filterText = [
        search.trim() ? `Cari: ${search.trim()}` : '',
        tanggalDari ? `Dari: ${formatDate(tanggalDari)}` : '',
        tanggalSampai ? `Sampai: ${formatDate(tanggalSampai)}` : '',
      ].filter(Boolean).join(', ');
      const title = tab === 0 ? 'Display Aktif' : 'Penjualan Dari Display';
      const xml = buildExcelXml({ title, rows, filters: filterText });
      const suffix = new Date().toISOString().slice(0, 10);
      downloadExcelXml(`${tab === 0 ? 'display-aktif' : 'display-sudah-laku'}-${suffix}.xls`, xml);
      toast.success('File Excel berhasil dibuat');
    } catch {
      toast.error('Gagal export Excel');
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => { if (tab === 0) fetchDisplay(); }, [page, filterVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
    setFilterVersion(v => v + 1);
  }, [tab, tanggalDari, tanggalSampai]);
  useEffect(() => { if (tab === 1) fetchLaku(); }, [filterVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  useListSync('penjualan-offline-list', () => { fetchDisplay(); if (tab === 1) fetchLaku(); });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1500, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, mb: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Store size={28} style={{ color: '#FA2F2F' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>Display</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">Kelola barang display toko beserta produk, varian, dan nilai stok.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={exportLoading ? <CircularProgress size={16} /> : <Download size={17} />}
            onClick={exportExcel}
            disabled={exportLoading}
            sx={{ borderRadius: '12px', px: 2.5, py: 1.1, fontWeight: 800 }}
          >
            Export Excel
          </Button>
          <Link href="/dashboard/display/baru" style={{ textDecoration: 'none' }}>
            <Button variant="contained" startIcon={<Plus size={18} />} sx={{ borderRadius: '12px', px: 3, py: 1.2, boxShadow: '0 4px 12px rgba(250,47,47,0.25)', bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>
              Display Baru
            </Button>
          </Link>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit"
            sx={{ '& .MuiTabs-indicator': { backgroundColor: '#FA2F2F' }, '& .MuiTab-root': { fontWeight: 700, fontSize: '0.8rem', textTransform: 'none', minHeight: 48 }, '& .Mui-selected': { color: '#FA2F2F' } }}>
            <Tab icon={<Store size={15} />} iconPosition="start" label="Display Aktif" />
            <Tab icon={<ShoppingBag size={15} />} iconPosition="start" label="Sudah Laku" />
          </Tabs>
        </Box>

        <Box component="form" onSubmit={handleSearch} sx={{ p: 3, bgcolor: 'rgba(248,250,252,0.65)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) 180px 180px auto auto' }, gap: 1.5, alignItems: 'end' }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', mb: 1, display: 'block' }}>Nama Toko / Penerima</Typography>
              <TextField
                fullWidth
                size="small"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama toko, penerima, no. HP, atau no. PO"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, sx: { borderRadius: '10px', bgcolor: '#fff' } } }}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', mb: 1, display: 'block' }}>Dari</Typography>
              <DateInput value={tanggalDari} onChange={e => setTanggalDari(e.target.value)} style={dateInputStyle} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.disabled', mb: 1, display: 'block' }}>Sampai</Typography>
              <DateInput value={tanggalSampai} onChange={e => setTanggalSampai(e.target.value)} style={dateInputStyle} />
            </Box>
            <Button variant="contained" type="submit" sx={{ height: 40, borderRadius: '10px', px: 3, fontWeight: 800, bgcolor: '#FA2F2F', '&:hover': { bgcolor: '#d41a1a' } }}>
              Cari
            </Button>
            <IconButton onClick={resetFilters} sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: '#fff' }} aria-label="Reset filter">
              <RefreshCw size={18} />
            </IconButton>
          </Box>
        </Box>

        {tab === 0 && (
          <>
            <Box sx={{ px: 3, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Total: <strong>{total}</strong> display</Typography>
                <Typography variant="caption" color="text.secondary">Qty: <strong>{displaySummary.totalQty}</strong> pcs</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Export mengikuti filter yang sedang aktif.</Typography>
            </Box>
            <TableContainer>
              <Table sx={{ minWidth: 1080 }}>
                <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
                  <TableRow>
                    {['Tanggal', 'Nama Toko / Penerima', 'Produk & Varian', 'Qty', 'Nilai Display', 'No. SP', 'Status', 'Aksi'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : data.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}>Tidak ada data display.</TableCell></TableRow>
                  ) : data.map((row: DisplayRow) => {
                    const items = getItems(row);
                    return (
                      <TableRow key={row.id} hover sx={{ '& td': { py: 1.8, verticalAlign: 'top' } }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.tanggal)}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>{row.nama_penerima}</Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>{row.no_hp_penerima || '-'}</Typography>
                        </TableCell>
                        <TableCell><ProductSummary items={items} /></TableCell>
                        <TableCell>
                          <Chip icon={<PackageCheck size={13} />} label={`${getQty(items)} pcs`} size="small" sx={{ borderRadius: '6px', fontWeight: 800, bgcolor: '#eef2ff', color: '#3730a3' }} />
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{formatRupiah(getTotal(items))}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: row.suratPengantars?.length ? 'text.primary' : 'text.disabled' }}>
                            {row.suratPengantars?.map((sp: DisplayDoc) => sp.nomor_sp).join(', ') || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={STATUS_CONFIG[row.status]?.label || row.status} size="small" color={STATUS_CONFIG[row.status]?.color || 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/penjualan/offline/${row.id}`} style={{ textDecoration: 'none' }}>
                            <Button size="small" variant="outlined" startIcon={<Eye size={14} />} sx={{ borderRadius: '8px', fontWeight: 700 }}>Detail</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(248,250,252,0.5)' }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Total {total} display</Typography>
                <Typography variant="caption" color="text.secondary">Total harga keseluruhan: <strong>{formatRupiah(displaySummary.totalNilai)}</strong></Typography>
              </Box>
              <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" size="small" sx={{ '& .MuiPaginationItem-root': { borderRadius: '8px', fontWeight: 600 } }} />
            </Box>
          </>
        )}

        {tab === 1 && (
          <>
            <Box sx={{ px: 3, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Total: <strong>{lakuTotal}</strong> penjualan dari display</Typography>
                <Typography variant="caption" color="text.secondary">Qty: <strong>{lakuSummary.totalQty}</strong> pcs</Typography>
              </Box>
              <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} className={lakuLoading ? 'animate-spin' : ''} />} onClick={fetchLaku} disabled={lakuLoading} sx={{ borderRadius: '8px', fontWeight: 700 }}>
                Refresh
              </Button>
            </Box>
            <TableContainer>
              <Table sx={{ minWidth: 1080 }}>
                <TableHead sx={{ bgcolor: 'rgba(248,250,252,0.8)' }}>
                  <TableRow>
                    {['Tanggal Laku', 'Nama Penerima', 'Produk & Varian', 'Qty', 'Faktur', 'Total Nilai', 'Status', 'Aksi'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, p: 2, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lakuLoading ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : lakuData.length === 0 ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}>Belum ada barang display yang terjual.</TableCell></TableRow>
                  ) : lakuData.map((row: DisplayRow) => {
                    const items = getItems(row);
                    return (
                      <TableRow key={row.id} hover sx={{ '& td': { py: 1.8, verticalAlign: 'top' } }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(row.suratJalans?.[0]?.tanggal || row.tanggal)}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.nama_penerima}</Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.25 }}>{row.no_hp_penerima || '-'}</Typography>
                        </TableCell>
                        <TableCell><ProductSummary items={items} /></TableCell>
                        <TableCell>
                          <Chip icon={<PackageCheck size={13} />} label={`${getQty(items)} pcs`} size="small" sx={{ borderRadius: '6px', fontWeight: 800, bgcolor: '#f0fdf4', color: '#166534' }} />
                        </TableCell>
                        <TableCell>
                          <Chip label={row.faktur === 'FAKTUR' ? 'Faktur' : 'Non-Fak'} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                        </TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 800 }}>{formatRupiah(getTotal(items))}</Typography></TableCell>
                        <TableCell>
                          <Chip label={STATUS_CONFIG[row.status]?.label || row.status} size="small" color={STATUS_CONFIG[row.status]?.color || 'default'} sx={{ fontWeight: 700, fontSize: '10px', borderRadius: '4px' }} />
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/penjualan/offline/${row.id}`} style={{ textDecoration: 'none' }}>
                            <Button size="small" variant="outlined" startIcon={<Eye size={14} />} sx={{ borderRadius: '8px', fontWeight: 700 }}>Detail</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-start', bgcolor: 'rgba(248,250,252,0.5)' }}>
              <Typography variant="caption" color="text.secondary">Total harga keseluruhan: <strong>{formatRupiah(lakuSummary.totalNilai)}</strong></Typography>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
