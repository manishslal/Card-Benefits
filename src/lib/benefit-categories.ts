/**
 * benefit-categories.ts
 *
 * Category definitions and grouping logic for benefit cards.
 * The inferBenefitCategory callback is passed in from BenefitsGrid
 * so this module stays decoupled from component internals.
 */

export interface BenefitCategory {
  type: string;
  label: string;
  icon: string;
  displayOrder: number;
}

export const BENEFIT_CATEGORIES: BenefitCategory[] = [
  { type: 'travel',         label: 'Travel Credits',         icon: 'Plane',      displayOrder: 1 },
  { type: 'dining',         label: 'Dining & Lifestyle',     icon: 'Utensils',   displayOrder: 2 },
  { type: 'lounge',         label: 'Lounge Access',          icon: 'Armchair',   displayOrder: 3 },
  { type: 'hotel',          label: 'Hotel Benefits',         icon: 'Hotel',      displayOrder: 4 },
  { type: 'entertainment',  label: 'Entertainment',          icon: 'Music',      displayOrder: 5 },
  { type: 'streaming',      label: 'Streaming',              icon: 'Tv',         displayOrder: 6 },
  { type: 'shopping',       label: 'Shopping Credits',       icon: 'Tag',        displayOrder: 7 },
  { type: 'cashback',       label: 'Cash Back',              icon: 'DollarSign', displayOrder: 8 },
  { type: 'points',         label: 'Points & Rewards',       icon: 'Star',       displayOrder: 9 },
  { type: 'insurance',      label: 'Insurance & Protection', icon: 'Shield',     displayOrder: 10 },
  { type: 'wellness',       label: 'Wellness & Fitness',     icon: 'Heart',      displayOrder: 11 },
  { type: 'transportation', label: 'Transportation',         icon: 'Car',        displayOrder: 12 },
  { type: 'rideshare',      label: 'Rideshare',              icon: 'Car',        displayOrder: 13 },
  { type: 'banking',        label: 'Banking',                icon: 'Landmark',   displayOrder: 14 },
  { type: 'other',          label: 'Other Benefits',         icon: 'Zap',        displayOrder: 99 },
];

const categoryMap = new Map<string, BenefitCategory>(
  BENEFIT_CATEGORIES.map((c) => [c.type, c])
);

const fallbackCategory: BenefitCategory = {
  type: 'other',
  label: 'Other Benefits',
  icon: 'Zap',
  displayOrder: 99,
};

export function getCategoryForType(type: string): BenefitCategory {
  return categoryMap.get(type) || fallbackCategory;
}

/**
 * Group a flat list of benefits by inferred UI category.
 * @param benefits   The flat benefit list
 * @param inferCategory  Callback that returns a category type string for a benefit
 * @returns Ordered array of { category, benefits } — categories with 0 benefits are excluded
 */
export function groupBenefitsByCategory<T>(
  benefits: T[],
  inferCategory: (b: T) => string
): Array<{ category: BenefitCategory; benefits: T[] }> {
  const grouped = new Map<string, T[]>();

  for (const b of benefits) {
    const catType = inferCategory(b);
    const existing = grouped.get(catType);
    if (existing) {
      existing.push(b);
    } else {
      grouped.set(catType, [b]);
    }
  }

  // Build result sorted by displayOrder
  const result: Array<{ category: BenefitCategory; benefits: T[] }> = [];
  for (const [catType, catBenefits] of grouped) {
    result.push({
      category: getCategoryForType(catType),
      benefits: catBenefits,
    });
  }

  result.sort((a, b) => a.category.displayOrder - b.category.displayOrder);
  return result;
}
