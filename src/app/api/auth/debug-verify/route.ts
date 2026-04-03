/**
 * DEBUG ENDPOINT: Verify session token and return detailed diagnostics
 * 
 * This endpoint is for debugging authentication issues.
 * It accepts a session token and returns step-by-step verification results.
 * 
 * NOTE: This should be removed before production deployment!
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  isSessionExpired,
} from '@/lib/auth-utils';
import {
  getSessionByToken,
  userExists,
} from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json({
        error: 'token parameter required',
      }, { status: 400 });
    }

    const results: Record<string, unknown> = {};

    // Step 1: Verify JWT signature
    try {
      const payload = verifySessionToken(token);
      results.step1_jwt_verify = {
        status: 'pass',
        payload,
      };

      // Step 2: Check expiration
      const expired = isSessionExpired(payload);
      results.step2_expiration_check = {
        status: expired ? 'fail' : 'pass',
        isExpired: expired,
        expiresAt: new Date(payload.expiresAt * 1000).toISOString(),
        nowUnix: Math.floor(Date.now() / 1000),
        expiresAtUnix: payload.expiresAt,
      };

      if (!expired) {
        // Step 3: Check session in database
        const dbSession = await getSessionByToken(token);
        results.step3_database_lookup = {
          status: dbSession ? 'pass' : 'fail',
          found: !!dbSession,
          session: dbSession ? {
            id: dbSession.id,
            userId: dbSession.userId,
            isValid: dbSession.isValid,
            expiresAt: dbSession.expiresAt,
          } : null,
        };

        if (dbSession) {
          // Step 4: Check user exists
          const userExistsResult = await userExists(payload.userId);
          results.step4_user_exists = {
            status: userExistsResult ? 'pass' : 'fail',
            exists: userExistsResult,
            userId: payload.userId,
          };

          if (userExistsResult) {
            results.overall = 'success';
          } else {
            results.overall = 'fail_step4';
          }
        } else {
          results.overall = 'fail_step3';
        }
      } else {
        results.overall = 'fail_step2';
      }
    } catch (error) {
      results.step1_jwt_verify = {
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.overall = 'fail_step1';
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
