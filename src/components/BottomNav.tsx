'use client';

import React from 'react';
import { Home, CreditCard, Settings } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * F-5: Mobile Bottom Navigation Bar
 *
 * Sticky bottom bar with three navigation items:
 * - Home (dashboard)
 * - Cards (scroll to cards section)
 * - Settings
 *
 * Only visible on mobile viewports (hidden on md: and above).
 * Includes safe-area-bottom padding for notch devices.
 */

interface BottomNavItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: boolean;
}

interface BottomNavProps {
  /** Callback to scroll to the cards section on the dashboard */
  onScrollToCards?: () => void;
}

export function BottomNav({ onScrollToCards }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const items: BottomNavItem[] = [
    {
      label: 'Home',
      icon: <Home size={20} />,
      action: () => router.push('/dashboard'),
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Cards',
      icon: <CreditCard size={20} />,
      action: () => {
        if (onScrollToCards) {
          onScrollToCards();
        } else {
          // Fallback: scroll to top where cards are shown
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      isActive: false,
    },
    {
      label: 'Settings',
      icon: <Settings size={20} />,
      action: () => router.push('/dashboard/settings'),
      isActive: pathname === '/dashboard/settings' || pathname === '/settings',
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors"
            style={{
              color: item.isActive
                ? 'var(--color-primary)'
                : 'var(--color-text-secondary)',
            }}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
          >
            {item.icon}
            <span className="text-[10px] font-medium leading-none">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
