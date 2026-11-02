import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Medika Keperawatan — Portal Evaluasi TTS Terminologi Kesehatan',
  description:
    'Platform Evaluasi Teka-Teki Silang (TTS) Terminologi Kesehatan & Keperawatan berbasis Kelas dengan Buku Nilai Otomatis.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
