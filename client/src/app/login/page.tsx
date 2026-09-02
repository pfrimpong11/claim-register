import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main>
      <section aria-labelledby="login-title">
        <p className="eyebrow">Claims Register</p>
        <h1 id="login-title">Sign in</h1>
        <p>Use your assigned development account to continue.</p>
        <LoginForm />
      </section>
    </main>
  );
}
