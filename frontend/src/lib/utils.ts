import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs"
import "dayjs/locale/id"

dayjs.locale("id")

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatRupiah = (num: number | string | null | undefined): string => {
  if (num === null || num === undefined) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID', { minimumFractionDigits: 0 });
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD MMM YYYY');
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('DD MMM YYYY HH:mm');
};

export const TIPE_OPTIONS = [
  { value: 'PENJUALAN', label: 'Penjualan' },
  { value: 'DISPLAY', label: 'Display' },
];

export const FAKTUR_OPTIONS = [
  { value: 'FAKTUR', label: 'Faktur Pajak' },
  { value: 'NON_FAKTUR', label: 'Non Faktur' },
];

export const STATUS_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
};

export const PEMBAYARAN_TIPE = [
  { value: 'DP', label: 'DP' },
  { value: 'TERMIN_1', label: 'Termin 1' },
  { value: 'TERMIN_2', label: 'Termin 2' },
  { value: 'TERMIN_3', label: 'Termin 3' },
  { value: 'PELUNASAN_AKHIR', label: 'Pelunasan Akhir' },
];
