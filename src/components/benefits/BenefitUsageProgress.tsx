'use client';

/**
 * BenefitUsageProgress Component
 * 
 * Displays a visual progress bar showing claimed vs available amount for
 * a benefit period. Shows current period status and click-to-claim functionality.
 */

import React, { useState } from 'react';
import { MarkBenefitUsedModal } from './MarkBenefitUsedModal';

export interface BenefitUsageProgressProps {
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
  userCard: {
    id: string;
    renewalDate: Date;
  };
  status: {
    amountAvailable: number;
    amountClaimed: number;
    percentageClaimed: number;
    periodStart: Date;
    periodEnd: Date;
  };
  onClaimSuccess?: () => void;
  onClick?: () => void;
  className?: string;
}

export function BenefitUsageProgress({
  benefit,
  userCard,
  status,
  onClaimSuccess,
  onClick,
  className = '',
}: BenefitUsageProgressProps) {
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    onClick ? onClick() : setShowModal(true);
  };

  const remaining = Math.max(0, status.amountAvailable - status.amountClaimed);
  const isFull = remaining === 0;
  const isPartial = status.amountClaimed > 0 && !isFull;

  // Determine color based on status
  let progressColor = 'bg-gray-300'; // Not started
  let statusText = `Claim $${(status.amountAvailable / 100).toFixed(2)}`;

  if (isFull) {
    progressColor = 'bg-green-500';
    statusText = 'Fully Claimed ✓';
  } else if (isPartial) {
    progressColor = 'bg-blue-500';
    statusText = `Claim $${(remaining / 100).toFixed(2)} more`;
  }

  return (
    <>
      <div
        className={`space-y-2 cursor-pointer ${className}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        {/* Label */}
        <div className="flex items-center justify-between text-sm font-medium">
          <span>
            ${(status.amountClaimed / 100).toFixed(2)} / ${(status.amountAvailable / 100).toFixed(2)}
          </span>
          <span
            className={`text-xs font-semibold ${
              isFull ? 'text-green-600' : isPartial ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            {statusText}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{
              width: `${Math.min(100, status.percentageClaimed)}%`,
            }}
          />
        </div>

        {/* Period Info */}
        <div className="text-xs text-gray-500">
          {status.periodStart.toLocaleDateString()} - {status.periodEnd.toLocaleDateString()}
        </div>
      </div>

      {/* Modal */}
      <MarkBenefitUsedModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          setShowModal(false);
          onClaimSuccess?.();
        }}
        benefit={benefit}
        userCard={userCard}
      />
    </>
  );
}
