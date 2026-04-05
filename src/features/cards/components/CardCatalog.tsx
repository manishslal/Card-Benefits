'use client';

import { useEffect, useState } from 'react';

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
  masterBenefits: MasterBenefit[];
}

export function CardCatalog() {
  const [cards, setCards] = useState<MasterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<MasterCard | null>(null);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/cards/master');
        const data = await response.json();
        if (data.success) {
          setCards(data.data);
        }
      } catch (error) {
        console.error('Failed to load cards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading card catalog...</div>;
  }

  if (cards.length === 0) {
    return <div className="text-center py-8">No cards available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="border rounded-lg p-4 hover:shadow-lg cursor-pointer transition-shadow"
            onClick={() => setSelectedCard(card)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg">{card.cardName}</h3>
              <span className="text-xs text-gray-500">{card.issuer}</span>
            </div>
            <div className="text-sm text-gray-600 mb-2">
              Fee: ${(card.defaultAnnualFee / 100).toFixed(2)}/year
            </div>
            <div className="text-xs text-gray-500">
              {card.masterBenefits.length} benefits
            </div>
          </div>
        ))}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedCard.cardName}</h2>
                <p className="text-gray-600">{selectedCard.issuer}</p>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="font-semibold text-lg">
                Annual Fee: ${(selectedCard.defaultAnnualFee / 100).toFixed(2)}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">Key Benefits:</h3>
              <ul className="space-y-2">
                {selectedCard.masterBenefits.map((benefit) => (
                  <li key={benefit.id} className="text-sm border-l-2 border-blue-500 pl-3">
                    <div className="font-medium">{benefit.name}</div>
                    <div className="text-gray-600">
                      Value: ${(benefit.stickerValue / 100).toFixed(2)} • {benefit.resetCadence}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
              Add This Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
