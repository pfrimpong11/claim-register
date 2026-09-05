import { Suspense } from 'react';
import { Icon } from '@/components/ui/icon';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <section className={styles.intro}>
        <span className={styles.introBrand}>
          <Icon name="shield" size={28} />
          Claims Register
        </span>
        <div>
          <span className={styles.eyebrow}>Your claims workspace</span>
          <h2>
            Every claim.
            <br />A clearer picture.
          </h2>
          <p>Keep claim records, payments and settlement evidence together in one workspace.</p>
        </div>
        <span className={styles.introFooter}>Register · Settle · Reconcile</span>
      </section>
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
