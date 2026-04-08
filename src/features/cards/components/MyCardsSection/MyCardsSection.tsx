'use client';

import React, { useState, useEffect } from 'react';
import { CardItemCard } from './CardItemCard';
import { CardEditModal } from './CardEditModal';
import { CardDeleteConfirmation } from './CardDeleteConfirmation';
import { Card, FetchCardsResponse, DeleteCardResponse } from './types';
import EmptyState from '@/shared/components/ui/EmptyState';
import { SkeletonCard } from '@/shared/components/loaders';

interface MyCardsSectionProps {
  // Currently no props needed - userId is fetched from API context
}

/**
 * MyCardsSection Component
 *
 * Main container for card management in Settings > Profile.
 * Features:
 * - Fetch and display user's cards
 * - Grid layout: 1 col mobile, 2+ cols tablet/desktop
 * - Edit card via modal
 * - Delete card with confirmation
 * - Loading skeleton states
 * - Error handling with retry
 * - Empty state when no cards
 * - Dark mode support
 * - Accessibility: ARIA labels, keyboard navigation
 */
export function MyCardsSection({}: MyCardsSectionProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<Card | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [selectedCardForDelete, setSelectedCardForDelete] = useState<Card | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  // Load cards on mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cards/my-cards', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load cards');
      }

      const data: FetchCardsResponse = await response.json();

      if (data.success && Array.isArray(data.cards)) {
        setCards(data.cards);
      } else {
        throw new Error(data.error || 'Failed to load cards');
      }
    } catch (err) {
      console.error('Error loading cards:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load cards. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCard = (card: Card) => {
    setSelectedCardForEdit(card);
    setIsEditModalOpen(true);
  };

  const handleCardUpdated = (updatedCard: Card) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === updatedCard.id ? updatedCard : card
      )
    );
    setIsEditModalOpen(false);
    setSelectedCardForEdit(null);
  };

  const handleDeleteCard = (card: Card) => {
    setSelectedCardForDelete(card);
    setIsDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCardForDelete) return;

    try {
      const response = await fetch(`/api/cards/${selectedCardForDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data: DeleteCardResponse = await response.json();
        throw new Error(data.error || 'Failed to delete card');
      }

      // Remove card from list
      setCards((prev) =>
        prev.filter((card) => card.id !== selectedCardForDelete.id)
      );
      setIsDeleteConfirmationOpen(false);
      setSelectedCardForDelete(null);
    } catch (err) {
      throw err;
    }
  };

  // Render loading skeletons
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2
          className="text-xl font-bold mb-4"
          style={{ color: 'var(--color-text)' }}
        >
          My Cards
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Render error state with retry button
  if (error && cards.length === 0) {
    return (
      <div className="mb-8">
        <h2
          className="text-xl font-bold mb-4"
          style={{ color: 'var(--color-text)' }}
        >
          My Cards
        </h2>
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: 'var(--color-error-light)',
            color: 'var(--color-error)',
          }}
        >
          <p className="text-sm font-medium mb-3">{error}</p>
          <button
            onClick={loadCards}
            className="text-sm font-medium underline hover:no-underline"
            style={{
              color: 'var(--color-error-dark)',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Render empty state
  if (cards.length === 0) {
    return (
      <div className="mb-8">
        <h2
          className="text-xl font-bold mb-4"
          style={{ color: 'var(--color-text)' }}
        >
          My Cards
        </h2>
        <EmptyState
          title="No cards yet"
          description="Add a card to get started"
          icon="CreditCard"
        />
      </div>
    );
  }

  // Render cards grid
  return (
    <div className="mb-8">
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: 'var(--color-text)' }}
      >
        My Cards
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <CardItemCard
            key={card.id}
            card={card}
            onEdit={handleEditCard}
            onDelete={handleDeleteCard}
          />
        ))}
      </div>

      {/* Modals */}
      <CardEditModal
        card={selectedCardForEdit}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedCardForEdit(null);
        }}
        onCardUpdated={handleCardUpdated}
      />

      <CardDeleteConfirmation
        card={selectedCardForDelete}
        isOpen={isDeleteConfirmationOpen}
        onClose={() => {
          setIsDeleteConfirmationOpen(false);
          setSelectedCardForDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
