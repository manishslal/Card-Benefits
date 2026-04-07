'use client';

/**
 * HistoricalUsageTab Component
 * 
 * Displays historical benefit claims in a table format with filtering,
 * sorting, and actions (edit/delete). Users can see past periods and claims.
 */

import React, { useState, useEffect } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MarkBenefitUsedModal } from './MarkBenefitUsedModal';

export interface BenefitUsageRecord {
  id: string;
  masterBenefitName?: string;
  periodStart: Date;
  periodEnd: Date;
  amountAvailable: number;
  amountClaimed: number;
  notes?: string;
  claimDate?: Date;
}

export interface HistoricalUsageTabProps {
  userCard: {
    id: string;
    renewalDate: Date;
  };
  benefit: {
    id: string;
    name: string;
    stickerValue: number;
    resetCadence: string;
    type?: string;
    masterCard?: {
      cardName: string;
    };
  };
  isLoading?: boolean;
  onRefresh?: () => void;
}

type FilterType = 'all' | 'this-month' | 'last-3-months' | 'last-6-months';

export function HistoricalUsageTab({
  userCard,
  benefit,
  isLoading = false,
  onRefresh,
}: HistoricalUsageTabProps) {
  const [records, setRecords] = useState<BenefitUsageRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedRecord, setSelectedRecord] = useState<BenefitUsageRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch records
  const fetchRecords = async () => {
    try {
      const response = await fetch(`/api/benefits/usage?userCardId=${userCard.id}&limit=100`);
      const data = await response.json();

      if (data.success) {
        // Filter for this benefit
        const benefitRecords = data.data.filter((r: any) => r.masterBenefitId === benefit.id);
        setRecords(benefitRecords);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [userCard.id, benefit.id]);

  // Filter records
  const now = new Date();
  let filteredRecords = [...records];

  if (filter === 'this-month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredRecords = filteredRecords.filter(r => new Date(r.periodStart) >= monthStart);
  } else if (filter === 'last-3-months') {
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    filteredRecords = filteredRecords.filter(r => new Date(r.periodStart) >= threeMonthsAgo);
  } else if (filter === 'last-6-months') {
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
    filteredRecords = filteredRecords.filter(r => new Date(r.periodStart) >= sixMonthsAgo);
  }

  // Sort
  if (sortOrder === 'newest') {
    filteredRecords.sort((a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime());
  } else {
    filteredRecords.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
  }

  const handleDelete = async (recordId: string) => {
    if (!window.confirm('Are you sure you want to delete this claim?')) {
      return;
    }

    setIsDeleting(recordId);
    try {
      const response = await fetch(`/api/benefits/usage/${recordId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRecords();
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (record: BenefitUsageRecord) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  };

  const getStatusIcon = (record: BenefitUsageRecord) => {
    if (record.amountClaimed === 0) return '-';
    if (record.amountClaimed === record.amountAvailable) return '✓';
    return '⚠';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            <SelectItem value="last-6-months">Last 6 Months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'newest' | 'oldest')}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchRecords}>
          Refresh
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No claims found</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claimed</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    {new Date(record.periodStart).toLocaleDateString()}
                    {' - '}
                    {new Date(record.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    <span className={
                      getStatusIcon(record) === '✓' ? 'text-green-600' :
                      getStatusIcon(record) === '⚠' ? 'text-blue-600' :
                      'text-gray-400'
                    }>
                      {getStatusIcon(record)}
                    </span>
                  </TableCell>
                  <TableCell>
                    ${(record.amountClaimed / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    ${(record.amountAvailable / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                    {record.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(record)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(record.id)}
                      disabled={isDeleting === record.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Modal */}
      {selectedRecord && (
        <MarkBenefitUsedModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRecord(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedRecord(null);
            fetchRecords();
          }}
          benefit={benefit}
          userCard={userCard}
          forPeriod={new Date(selectedRecord.periodStart)}
        />
      )}
    </div>
  );
}
