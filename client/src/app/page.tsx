import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section aria-labelledby="page-title">
        <p className="eyebrow">Claims operations</p>
        <h1 id="page-title">Claims Register</h1>
        <p>The project foundation is ready. Domain workflows will be added in the next phases.</p>
        <Link href="/login">Sign in to continue</Link>
      </section>
    </main>
  );
}
