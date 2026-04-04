/**
 * src/app/layout.tsx
 *
 * Root Layout Component
 *
 * Provides the HTML document structure, metadata, and global styles for all pages.
 * This is a Server Component that wraps all routes in the app directory.
 */

import type { Metadata, Viewport } from 'next';
import '@/styles/design-tokens.css';
import '@/styles/animations.css';
import '@/styles/globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ClientLayoutWrapper } from '@/components/ClientLayoutWrapper';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Card Benefits Tracker - Track & Maximize Your Credit Card Benefits',
  description: 'Track benefits across multiple cards, identify expiring benefits, and maximize your spending value with our premium card benefits tracker.',
};

// ---------------------------------------------------------------------------
// Root Layout Component
// ---------------------------------------------------------------------------

/**
 * Root Layout - Server Component
 *
 * Renders the HTML document structure and applies global styles.
 * All routes are rendered as children of this component.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={cn("font-sans", geist.variable)} 
      suppressHydrationWarning
    >
      <head>
        {/* 
          Import Google Fonts for design system typography
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* 
          Theme Initialization Script
          Runs BEFORE React hydration to prevent flash of wrong theme.
          Checks localStorage for user preference, falls back to system preference,
          then applies colorScheme synchronously.
          
          suppressHydrationWarning on <html> prevents hydration mismatch warnings
          because the color scheme may be updated after server rendering.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme-preference');
                const prefersDark = 
                  savedTheme === 'dark' || 
                  (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
                
                if (prefersDark) {
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-[var(--color-bg)] text-[var(--color-text)]">
        <ThemeProvider defaultTheme="system" storageKey="theme-preference">
          <ClientLayoutWrapper>
            {/* Skip Link - Hidden by default, visible on focus (keyboard navigation) */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded"
            >
              Skip to main content
            </a>
            
            {children}
          </ClientLayoutWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
