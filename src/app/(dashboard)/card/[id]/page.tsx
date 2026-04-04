'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import Link from 'next/link';
import BenefitsList from '@/components/features/BenefitsList';
import BenefitsGrid from '@/components/features/BenefitsGrid';
import { CreditCard, ArrowLeft, Plus } from 'lucide-react';
import { EditCardModal } from '@/components/EditCardModal';
import { AddBenefitModal } from '@/components/AddBenefitModal';
import { EditBenefitModal } from '@/components/EditBenefitModal';
import { DeleteCardConfirmationDialog } from '@/components/DeleteCardConfirmationDialog';
import { DeleteBenefitConfirmationDialog } from '@/components/DeleteBenefitConfirmationDialog';

/**
 * Card Detail Page - Individual Card View
 * 
 * Features:
 * - Card header with name and details
 * - Card information section
 * - Toggle between list and grid views
 * - Benefits tracking with filters
 * - Edit and delete actions
 * - Modal integration for CRUD operations on cards and benefits
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

// Type definitions for card and benefit data
interface CardData {
  id: string;
  masterCardId: string; // For API operations (required)
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date | string;
  status: string;
  // Additional display fields (for demo/mock)
  issuer?: string;
  type?: string;
  lastFour?: string;
  rewardsRate?: string;
  issuedDate?: Date;
}

interface BenefitData {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  expirationDate: Date | string | null;
  isUsed?: boolean;
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;

  // State for card and benefits data
  const [card, setCard] = useState<CardData | null>(null);
  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  const [isLoadingCard, setIsLoadingCard] = useState(true);

  // Modal state management - each modal needs: isOpen state, and optionally selectedItem
  const [isEditCardOpen, setIsEditCardOpen] = useState(false);
  const [isAddBenefitOpen, setIsAddBenefitOpen] = useState(false);
  const [isEditBenefitOpen, setIsEditBenefitOpen] = useState(false);
  const [isDeleteBenefitOpen, setIsDeleteBenefitOpen] = useState(false);
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<BenefitData | null>(null);

  // View and filter state
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  /**
   * Fetch card data from API
   * Falls back to mock data if API call fails (for development)
   */
  useEffect(() => {
    const fetchCard = async () => {
      setIsLoadingCard(true);
      try {
        const response = await fetch(`/api/cards/${cardId}`);
        if (response.ok) {
          const data = await response.json();
          setCard(data);
        } else {
          throw new Error('Failed to fetch card');
        }
      } catch (error) {
        console.warn('Failed to fetch card from API, using mock data', error);
        // Use mock data as fallback for development
        setCard({
          id: cardId,
          customName: 'Chase Sapphire Reserve',
          actualAnnualFee: 550,
          renewalDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          status: 'active',
          masterCardId: cardId, // Use card ID as master card ID for API operations
          issuer: 'Chase',
          type: 'Visa Infinite',
          lastFour: '4242',
          rewardsRate: '3x on travel and dining',
          issuedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        });
      } finally {
        setIsLoadingCard(false);
      }
    };

    if (cardId) {
      fetchCard();
    }
  }, [cardId]);

  /**
   * Fetch benefits for this card from API
   * Falls back to mock data if API call fails (for development)
   */
  useEffect(() => {
    const fetchBenefits = async () => {
      try {
        const response = await fetch(`/api/cards/${cardId}/benefits`);
        if (response.ok) {
          const data = await response.json();
          setBenefits(data);
        } else {
          throw new Error('Failed to fetch benefits');
        }
      } catch (error) {
        console.warn('Failed to fetch benefits from API, using mock data', error);
        // Use mock data as fallback for development
        setBenefits([
          {
            id: '1',
            name: 'Travel Credit',
            type: 'StatementCredit',
            stickerValue: 300,
            userDeclaredValue: null,
            resetCadence: 'CalendarYear',
            expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            isUsed: false,
          },
          {
            id: '2',
            name: 'Airport Lounge Access',
            type: 'UsagePerk',
            stickerValue: 150,
            userDeclaredValue: null,
            resetCadence: 'CardmemberYear',
            expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            isUsed: false,
          },
          {
            id: '3',
            name: 'Dining Credit',
            type: 'StatementCredit',
            stickerValue: 100,
            userDeclaredValue: null,
            resetCadence: 'CalendarYear',
            expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isUsed: false,
          },
          {
            id: '4',
            name: 'Concierge Service',
            type: 'UsagePerk',
            stickerValue: 200,
            userDeclaredValue: null,
            resetCadence: 'CardmemberYear',
            expirationDate: null,
            isUsed: false,
          },
          {
            id: '5',
            name: 'Statement Credit',
            type: 'StatementCredit',
            stickerValue: 20,
            userDeclaredValue: null,
            resetCadence: 'OneTime',
            expirationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            isUsed: true,
          },
          {
            id: '6',
            name: 'Insurance Coverage',
            type: 'UsagePerk',
            stickerValue: 500,
            userDeclaredValue: null,
            resetCadence: 'CardmemberYear',
            expirationDate: null,
            isUsed: false,
          },
        ]);
      } finally {
        // Loading complete
      }
    };

    if (cardId) {
      fetchBenefits();
    }
  }, [cardId]);

  /**
   * Determine benefit status based on expiration date and usage
   * Used for filtering in the benefits list
   */
  const getBenefitStatus = (benefit: BenefitData): 'active' | 'expiring' | 'expired' | 'pending' => {
    if (!benefit.expirationDate) return 'pending';
    
    const expirationTime = new Date(benefit.expirationDate).getTime();
    const now = Date.now();
    const daysUntilExpiration = Math.ceil((expirationTime - now) / (1000 * 60 * 60 * 24));
    
    if (expirationTime < now) return 'expired';
    if (daysUntilExpiration <= 30) return 'expiring';
    return 'active';
  };

  // Filter benefits based on selected status and add status field for display
  const filteredBenefits = benefits
    .filter((benefit) => {
      if (filterStatus === 'all') return true;
      return getBenefitStatus(benefit) === filterStatus;
    })
    .map((benefit) => ({
      id: benefit.id,
      name: benefit.name,
      description: benefit.name, // Use name as description for display
      status: getBenefitStatus(benefit) as 'active' | 'expiring' | 'expired' | 'pending',
      expirationDate: benefit.expirationDate || undefined,
      value: benefit.stickerValue,
      type: benefit.type,
    }));

  /**
   * Handlers for Edit Card Modal
   * - Opens the edit modal
   * - Called when card is successfully updated to refresh data and close modal
   */
  const handleEditCardClick = () => {
    setIsEditCardOpen(true);
  };

  const handleCardUpdated = (updatedCard: CardData) => {
    setCard(updatedCard);
    setIsEditCardOpen(false);
  };

  /**
   * Handlers for Delete Card Confirmation
   * - Opens the delete confirmation dialog
   * - Called when deletion is confirmed to navigate back to dashboard
   */
  const handleDeleteCardClick = () => {
    setIsDeleteCardOpen(true);
  };

  const handleCardDeleted = () => {
    setIsDeleteCardOpen(false);
    // Redirect to dashboard after successful deletion
    router.push('/dashboard');
  };

  /**
   * Handlers for Add Benefit Modal
   * - Opens the add benefit modal
   * - Called when benefit is successfully added to refresh benefits list
   */
  const handleAddBenefitClick = () => {
    setIsAddBenefitOpen(true);
  };

  const handleBenefitAdded = (newBenefit: BenefitData) => {
    setBenefits([...benefits, newBenefit]);
    setIsAddBenefitOpen(false);
  };

  /**
   * Handlers for Edit Benefit Modal
   * - Opens the edit modal with the selected benefit
   * - Called when benefit is successfully updated to refresh benefits list
   */
  const handleEditBenefitClick = (benefitId: string) => {
    const benefit = benefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit(benefit);
      setIsEditBenefitOpen(true);
    }
  };

  const handleBenefitUpdated = (updatedBenefit: BenefitData) => {
    setBenefits(benefits.map((b) => (b.id === updatedBenefit.id ? updatedBenefit : b)));
    setIsEditBenefitOpen(false);
    setSelectedBenefit(null);
  };

  /**
   * Handlers for Delete Benefit Confirmation
   * - Opens the delete confirmation dialog with the selected benefit
   * - Called when deletion is confirmed to refresh benefits list
   */
  const handleDeleteBenefitClick = (benefitId: string) => {
    const benefit = benefits.find((b) => b.id === benefitId);
    if (benefit) {
      setSelectedBenefit(benefit);
      setIsDeleteBenefitOpen(true);
    }
  };

  const handleBenefitDeleted = () => {
    if (selectedBenefit) {
      setBenefits(benefits.filter((b) => b.id !== selectedBenefit.id));
    }
    setIsDeleteBenefitOpen(false);
    setSelectedBenefit(null);
  };

  /**
   * Handler: Mark Benefit as Used - Calls toggle-used API
   * Wave 2: One-click benefit marking without opening a modal
   * - Makes API call to toggle-used endpoint
   * - Updates UI optimistically
   * - Reverts on error
   */
  const handleMarkUsed = async (benefitId: string) => {
    try {
      // Optimistic UI update - mark the benefit as used immediately
      setBenefits(
        benefits.map((b) =>
          b.id === benefitId
            ? { ...b, isUsed: true }
            : b
        )
      );

      // Call the toggle-used API endpoint
      const response = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isUsed: true }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        setBenefits(
          benefits.map((b) =>
            b.id === benefitId
              ? { ...b, isUsed: false }
              : b
          )
        );

        const errorData = await response.json();
        console.error('Failed to mark benefit as used:', errorData);
        alert(`Error: ${errorData.error || 'Failed to mark benefit as used'}`);
        return;
      }

      // Success - benefit marked as used
      const data = await response.json();
      if (data.success) {
        // Update benefit with response data (includes updated timesUsed)
        setBenefits(
          benefits.map((b) =>
            b.id === benefitId
              ? {
                  ...b,
                  isUsed: data.benefit.isUsed,
                  // Note: timesUsed is not in our mock BenefitData, but will be in real API
                }
              : b
          )
        );
        // Show success toast
        alert('Benefit marked as used!');
      }
    } catch (error) {
      console.error('Error marking benefit as used:', error);
      // Revert optimistic update
      setBenefits(
        benefits.map((b) =>
          b.id === benefitId
            ? { ...b, isUsed: false }
            : b
        )
      );
      alert('Failed to mark benefit as used. Please try again.');
    }
  };

  /**
   * Calculate days until card renewal for display
   * Card header shows a warning if renewal is within 90 days
   */
  const daysUntilRenewal = card && card.renewalDate
    ? Math.ceil(
        (new Date(card.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // Show loading state while card is being fetched
  if (isLoadingCard) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <p className="text-[var(--color-text-secondary)]">Loading card details...</p>
      </div>
    );
  }

  // Show error state if card failed to load
  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <p className="text-[var(--color-text)] font-semibold mb-4">Failed to load card</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between">
            {/* Logo & Back Button */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <CreditCard size={20} />
                </div>
                <h1 className="text-lg font-bold text-[var(--color-text)]">
                  CardTrack
                </h1>
              </Link>

              <button
                onClick={() => router.back()}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
                aria-label="Go back"
              >
                <ArrowLeft size={18} />
                Back
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <SafeDarkModeToggle />
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleEditCardClick}
              >
                Edit Card
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={handleDeleteCardClick}
              >
                Delete Card
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Card Header Section */}
          <section className="mb-8">
            <div className="p-6 rounded-lg border" style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border)',
            }}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="mb-3">
                    <CreditCard size={48} className="text-[var(--color-primary)]" />
                  </div>
                  <h2
                    className="font-bold text-[var(--color-text)] mb-2"
                    style={{ fontSize: 'var(--text-h3)' }}
                  >
                    {card.customName || 'Credit Card'}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {card.issuer || 'Card Issuer'} • {card.type || 'Card Type'} • •••• {card.lastFour || 'XXXX'}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <div>
                    <span
                      className="text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      Annual Fee
                    </span>
                    <p className="text-xl font-mono font-bold text-[var(--color-text)]">
                      ${card.actualAnnualFee || 0}
                    </p>
                  </div>

                  <div className="mt-2">
                    <span
                      className="text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      Renews in
                    </span>
                    <p
                      className="text-base font-semibold"
                      style={{ color: daysUntilRenewal <= 90 ? 'var(--color-warning)' : 'var(--color-success)' }}
                    >
                      {daysUntilRenewal} days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card Details Section */}
          <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Issued
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {card.issuedDate 
                  ? new Date(card.issuedDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'
                }
              </p>
            </div>

            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Renewal Date
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {card.renewalDate
                  ? new Date(card.renewalDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A'
                }
              </p>
            </div>

            <div className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
              }}>
              <span
                className="text-xs font-semibold text-[var(--color-text-secondary)]"
              >
                Rewards Rate
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)] mt-1">
                {card.rewardsRate || 'N/A'}
              </p>
            </div>
          </section>

          {/* Benefits Section */}
          <section>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              <h3
                className="text-lg font-semibold text-[var(--color-text)]"
                style={{ fontSize: 'var(--text-h4)' }}
              >
                Card Benefits
              </h3>

              <div className="flex flex-wrap gap-2">
                {/* View toggle */}
                <div className="flex gap-1 p-1 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border)',
                  }}>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    Grid
                  </button>
                </div>

                {/* Add benefit button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddBenefitClick}
                >
                  <Plus size={16} className="mr-1" />
                  Add Benefit
                </Button>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['all', 'active', 'expiring', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {' '}
                  ({status === 'all' ? benefits.length : benefits.filter((b) => getBenefitStatus(b) === status).length})
                </button>
              ))}
            </div>

            {/* Benefits view */}
            {viewMode === 'list' ? (
              <BenefitsList
                benefits={filteredBenefits}
                onEdit={handleEditBenefitClick}
                onDelete={handleDeleteBenefitClick}
                onMarkUsed={handleMarkUsed}
              />
            ) : (
              <BenefitsGrid
                benefits={filteredBenefits}
                onEdit={handleEditBenefitClick}
                onDelete={handleDeleteBenefitClick}
                onMarkUsed={handleMarkUsed}
                gridColumns={3}
              />
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-6 mt-auto"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-xs text-[var(--color-text-secondary)]">
          <p>&copy; 2024 CardTrack. Track your benefits with confidence.</p>
        </div>
      </footer>

      {/* Modal Components - All CRUD operations */}
      
      {/* Edit Card Modal */}
      <EditCardModal
        card={card}
        isOpen={isEditCardOpen}
        onClose={() => setIsEditCardOpen(false)}
        onCardUpdated={handleCardUpdated}
      />

      {/* Delete Card Confirmation Dialog */}
      <DeleteCardConfirmationDialog
        card={card}
        benefitCount={benefits.length}
        isOpen={isDeleteCardOpen}
        onClose={() => setIsDeleteCardOpen(false)}
        onConfirm={handleCardDeleted}
      />

      {/* Add Benefit Modal */}
      <AddBenefitModal
        cardId={cardId}
        isOpen={isAddBenefitOpen}
        onClose={() => setIsAddBenefitOpen(false)}
        onBenefitAdded={handleBenefitAdded}
      />

      {/* Edit Benefit Modal */}
      <EditBenefitModal
        benefit={selectedBenefit}
        isOpen={isEditBenefitOpen}
        onClose={() => {
          setIsEditBenefitOpen(false);
          setSelectedBenefit(null);
        }}
        onBenefitUpdated={handleBenefitUpdated}
      />

      {/* Delete Benefit Confirmation Dialog */}
      <DeleteBenefitConfirmationDialog
        benefit={selectedBenefit}
        isOpen={isDeleteBenefitOpen}
        onClose={() => {
          setIsDeleteBenefitOpen(false);
          setSelectedBenefit(null);
        }}
        onConfirm={handleBenefitDeleted}
      />
    </div>
  );
}
