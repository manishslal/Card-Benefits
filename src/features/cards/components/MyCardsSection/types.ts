/**
 * Card data type for the My Cards section
 */
export interface Card {
  id: string;
  userId: string;
  name: string;
  lastFourDigits: string | null;
  cardNetwork: string;
  cardType: 'Credit' | 'Debit' | 'Prepaid';
  isActive: boolean;
  createdAt: string;
  actualAnnualFee?: number | null;  // stored in cents
  renewalDate?: string | null;       // ISO date string
}

/**
 * API response for fetching user cards
 */
export interface FetchCardsResponse {
  success: boolean;
  cards: Card[];
  error?: string;
}

/**
 * API response for updating a card
 */
export interface UpdateCardResponse {
  success: boolean;
  card: Card;
  error?: string;
}

/**
 * API response for deleting a card
 */
export interface DeleteCardResponse {
  success: boolean;
  message: string;
  error?: string;
}
