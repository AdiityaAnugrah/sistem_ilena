import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/lib/theme';

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: 'Sistem Ilena | Manajemen Penjualan',
    template: '%s · Sistem Ilena',
  },
  description: 'Sistem manajemen penjualan, stok, dan dokumen untuk ILENA Furniture | CV. Catur Bhakti Mandiri, Semarang.',
  keywords: ['ilena furniture', 'sistem manajemen', 'penjualan furniture', 'surat jalan', 'invoice', 'CV Catur Bhakti Mandiri'],
  authors: [{ name: 'ILENA Furniture' }],
  creator: 'ILENA Furniture',
  metadataBase: new URL('https://sistem.ilenafurniture.com'),
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://sistem.ilenafurniture.com',
    siteName: 'Sistem Ilena',
    title: 'Sistem Ilena | Manajemen Penjualan ILENA Furniture',
    description: 'Sistem manajemen penjualan, stok, dan dokumen untuk ILENA Furniture | CV. Catur Bhakti Mandiri.',
    images: [{ url: '/img/logoilena.svg', width: 510, height: 72, alt: 'ILENA Furniture' }],
  },
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className={`min-h-full flex flex-col ${inter.className}`} style={{ fontFamily: "'Inter', sans-serif" }}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3500,
                style: {
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  borderRadius: '12px',
                  boxShadow: '0 8px 30px rgba(15,23,42,0.12)',
                },
              }}
            />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
