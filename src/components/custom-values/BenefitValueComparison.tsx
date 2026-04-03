'use client';

/**
 * BenefitValueComparison Component - STUB
 * 
 * NOTE: This is a stub component. The custom values feature is incomplete.
 * Full implementation will be completed in a future phase.
 */

import React from 'react';

interface BenefitValueComparisonProps {
  masterValue: number;
  declaredValue: number | null;
}

export const BenefitValueComparison: React.FC<BenefitValueComparisonProps> = ({
  masterValue,
  declaredValue,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
      <p>Master value: ${(masterValue / 100).toFixed(2)}</p>
      {declaredValue !== null && (
        <p>Declared value: ${(declaredValue / 100).toFixed(2)}</p>
      )}
    </div>
  );
};

BenefitValueComparison.displayName = 'BenefitValueComparison';
