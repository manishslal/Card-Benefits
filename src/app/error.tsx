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

import { useEffect } from 'react';

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
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error for debugging and monitoring
    console.error('Application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
            {/* Error Icon */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Something went wrong!
            </h1>
            <p className="text-gray-600 text-center mb-6">
              An unexpected error occurred. Please try again or contact support if
              the problem persists.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && error.message && (
              <details className="mb-6 p-3 bg-gray-50 rounded border border-gray-200">
                <summary className="cursor-pointer font-mono text-sm text-gray-700 font-semibold">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-32 font-mono whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
                {error.digest && (
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>Digest:</strong> {error.digest}
                  </p>
                )}
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Try Again
              </button>
              <a
                href="/"
                className="flex-1 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-center"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
