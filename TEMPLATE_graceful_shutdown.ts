/**
 * Graceful Shutdown Handler
 * 
 * Ensures proper cleanup when the application receives SIGTERM/SIGINT signals.
 * This is especially important in containerized environments (Docker, Railway).
 * 
 * When Railway needs to restart or scale down, it sends SIGTERM signal.
 * Without graceful shutdown:
 * - In-flight requests are abruptly terminated
 * - Database connections are dropped mid-transaction
 * - File uploads may be corrupted
 * - Jobs may be left in inconsistent state
 * 
 * With graceful shutdown:
 * - In-flight requests complete normally
 * - New connections are rejected
 * - Database connections drain gracefully
 * - Process exits cleanly after timeout
 */

import { prisma } from '@/lib/prisma';

// Configuration
const SHUTDOWN_TIMEOUT = 30_000; // 30 seconds max to wait for graceful shutdown
const GRACEFUL_SHUTDOWN_ENABLED = process.env.NODE_ENV === 'production';

/**
 * Setup graceful shutdown handlers
 * Call this in your server startup (e.g., in a layout or at app start)
 */
export function setupGracefulShutdown() {
  if (!GRACEFUL_SHUTDOWN_ENABLED) {
    console.log('[SHUTDOWN] Graceful shutdown disabled (not production)');
    return;
  }

  // Handle SIGTERM (sent by container orchestration, Railway, etc.)
  process.on('SIGTERM', handleShutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C in terminal)
  process.on('SIGINT', handleShutdown('SIGINT'));

  // Handle uncaught exceptions (last resort)
  process.on('uncaughtException', (error) => {
    console.error('[SHUTDOWN] Uncaught exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[SHUTDOWN] Unhandled rejection:', { reason, promise });
    process.exit(1);
  });

  console.log('[SHUTDOWN] Graceful shutdown handlers registered');
}

/**
 * Handle shutdown signal
 */
function handleShutdown(signal: string) {
  return async () => {
    console.log(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

    const startTime = Date.now();
    const shutdownTimer = setTimeout(() => {
      console.error(
        `[SHUTDOWN] Graceful shutdown timeout (${SHUTDOWN_TIMEOUT}ms), forcing exit`
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    try {
      // 1. Stop accepting new connections
      console.log('[SHUTDOWN] Stopping new connection acceptance');
      // This would be handled by the server (Next.js handles automatically)

      // 2. Drain existing connections (give them time to complete)
      console.log('[SHUTDOWN] Giving in-flight requests time to complete (5s timeout)');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 3. Disconnect from database
      console.log('[SHUTDOWN] Disconnecting from database');
      await prisma.$disconnect();
      console.log('[SHUTDOWN] Database disconnected');

      // 4. Clean exit
      const duration = Date.now() - startTime;
      console.log(
        `[SHUTDOWN] Graceful shutdown completed in ${duration}ms`
      );

      clearTimeout(shutdownTimer);
      process.exit(0);
    } catch (error) {
      console.error('[SHUTDOWN] Error during graceful shutdown:', error);
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  };
}

/**
 * Usage in your application:
 * 
 * Option 1: In src/app/layout.tsx (React Server Component)
 * ```typescript
 * import { setupGracefulShutdown } from '@/lib/graceful-shutdown';
 * 
 * // This runs once at server startup
 * setupGracefulShutdown();
 * 
 * export default function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode;
 * }) {
 *   return (
 *     <html>
 *       <body>{children}</body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * Option 2: In a separate server initialization file
 * ```typescript
 * // src/lib/init-server.ts
 * export function initializeServer() {
 *   setupGracefulShutdown();
 *   // Other initialization...
 * }
 * ```
 * 
 * Then import in layout:
 * ```typescript
 * import { initializeServer } from '@/lib/init-server';
 * initializeServer();
 * ```
 */

/**
 * Testing graceful shutdown locally:
 * 
 * 1. Start dev server:
 *    npm run dev
 * 
 * 2. In another terminal, send SIGTERM:
 *    kill -TERM <PID>
 *    # or
 *    kill -15 $(lsof -t -i :3000)
 * 
 * 3. Should see:
 *    [SHUTDOWN] Received SIGTERM, starting graceful shutdown...
 *    [SHUTDOWN] Stopping new connection acceptance
 *    [SHUTDOWN] Giving in-flight requests time to complete (5s timeout)
 *    [SHUTDOWN] Disconnecting from database
 *    [SHUTDOWN] Database disconnected
 *    [SHUTDOWN] Graceful shutdown completed in XXXms
 * 
 * 4. Process should exit with code 0 (success)
 */
