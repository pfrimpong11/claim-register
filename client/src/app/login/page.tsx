import { Suspense } from 'react';
import { Icon } from '@/components/ui/icon';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <Icon name="shield" size={22} />
          </span>
          <span className={styles.brandName}>Claims Register</span>
        </div>
        <h1>Sign in</h1>
        <p className={styles.hint}>Use your assigned account to continue.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
