// Export Prisma types for easy import throughout the app
export type {
  User,
  Player,
  UserCard,
  UserBenefit,
  MasterCard,
  MasterBenefit,
} from '@prisma/client';

// Type definitions for the application
export interface CardWallet {
  id: string;
  playerId: string;
  masterCardId: string;
  customName?: string;
  actualAnnualFee?: number;
  renewalDate: Date;
  isOpen: boolean;
  benefits: BenefitClaim[];
}

export interface BenefitClaim {
  id: string;
  userCardId: string;
  name: string;
  type: 'StatementCredit' | 'UsagePerk';
  stickerValue: number;
  userDeclaredValue?: number;
  resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
  isUsed: boolean;
  timesUsed: number;
  expirationDate?: Date;
}

export interface PlayerWallet {
  id: string;
  playerName: string;
  cards: CardWallet[];
  totalValue: number;
  unclaimedValue: number;
}

export interface MasterCatalog {
  card: {
    issuer: string;
    cardName: string;
    defaultAnnualFee: number;
  };
  benefits: Array<{
    name: string;
    type: 'StatementCredit' | 'UsagePerk';
    stickerValue: number;
    resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
  }>;
}

// Utility types
export type Prisma = typeof import('@prisma/client');
