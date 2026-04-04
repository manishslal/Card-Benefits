/**
 * src/app/error.tsx
 *
 * Error Boundary Component
 *
 * This client component catches errors that occur in the app directory
 * and provides a fallback UI for error states. It handles both rendering
 * errors and server errors gracefully.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Error Boundary Props
 */
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root Error Boundary
 *
 * Catches errors in child components and displays a fallback UI.
 * The 'reset' function can be called to retry rendering the component tree.
 * 
 * Uses design tokens for all colors to ensure:
 * - Proper dark mode support
 * - WCAG AA contrast compliance (4.5:1+)
 * - Accessibility with proper color handling
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error for debugging and monitoring
    console.error('Application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        {/* Background gradient using design tokens for light/dark mode support */}
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
          {/* Main error card container */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-700">
            {/* Error Icon Container */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 dark:bg-red-950 rounded-full mb-4">
                <AlertTriangle
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Error Heading */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 text-center mb-2">
              Something went wrong!
            </h1>
            
            {/* Error Description */}
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              An unexpected error occurred. Please try again or contact support if
              the problem persists.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && error.message && (
              <details className="mb-6 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer font-mono text-sm text-gray-700 dark:text-gray-300 font-semibold hover:text-gray-900 dark:hover:text-gray-100">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto max-h-32 font-mono whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
                {error.digest && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <strong>Digest:</strong> {error.digest}
                  </p>
                )}
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Try Again Button - Primary action */}
              <button
                onClick={reset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
              {/* Go Home Button - Secondary action */}
              <Link
                href="/"
                className="flex-1 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500 text-gray-900 dark:text-gray-50 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-center"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
