/**
 * src/app/layout.tsx
 *
 * Root Layout Component
 *
 * Provides the HTML document structure, metadata, and global styles for all pages.
 * This is a Server Component that wraps all routes in the app directory.
 */

import type { Metadata } from 'next';
import '@/styles/design-tokens.css';
import '@/styles/globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Card Benefits Dashboard',
  description: 'Track benefits, optimize spending, maximize value',
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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        {/* 
          Theme Initialization Script
          Runs BEFORE React hydration to prevent flash of wrong theme.
          Checks localStorage for user preference, falls back to system preference,
          then applies .dark class synchronously to <html> element.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = 
                  savedTheme === 'dark' || 
                  (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
                
                if (prefersDark) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
