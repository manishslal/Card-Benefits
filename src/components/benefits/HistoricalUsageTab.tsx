'use client';

/**
 * HistoricalUsageTab Component
 * 
 * Displays historical benefit claims in a table format with filtering,
 * sorting, and actions (edit/delete). Users can see past periods and claims.
 */

import React, { useState, useEffect } from 'react';
import { MarkBenefitUsedModal } from './MarkBenefitUsedModal';

export interface BenefitUsageRecord {
  id: string;
  masterBenefitName?: string;
  periodStart: Date | string;
  periodEnd?: Date | string;
  amountAvailable: number;
  amountClaimed: number;
  notes?: string;
  claimDate?: Date | string;
  usageDate?: Date | string;
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
}: HistoricalUsageTabProps) {
  const [records, setRecords] = useState<BenefitUsageRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedRecord, setSelectedRecord] = useState<BenefitUsageRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch records
  const fetchRecords = async () => {
    setIsLoadingData(true);
    try {
      const response = await fetch(`/api/benefits/usage?userBenefitId=${benefit.id}&limit=100`);
      const data = await response.json();

      if (data.success) {
        setRecords(data.data);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [benefit.id]);

  // Filter records
  const now = new Date();
  let filteredRecords = [...records];

  if (filter === 'this-month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredRecords = filteredRecords.filter(r => new Date(r.usageDate || r.periodStart) >= monthStart);
  } else if (filter === 'last-3-months') {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    filteredRecords = filteredRecords.filter(r => new Date(r.usageDate || r.periodStart) >= threeMonthsAgo);
  } else if (filter === 'last-6-months') {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    filteredRecords = filteredRecords.filter(r => new Date(r.usageDate || r.periodStart) >= sixMonthsAgo);
  }

  // Sort
  if (sortOrder === 'newest') {
    filteredRecords.sort((a, b) => new Date(b.usageDate || b.periodStart).getTime() - new Date(a.usageDate || a.periodStart).getTime());
  } else {
    filteredRecords.sort((a, b) => new Date(a.usageDate || a.periodStart).getTime() - new Date(b.usageDate || b.periodStart).getTime());
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

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  };

  const getStatusIcon = (record: any) => {
    if (record.amountClaimed === 0) return '-';
    if (record.amountClaimed === record.amountAvailable) return '✓';
    return '⚠';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="all">All Time</option>
          <option value="this-month">This Month</option>
          <option value="last-3-months">Last 3 Months</option>
          <option value="last-6-months">Last 6 Months</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>

        <button
          onClick={fetchRecords}
          className="px-3 py-2 border rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {isLoadingData ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No claims found</div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Period</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Claimed</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Available</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Notes</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record: any) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">
                    {new Date(record.periodStart || record.usageDate).toLocaleDateString()}
                    {record.periodEnd && ' - ' + new Date(record.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-sm">
                    <span
                      className={
                        getStatusIcon(record) === '✓' ? 'text-green-600' :
                        getStatusIcon(record) === '⚠' ? 'text-blue-600' :
                        'text-gray-400'
                      }
                    >
                      {getStatusIcon(record)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    ${(record.amountClaimed / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    ${(record.amountAvailable / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                    {record.notes || '-'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                    <button
                      onClick={() => handleEdit(record)}
                      className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      disabled={isDeleting === record.id}
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
