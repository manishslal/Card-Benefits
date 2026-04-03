/**
 * Health Check Endpoint for Railway
 * 
 * This endpoint allows Railway to monitor application health
 * and automatically restart unhealthy instances.
 * 
 * Responds with:
 * - 200: Application is healthy
 * - 503: Application is unhealthy (database connection failed)
 * 
 * Configure in railway.json:
 * {
 *   "deploy": {
 *     "healthCheck": {
 *       "enabled": true,
 *       "endpoint": "/api/health",
 *       "periodSeconds": 30,
 *       "timeoutSeconds": 5,
 *       "failureThreshold": 3
 *     }
 *   }
 * }
 * 
 * Usage:
 * curl http://localhost:3000/api/health
 * 
 * Expected response:
 * {
 *   "status": "healthy",
 *   "timestamp": "2025-01-15T10:30:00.000Z",
 *   "uptime": 3600.5,
 *   "database": "connected"
 * }
 */

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Test database connectivity
    // Using a simple query that doesn't require authentication
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        responseTime: `${responseTime}ms`,
        node_env: process.env.NODE_ENV,
        version: process.env.npm_package_version || 'unknown',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[HEALTH_CHECK] Failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'disconnected',
        responseTime: `${responseTime}ms`,
        error: 'Database connection failed',
        node_env: process.env.NODE_ENV,
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
          'Retry-After': '30', // Tell clients to retry in 30 seconds
        },
      }
    );
  }
}

// Optional: HEAD request for lightweight health checks
export async function HEAD(request: NextRequest) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
