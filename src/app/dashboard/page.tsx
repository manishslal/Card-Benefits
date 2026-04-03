'use client';

import React from 'react';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import Link from 'next/link';
import { CreditCard, Settings, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const mockCards = [
    { id: '1', name: 'Chase Sapphire', type: 'visa' as const, lastFour: '4242', issuer: 'Chase' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{backgroundColor: 'var(--color-bg)', color: 'var(--color-text)'}}>
      <header style={{backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)'}} className="border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-center justify-between mb-8">
            <Link href="/dashboard" className="flex items-center gap-3 no-underline">
              <CreditCard size={24} />
              <h1 className="text-2xl font-bold">CardTrack</h1>
            </Link>
            <div className="flex items-center gap-3">
              <SafeDarkModeToggle />
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings size={16} className="mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
          <div>
            <h2 className="font-semibold" style={{ fontSize: 'var(--text-h4)' }}>
              Welcome, John! 👋
            </h2>
            <p className="text-sm mt-1" style={{color: 'var(--color-text-secondary)'}}>
              You have {mockCards.length} cards and benefits tracked
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Your Credit Cards</h3>
            <div className="grid gap-4">
              {mockCards.map((card) => (
                <div
                  key={card.id}
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>
                        •••• {card.lastFour}
                      </p>
                    </div>
                    <Link href={`/card/${card.id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="primary" size="md" className="mt-4">
              <Plus size={16} className="mr-2" />
              Add Card
            </Button>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-4">Benefits Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border" style={{backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)'}}>
                <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>Active Benefits</p>
                <p className="text-2xl font-bold">12</p>
              </div>
              <div className="p-4 rounded-lg border" style={{backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)'}}>
                <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>Expiring Soon</p>
                <p className="text-2xl font-bold">3</p>
              </div>
              <div className="p-4 rounded-lg border" style={{backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)'}}>
                <p className="text-sm" style={{color: 'var(--color-text-secondary)'}}>Total Value</p>
                <p className="text-2xl font-bold">$2.4K</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
