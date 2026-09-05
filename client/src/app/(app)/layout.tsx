import { AuthProvider } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
