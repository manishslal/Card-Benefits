import Link from 'next/link';
import { AppHeader } from '@/shared/components/layout';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] safe-area-bottom">
      <AppHeader backHref="/dashboard" backLabel="Back to Dashboard" />
      <main id="main-content" className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <section
            className="rounded-xl border p-6 md:p-8 text-center"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
            }}
            aria-label={title}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Page not found
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)]">{title}</h1>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{description}</p>

            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Back to Dashboard
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}

export default PlaceholderPage;
