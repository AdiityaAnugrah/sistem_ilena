'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye } from 'lucide-react';

export default function DisplayPage() {
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = async (p = page) => {
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

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Display</h1>
          <p className="text-slate-500 text-sm mt-1">Total: {total} transaksi</p>
        </div>
        <Link href="/dashboard/display/baru">
          <Button><Plus className="h-4 w-4 mr-1" /> Display Baru</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Penerima</TableHead>
              <TableHead>No. HP</TableHead>
              <TableHead>Faktur</TableHead>
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
                  <Badge variant={row.faktur === 'FAKTUR' ? 'default' : 'secondary'}>
                    {row.faktur === 'FAKTUR' ? 'Faktur' : 'Non Faktur'}
                  </Badge>
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
    </div>
  );
}
