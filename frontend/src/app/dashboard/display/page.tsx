'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, Store, ShoppingBag } from 'lucide-react';

type Tab = 'display' | 'laku';

export default function DisplayPage() {
  const [tab, setTab] = useState<Tab>('display');

  // Display list
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Laku list
  const [lakuData, setLakuData] = useState<any[]>([]);
  const [lakuLoading, setLakuLoading] = useState(false);

  const fetchDisplay = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: { tipe: 'DISPLAY', page: p, limit: 20 } });
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  const fetchLaku = async () => {
    setLakuLoading(true);
    try {
      const res = await api.get('/penjualan-offline', { params: { from_display: '1', page: 1, limit: 100 } });
      setLakuData(res.data.data);
    } finally {
      setLakuLoading(false);
    }
  };

  useEffect(() => { fetchDisplay(); }, [page]);

  useEffect(() => {
    if (tab === 'laku') fetchLaku();
  }, [tab]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Display</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola barang display toko</p>
        </div>
        <Link href="/dashboard/display/baru">
          <Button><Plus className="h-4 w-4 mr-1" /> Display Baru</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100 w-fit">
        {([
          { key: 'display', label: 'Display Aktif', icon: Store },
          { key: 'laku', label: 'Sudah Laku', icon: ShoppingBag },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? '#FA2F2F' : '#64748b',
              boxShadow: tab === key ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
            }}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Display Aktif */}
      {tab === 'display' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-700">{total} display</span></p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Penerima</TableHead>
                <TableHead>No. HP</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Memuat...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Tidak ada data display</TableCell></TableRow>
              ) : data.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.tanggal)}</TableCell>
                  <TableCell className="font-medium">{row.nama_penerima}</TableCell>
                  <TableCell>{row.no_hp_penerima}</TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">{row.items?.length || 0} produk</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/penjualan/offline/${row.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Berikutnya</Button>
            </div>
          </div>
        </div>
      )}

      {/* Sudah Laku */}
      {tab === 'laku' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm text-slate-500">Total: <span className="font-semibold text-slate-700">{lakuData.length} penjualan dari display</span></p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal Laku</TableHead>
                <TableHead>Nama Penerima</TableHead>
                <TableHead>Faktur</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lakuLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Memuat...</TableCell></TableRow>
              ) : lakuData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">Belum ada barang display yang terjual</TableCell></TableRow>
              ) : lakuData.map((row: any) => {
                const totalNilai = (row.items || []).reduce((s: number, i: any) => s + parseFloat(i.subtotal || 0), 0);
                return (
                  <TableRow key={row.id}>
                    <TableCell>{formatDate(row.tanggal)}</TableCell>
                    <TableCell className="font-medium">{row.nama_penerima}</TableCell>
                    <TableCell>
                      <Badge variant={row.faktur === 'FAKTUR' ? 'default' : 'secondary'}>
                        {row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">
                      {formatRupiah(totalNilai)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'ACTIVE' ? 'default' : 'secondary'}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/penjualan/offline/${row.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
