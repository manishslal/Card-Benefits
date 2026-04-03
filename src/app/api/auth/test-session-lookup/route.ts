/**
 * TEMPORARY TEST ENDPOINT: Test session lookup in database
 * 
 * This helps debug why middleware can't find sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionToken } = body as { sessionToken?: string };

    if (!sessionToken) {
      return NextResponse.json({
        error: 'sessionToken parameter required',
      }, { status: 400 });
    }

    console.log('[Test] Looking up session token...');
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      select: {
        id: true,
        userId: true,
        isValid: true,
        expiresAt: true,
      },
    });

    console.log('[Test] Result:', session ? 'FOUND' : 'NOT FOUND');

    return NextResponse.json({
      found: !!session,
      session: session || null,
      token_length: sessionToken.length,
      token_prefix: sessionToken.substring(0, 30),
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
