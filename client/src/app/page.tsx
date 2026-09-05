import { ButtonLink } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <span className={styles.logo}>
          <Icon name="shield" size={28} />
        </span>
        <p className={styles.eyebrow}>Claims operations</p>
        <h1>Claims Register</h1>
        <p className={styles.lede}>
          Register claims, manage indemnity payables and payments, and reconcile settlements in one
          place.
        </p>
        <ButtonLink href="/login" className={styles.action}>
          Sign in to continue
        </ButtonLink>
      </div>
    </main>
  );
}
