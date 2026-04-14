'use client';

import React from 'react';
import { Home, Armchair, Bot, UserRound } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Mobile Bottom Navigation Bar
 *
 * Only visible on mobile viewports (hidden on md: and above).
 * Includes safe-area-bottom padding for notch devices.
 */

interface BottomNavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  isActive: boolean;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const items: BottomNavItem[] = [
    {
      label: 'Home',
      icon: <Home size={20} />,
      href: '/dashboard',
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Lounges',
      icon: <Armchair size={20} />,
      href: '/dashboard/lounges',
      isActive: pathname === '/dashboard/lounges',
    },
    {
      label: 'Assistant',
      icon: <Bot size={20} />,
      href: '/dashboard/assistant',
      isActive: pathname === '/dashboard/assistant',
    },
    {
      label: 'Profile',
      icon: <UserRound size={20} />,
      href: '/settings?tab=profile',
      isActive: pathname === '/settings' || pathname === '/dashboard/settings',
    },
  ];

  return (
    <nav
      data-bottom-nav
      className="left-0 right-0 bottom-0 z-40 md:hidden border-t"
      style={{
        position: 'fixed',
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: 'translateZ(0)',
      }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
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
