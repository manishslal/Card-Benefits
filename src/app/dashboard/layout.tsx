import { BottomNav } from '@/components/BottomNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen pb-14 md:pb-0">{children}</div>
      <BottomNav />
    </>
  );
}
