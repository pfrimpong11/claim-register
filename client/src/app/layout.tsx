import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Claims Register',
  description: 'Mini insurance claims register exercise',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
