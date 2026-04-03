/**
 * Auth Route Group Layout
 * Wraps all auth pages with consistent theming
 */
export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
