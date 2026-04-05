'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/shared/lib/format-currency';

// ============================================================
// Type Definitions
// ============================================================

interface MasterBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
}

interface MasterCard {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  benefits: {
    count: number;
    preview: string[];
  };
}

interface CardDetails {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  benefits: MasterBenefit[];
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface AvailableCardsResponse {
  success: boolean;
  cards: MasterCard[];
  pagination: PaginationInfo;
}

interface CardDetailsResponse {
  success: boolean;
  card: CardDetails;
}

interface AddCardResponse {
  success: boolean;
  userCard: {
    id: string;
    playerId: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;
    renewalDate: string;
    isOpen: boolean;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  benefitsCreated: number;
  message: string;
}

interface AddCardError {
  success: false;
  error: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  details?: string;
}

// ============================================================
// CardCatalog Component
// ============================================================

/**
 * CardCatalog - Discover and browse master cards from the catalog
 * 
 * Features:
 * - Paginated grid view of available cards
 * - Search and filter by issuer
 * - Click card to view details in modal
 * - Add card to collection with customization
 * - Duplicate detection (show owned cards)
 * 
 * Responsive: Mobile (1 col), Tablet (2 cols), Desktop (3-4 cols)
 */
export function CardCatalog() {
  // ========== Pagination & Filtering State ==========
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssuer, setSelectedIssuer] = useState<string | null>(null);

  // ========== Data Loading State ==========
  const [cards, setCards] = useState<MasterCard[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========== Modal & Selection State ==========
  const [selectedCard, setSelectedCard] = useState<CardDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // ========== Card Details Loading State ==========
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // ========== Add Card Form State ==========
  const [formData, setFormData] = useState({
    customName: '',
    actualAnnualFee: 0,
    renewalDate: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ========== Get list of issuers for filter dropdown ==========
  const issuers = Array.from(new Set(cards.map((c) => c.issuer))).sort();

  // ========== Fetch available cards ==========
  useEffect(() => {
    const fetchCards = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
        });

        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim());
        }
        if (selectedIssuer) {
          params.append('issuer', selectedIssuer);
        }

        const response = await fetch(`/api/cards/available?${params}`);
        const data = (await response.json()) as AvailableCardsResponse | { success: false; error: string };

        if (!data.success) {
          const errorData = data as { success: false; error: string };
          setError(errorData.error || 'Failed to load cards');
          setCards([]);
          setPagination(null);
        } else {
          const successData = data as AvailableCardsResponse;
          setCards(successData.cards);
          setPagination(successData.pagination);
        }
      } catch (err) {
        console.error('Failed to load cards:', err);
        setError('Failed to load cards. Please try again.');
        setCards([]);
        setPagination(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCards();
  }, [currentPage, searchQuery, selectedIssuer]);

  // ========== Fetch card details when clicking a card ==========
  const handleCardClick = async (cardId: string) => {
    try {
      setShowDetailsModal(true);
      setDetailsLoading(true);
      setDetailsError(null);

      const response = await fetch(`/api/cards/master/${cardId}`);
      const data = (await response.json()) as CardDetailsResponse | { success: false; error: string };

      if (!data.success) {
        const errorData = data as { success: false; error: string };
        setDetailsError(errorData.error || 'Failed to load card details');
      } else {
        const successData = data as CardDetailsResponse;
        setSelectedCard(successData.card);
        // Pre-fill form with card defaults
        const card = successData.card;
        setFormData({
          customName: card.cardName,
          actualAnnualFee: card.defaultAnnualFee,
          renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            .toISOString()
            .split('T')[0],
        });
        setFormErrors({});
        setSubmitError(null);
      }
    } catch (err) {
      console.error('Failed to load card details:', err);
      setDetailsError('Failed to load card details. Please try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  // ========== Form input change handler ==========
  const handleFormChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ========== Validate form ==========
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Custom name validation (optional, max 100 chars)
    if (formData.customName && formData.customName.length > 100) {
      newErrors.customName = 'Card name must be 100 characters or less';
    }

    // Annual fee validation (must be non-negative integer, max $9,999)
    if (typeof formData.actualAnnualFee === 'number') {
      if (formData.actualAnnualFee < 0 || formData.actualAnnualFee > 999900) {
        newErrors.actualAnnualFee = 'Annual fee must be between $0 and $9,999';
      }
    }

    // Renewal date validation (must be in future)
    if (formData.renewalDate) {
      const renewalDate = new Date(formData.renewalDate);
      if (renewalDate < new Date()) {
        newErrors.renewalDate = 'Renewal date must be in the future';
      }
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ========== Submit add card form ==========
  const handleAddCard = async () => {
    if (!validateForm() || !selectedCard) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const response = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: selectedCard.id,
          customName: formData.customName || null,
          actualAnnualFee: formData.actualAnnualFee || null,
          renewalDate: formData.renewalDate || null,
        }),
      });

      const data = (await response.json()) as AddCardResponse | AddCardError;

      if (!data.success) {
        const errorData = data as AddCardError;
        if (response.status === 409) {
          setSubmitError('You already own this card');
        } else if (errorData.fieldErrors) {
          setFormErrors(errorData.fieldErrors);
          setSubmitError('Please fix the errors above');
        } else {
          setSubmitError(errorData.error || 'Failed to add card');
        }
      } else {
        // Success!
        setSubmitSuccess(true);
        // Reset form after 2 seconds
        setTimeout(() => {
          setShowAddModal(false);
          setShowDetailsModal(false);
          setSelectedCard(null);
          setFormData({
            customName: '',
            actualAnnualFee: 0,
            renewalDate: '',
          });
          setSubmitSuccess(false);
          // Refresh card list to show ownership indicator
          setCurrentPage(1);
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to add card:', err);
      setSubmitError('Failed to add card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== Render Loading State ==========
  if (isLoading && cards.length === 0) {
    return (
      <div className="space-y-6">
        {/* Filter Bar Skeleton */}
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 flex-shrink-0" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
        </div>

        {/* Card Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ========== Render Error State ==========
  if (error && cards.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <button
            onClick={() => setCurrentPage(1)}
            className="mt-2 text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ========== Render Empty State ==========
  if (!isLoading && cards.length === 0 && !error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">No cards match your filters</p>
        {(searchQuery || selectedIssuer) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedIssuer(null);
              setCurrentPage(1);
            }}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  // ========== Render Main Content ==========
  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />

        {issuers.length > 0 && (
          <select
            value={selectedIssuer || ''}
            onChange={(e) => {
              setSelectedIssuer(e.target.value || null);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Issuers</option>
            {issuers.map((issuer) => (
              <option key={issuer} value={issuer}>
                {issuer}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className="text-left border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg dark:hover:shadow-lg/50 cursor-pointer transition-shadow bg-white dark:bg-gray-800"
          >
            {/* Card Image */}
            {card.cardImageUrl && (
              <img
                src={card.cardImageUrl}
                alt={card.cardName}
                className="w-full h-32 object-cover rounded mb-3"
              />
            )}

            {/* Card Name & Issuer */}
            <div className="mb-2">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                {card.cardName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.issuer}</p>
            </div>

            {/* Annual Fee */}
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {formatCurrency(card.defaultAnnualFee)}/year
            </div>

            {/* Benefit Preview */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {card.benefits.count} benefits • {card.benefits.preview.length} shown:
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {card.benefits.preview.slice(0, 2).map((benefit, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
                >
                  {benefit}
                </span>
              ))}
              {card.benefits.preview.length > 2 && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                  +{card.benefits.preview.length - 2}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          {Array.from({ length: pagination.totalPages }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded ${
                currentPage === i + 1
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
            disabled={!pagination.hasMore}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Card Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedCard?.cardName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">{selectedCard?.issuer}</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-2xl leading-none text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {detailsLoading ? (
                <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                  Loading card details...
                </div>
              ) : detailsError ? (
                <div className="text-red-600 dark:text-red-400 py-4">{detailsError}</div>
              ) : selectedCard ? (
                <div className="space-y-4">
                  {/* Card Image */}
                  {selectedCard.cardImageUrl && (
                    <img
                      src={selectedCard.cardImageUrl}
                      alt={selectedCard.cardName}
                      className="w-full h-40 object-cover rounded"
                    />
                  )}

                  {/* Metadata */}
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Default Annual Fee:{' '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(selectedCard.defaultAnnualFee)}
                      </span>
                    </p>
                  </div>

                  {/* Benefits List */}
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Benefits ({selectedCard.benefits.length})
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedCard.benefits.map((benefit) => (
                        <div
                          key={benefit.id}
                          className="p-2 bg-gray-50 dark:bg-gray-700 rounded border-l-2 border-blue-500"
                        >
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {benefit.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {benefit.type} • {benefit.resetCadence}
                            {benefit.stickerValue > 0 && ` • ${formatCurrency(benefit.stickerValue)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Card Button */}
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium mt-4"
                  >
                    Add to My Cards
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Add {selectedCard?.cardName} to Your Collection
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="text-2xl leading-none text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {submitSuccess ? (
                <div className="text-center py-8">
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    ✓ Card added successfully!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submitError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                      {submitError}
                    </div>
                  )}

                  {/* Custom Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Card Name (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.customName}
                      onChange={(e) => handleFormChange('customName', e.target.value)}
                      maxLength={100}
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${
                        formErrors.customName
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder={selectedCard?.cardName}
                    />
                    {formErrors.customName && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {formErrors.customName}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formData.customName.length}/100
                    </p>
                  </div>

                  {/* Annual Fee Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Annual Fee (optional, in dollars)
                    </label>
                    <input
                      type="number"
                      value={(formData.actualAnnualFee / 100).toFixed(2)}
                      onChange={(e) =>
                        handleFormChange(
                          'actualAnnualFee',
                          Math.round(parseFloat(e.target.value) * 100)
                        )
                      }
                      min="0"
                      max="9999"
                      step="0.01"
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${
                        formErrors.actualAnnualFee
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder={`${selectedCard ? formatCurrency(selectedCard.defaultAnnualFee) : '$0.00'}`}
                    />
                    {formErrors.actualAnnualFee && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {formErrors.actualAnnualFee}
                      </p>
                    )}
                  </div>

                  {/* Renewal Date Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Renewal Date (required)
                    </label>
                    <input
                      type="date"
                      value={formData.renewalDate}
                      onChange={(e) => handleFormChange('renewalDate', e.target.value)}
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 ${
                        formErrors.renewalDate
                          ? 'border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    {formErrors.renewalDate && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {formErrors.renewalDate}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleAddCard}
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {isSubmitting ? 'Adding...' : 'Add Card'}
                    </button>
                    <button
                      onClick={() => setShowAddModal(false)}
                      disabled={isSubmitting}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
