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
  title: "Sistem Ilena",
  description: "Sistem Manajemen Penjualan CV. Catur Bhakti Mandiri",
  icons: {
    icon: '/img/logoilena.svg',
    shortcut: '/img/logoilena.svg',
    apple: '/img/logoilena.svg',
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
