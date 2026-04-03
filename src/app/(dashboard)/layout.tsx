/**
 * Dashboard Route Group Layout
 * Wraps all dashboard pages with consistent theming
 */
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
