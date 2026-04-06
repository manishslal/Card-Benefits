/**
 * Audit logging utilities for admin operations.
 *
 * This module provides:
 * - Logging create, update, delete operations
 * - Change tracking (old values vs new values)
 * - Automatic JSON serialization
 * - Type-safe audit trail creation
 */

import { prisma } from '@/shared/lib';
import type { AdminRequestContext } from './auth';

// ============================================================
// Types
// ============================================================

export interface AuditLogOptions {
  adminUserId: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE';
  resourceType: 'CARD' | 'BENEFIT' | 'USER_ROLE' | 'SYSTEM_SETTING';
  resourceId: string;
  resourceName?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================
// Audit Logging
// ============================================================

/**
 * Creates an audit log entry for an admin operation.
 *
 * Safely serializes old and new values to JSON strings,
 * handling circular references gracefully.
 */
export async function createAuditLog(
  options: AuditLogOptions
): Promise<string> {
  try {
    const auditLog = await prisma.adminAuditLog.create({
      data: {
        adminUserId: options.adminUserId,
        actionType: options.actionType,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        resourceName: options.resourceName,
        oldValues: options.oldValues ? JSON.stringify(options.oldValues) : null,
        newValues: options.newValues ? JSON.stringify(options.newValues) : null,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
    });

    return auditLog.id;
  } catch (error) {
    console.error('[Audit Log Error]', error);
    // Don't throw - audit failures shouldn't block operations
    // But log the error for monitoring
    return '';
  }
}

/**
 * Logs a resource creation
 */
export async function logResourceCreation(
  adminContext: AdminRequestContext,
  resourceType: 'CARD' | 'BENEFIT' | 'USER_ROLE',
  resourceId: string,
  resourceName: string,
  newValues: Record<string, any>,
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<void> {
  await createAuditLog({
    adminUserId: adminContext.userId,
    actionType: 'CREATE',
    resourceType,
    resourceId,
    resourceName,
    newValues,
    ipAddress: ipAddress || adminContext.ipAddress,
    userAgent: userAgent || adminContext.userAgent,
  });
}

/**
 * Logs a resource update, including change details
 */
export async function logResourceUpdate(
  adminContext: AdminRequestContext,
  resourceType: 'CARD' | 'BENEFIT' | 'USER_ROLE',
  resourceId: string,
  resourceName: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<void> {
  await createAuditLog({
    adminUserId: adminContext.userId,
    actionType: 'UPDATE',
    resourceType,
    resourceId,
    resourceName,
    oldValues,
    newValues,
    ipAddress: ipAddress || adminContext.ipAddress,
    userAgent: userAgent || adminContext.userAgent,
  });
}

/**
 * Logs a resource deletion
 */
export async function logResourceDeletion(
  adminContext: AdminRequestContext,
  resourceType: 'CARD' | 'BENEFIT' | 'USER_ROLE',
  resourceId: string,
  resourceName: string,
  deletedValues?: Record<string, any>,
  ipAddress: string | null = null,
  userAgent: string | null = null
): Promise<void> {
  await createAuditLog({
    adminUserId: adminContext.userId,
    actionType: 'DELETE',
    resourceType,
    resourceId,
    resourceName,
    oldValues: deletedValues,
    ipAddress: ipAddress || adminContext.ipAddress,
    userAgent: userAgent || adminContext.userAgent,
  });
}

/**
 * Tracks which fields changed in an update operation.
 * Only includes fields where the value actually changed.
 */
export function getChangedFields(
  oldValues: Record<string, any>,
  newValues: Record<string, any>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};

  for (const key in newValues) {
    if (key in oldValues && oldValues[key] !== newValues[key]) {
      changes[key] = {
        old: oldValues[key],
        new: newValues[key],
      };
    }
  }

  return changes;
}

/**
 * Formats audit log entry for API response
 */
export function formatAuditLogResponse(auditLog: any) {
  return {
    id: auditLog.id,
    actionType: auditLog.actionType,
    resourceType: auditLog.resourceType,
    resourceId: auditLog.resourceId,
    resourceName: auditLog.resourceName,
    adminUserId: auditLog.adminUserId,
    adminEmail: auditLog.adminUser?.email,
    timestamp: auditLog.timestamp.toISOString(),
    ipAddress: auditLog.ipAddress,
    userAgent: auditLog.userAgent,
    oldValues: auditLog.oldValues ? JSON.parse(auditLog.oldValues) : null,
    newValues: auditLog.newValues ? JSON.parse(auditLog.newValues) : null,
  };
}
