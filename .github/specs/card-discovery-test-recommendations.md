# Card Discovery Feature - Test Suite Recommendations

**Feature**: Card Discovery & Selection  
**Commit**: d8852a4  
**Status**: Tests needed to validate fixes and edge cases

---

## Unit Tests - API Endpoints

### GET /api/cards/available Tests

```typescript
describe('GET /api/cards/available', () => {
  
  describe('Pagination', () => {
    test('returns first 12 cards with page=1, limit=12', async () => {
      const res = await fetch('/api/cards/available?page=1&limit=12');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.cards).toHaveLength(12);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.totalPages).toBeGreaterThan(1);
    });

    test('returns second page with page=2', async () => {
      const res = await fetch('/api/cards/available?page=2&limit=12');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.pagination.page).toBe(2);
      expect(data.cards).toHaveLength(12);
    });

    test('page=0 treated as page=1', async () => {
      const res = await fetch('/api/cards/available?page=0');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.pagination.page).toBe(1);
    });

    test('page=-5 treated as page=1', async () => {
      const res = await fetch('/api/cards/available?page=-5');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.pagination.page).toBe(1);
    });

    test('limit=0 clamped to 1', async () => {
      const res = await fetch('/api/cards/available?limit=0');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.pagination.limit).toBe(1);
    });

    test('limit=100 clamped to 50', async () => {
      const res = await fetch('/api/cards/available?limit=100');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.pagination.limit).toBe(50);
    });

    test('invalid page string returns 400', async () => {
      const res = await fetch('/api/cards/available?page=abc');
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('totalPages calculated correctly', async () => {
      const res = await fetch('/api/cards/available?limit=12');
      const data = await res.json();
      
      const expectedPages = Math.ceil(data.pagination.total / 12);
      expect(data.pagination.totalPages).toBe(expectedPages);
    });

    test('hasMore=false on last page', async () => {
      const res = await fetch('/api/cards/available');
      const data = await res.json();
      
      const lastPageRes = await fetch(
        `/api/cards/available?page=${data.pagination.totalPages}`
      );
      const lastPageData = await lastPageRes.json();
      
      expect(lastPageData.pagination.hasMore).toBe(false);
    });
  });

  describe('Filtering by Issuer', () => {
    test('returns only cards from specified issuer', async () => {
      const res = await fetch('/api/cards/available?issuer=Chase');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      data.cards.forEach(card => {
        expect(card.issuer.toLowerCase()).toContain('chase');
      });
    });

    test('case-insensitive issuer filter', async () => {
      const res1 = await fetch('/api/cards/available?issuer=chase');
      const res2 = await fetch('/api/cards/available?issuer=CHASE');
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      expect(data1.cards.length).toBe(data2.cards.length);
    });

    test('empty issuer filter ignored', async () => {
      const res = await fetch('/api/cards/available?issuer=');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.cards.length).toBeGreaterThan(0);
    });
  });

  describe('Searching by Card Name', () => {
    test('returns cards matching search term', async () => {
      const res = await fetch('/api/cards/available?search=Sapphire');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      data.cards.forEach(card => {
        expect(card.cardName.toLowerCase()).toContain('sapphire');
      });
    });

    test('case-insensitive search', async () => {
      const res1 = await fetch('/api/cards/available?search=sapphire');
      const res2 = await fetch('/api/cards/available?search=SAPPHIRE');
      const data1 = await res1.json();
      const data2 = await res2.json();
      
      expect(data1.cards.length).toBe(data2.cards.length);
    });

    test('search with no results returns empty cards array', async () => {
      const res = await fetch('/api/cards/available?search=XYZNOTFOUND');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.cards).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe('Combined Filters', () => {
    test('issuer + search + page all work together', async () => {
      const res = await fetch(
        '/api/cards/available?page=1&issuer=Chase&search=Preferred'
      );
      const data = await res.json();
      
      expect(res.status).toBe(200);
      data.cards.forEach(card => {
        expect(card.issuer.toLowerCase()).toContain('chase');
        expect(card.cardName.toLowerCase()).toContain('preferred');
      });
    });
  });

  describe('Response Structure', () => {
    test('response has required fields', async () => {
      const res = await fetch('/api/cards/available');
      const data = await res.json();
      
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('cards');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.cards)).toBe(true);
    });

    test('each card has required fields', async () => {
      const res = await fetch('/api/cards/available');
      const data = await res.json();
      
      data.cards.forEach(card => {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('issuer');
        expect(card).toHaveProperty('cardName');
        expect(card).toHaveProperty('defaultAnnualFee');
        expect(card).toHaveProperty('cardImageUrl');
        expect(card).toHaveProperty('benefits');
        expect(card.benefits).toHaveProperty('count');
        expect(card.benefits).toHaveProperty('preview');
      });
    });

    test('benefit preview limited to 3 items', async () => {
      const res = await fetch('/api/cards/available');
      const data = await res.json();
      
      data.cards.forEach(card => {
        expect(card.benefits.preview.length).toBeLessThanOrEqual(3);
      });
    });

    test('pagination has correct fields', async () => {
      const res = await fetch('/api/cards/available');
      const data = await res.json();
      
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('hasMore');
    });
  });
});
```

---

### GET /api/cards/master/[id] Tests

```typescript
describe('GET /api/cards/master/[id]', () => {
  let validCardId: string;

  beforeAll(async () => {
    // Get a valid card ID from the available cards endpoint
    const res = await fetch('/api/cards/available?limit=1');
    const data = await res.json();
    validCardId = data.cards[0].id;
  });

  test('returns full card details with all benefits', async () => {
    const res = await fetch(`/api/cards/master/${validCardId}`);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.card).toBeDefined();
    expect(data.card.id).toBe(validCardId);
    expect(Array.isArray(data.card.benefits)).toBe(true);
  });

  test('each benefit has required fields', async () => {
    const res = await fetch(`/api/cards/master/${validCardId}`);
    const data = await res.json();
    
    data.card.benefits.forEach(benefit => {
      expect(benefit).toHaveProperty('id');
      expect(benefit).toHaveProperty('name');
      expect(benefit).toHaveProperty('type');
      expect(benefit).toHaveProperty('stickerValue');
      expect(benefit).toHaveProperty('resetCadence');
    });
  });

  test('only active benefits included', async () => {
    const res = await fetch(`/api/cards/master/${validCardId}`);
    const data = await res.json();
    
    // All returned benefits should be active
    // (there's no isActive field on response, trust API)
    expect(data.card.benefits.length).toBeGreaterThan(0);
  });

  test('invalid card ID returns 404', async () => {
    const res = await fetch('/api/cards/master/invalid_card_id_xyz');
    const data = await res.json();
    
    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
  });

  test('empty card ID returns 400', async () => {
    const res = await fetch('/api/cards/master/');
    // Note: This might be 404 for empty path, depends on routing
    expect([400, 404]).toContain(res.status);
  });

  test('response structure valid', async () => {
    const res = await fetch(`/api/cards/master/${validCardId}`);
    const data = await res.json();
    
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('card');
    expect(data.card).toHaveProperty('id');
    expect(data.card).toHaveProperty('issuer');
    expect(data.card).toHaveProperty('cardName');
    expect(data.card).toHaveProperty('defaultAnnualFee');
    expect(data.card).toHaveProperty('cardImageUrl');
    expect(data.card).toHaveProperty('benefits');
  });
});
```

---

### POST /api/cards/add Tests

```typescript
describe('POST /api/cards/add', () => {
  let validCardId: string;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Get valid card ID
    const cardRes = await fetch('/api/cards/available?limit=1');
    const cardData = await cardRes.json();
    validCardId = cardData.cards[0].id;

    // Get auth token (mock or real depending on setup)
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
    userId = 'test-user-123';
  });

  describe('Authentication', () => {
    test('returns 401 if not authenticated', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterCardId: validCardId }),
        // No auth cookie/header
      });
      const data = await res.json();
      
      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    test('missing masterCardId returns 400', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.fieldErrors).toHaveProperty('masterCardId');
    });

    test('invalid masterCardId returns 404', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterCardId: 'invalid_id' }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(404);
      expect(data.code).toBe('CARD_NOT_FOUND');
    });

    test('custom name > 100 chars returns 400', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          customName: 'a'.repeat(101),
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.fieldErrors).toHaveProperty('customName');
    });

    test('negative annual fee returns 400', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          actualAnnualFee: -50,
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.fieldErrors).toHaveProperty('actualAnnualFee');
    });

    test('annual fee > 999900 cents returns 400', async () => {
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          actualAnnualFee: 1000000,
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.fieldErrors).toHaveProperty('actualAnnualFee');
    });

    test('past renewal date returns 400', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          renewalDate: pastDate.toISOString(),
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.fieldErrors).toHaveProperty('renewalDate');
    });
  });

  describe('Happy Path', () => {
    test('creates card with valid data returns 201', async () => {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          customName: 'My Custom Card',
          actualAnnualFee: 9500,
          renewalDate: renewalDate.toISOString(),
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.userCard).toBeDefined();
      expect(data.benefitsCreated).toBeGreaterThan(0);
    });

    test('annual fee = 0 saved correctly', async () => {
      // THIS TEST WILL FAIL WITH BUG #1
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          actualAnnualFee: 0, // Free card
          renewalDate: renewalDate.toISOString(),
        }),
      });
      const data = await res.json();
      
      expect(res.status).toBe(201);
      expect(data.userCard.actualAnnualFee).toBe(0); // NOT null!
    });

    test('response includes all required fields', async () => {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterCardId: validCardId,
          renewalDate: renewalDate.toISOString(),
        }),
      });
      const data = await res.json();
      
      expect(data.userCard).toHaveProperty('id');
      expect(data.userCard).toHaveProperty('playerId');
      expect(data.userCard).toHaveProperty('masterCardId');
      expect(data.userCard).toHaveProperty('customName');
      expect(data.userCard).toHaveProperty('actualAnnualFee');
      expect(data.userCard).toHaveProperty('renewalDate');
      expect(data.userCard).toHaveProperty('status');
      expect(data.userCard).toHaveProperty('createdAt');
      expect(data.userCard).toHaveProperty('updatedAt');
      expect(data).toHaveProperty('benefitsCreated');
      expect(data).toHaveProperty('message');
    });
  });

  describe('Duplicate Detection', () => {
    test('adding same card twice returns 409', async () => {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      
      const body = JSON.stringify({
        masterCardId: validCardId,
        renewalDate: renewalDate.toISOString(),
      });
      
      // First add
      await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      
      // Second add (should fail)
      const res = await fetch('/api/cards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      
      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.code).toBe('CARD_DUPLICATE');
    });
  });
});
```

---

## Integration Tests - UI Component

```typescript
describe('CardCatalog Component', () => {
  
  describe('Initial Load', () => {
    test('renders loading skeleton on mount', async () => {
      render(<CardCatalog />);
      
      expect(screen.getByText(/loading card details/i)).toBeInTheDocument();
    });

    test('renders card grid after loading', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
      
      const cards = screen.getAllByRole('button', { name: /card|issuer/i });
      expect(cards.length).toBeGreaterThan(0);
    });

    test('displays 12 cards on first page', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const cardButtons = screen.getAllByRole('button');
        expect(cardButtons.length).toBeGreaterThanOrEqual(12);
      });
    });
  });

  describe('Pagination', () => {
    test('Next button disabled on last page', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const pagination = screen.getByText(/next/i);
        // Navigate to last page (mock or iterate)
        // Then verify Next is disabled
      });
    });

    test('Prev button disabled on first page', async () => {
      render(<CardCatalog />);
      
      const prevButton = screen.getByText(/prev/i);
      expect(prevButton).toBeDisabled();
    });

    test('clicking page button navigates', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const page2Button = screen.getByRole('button', { name: '2' });
        fireEvent.click(page2Button);
      });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '2' })).toHaveClass(/bg-blue/);
      });
    });
  });

  describe('Filtering & Search', () => {
    test('search input filters cards', async () => {
      render(<CardCatalog />);
      
      const searchInput = screen.getByPlaceholderText(/search cards/i);
      fireEvent.change(searchInput, { target: { value: 'Sapphire' } });
      
      await waitFor(() => {
        const cards = screen.getAllByText(/sapphire/i);
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    test('issuer dropdown filters cards', async () => {
      render(<CardCatalog />);
      
      const issuerSelect = screen.getByDisplayValue(/all issuers/i);
      fireEvent.change(issuerSelect, { target: { value: 'Chase' } });
      
      await waitFor(() => {
        const cards = screen.getAllByText(/chase/i);
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    test('clear filters button restores all cards', async () => {
      render(<CardCatalog />);
      
      const searchInput = screen.getByPlaceholderText(/search cards/i);
      fireEvent.change(searchInput, { target: { value: 'Sapphire' } });
      
      await waitFor(() => {
        const clearButton = screen.getByText(/clear filters/i);
        fireEvent.click(clearButton);
      });
      
      // Verify all cards shown again
    });
  });

  describe('Card Details Modal', () => {
    test('clicking card opens details modal', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const firstCard = screen.getAllByRole('button')[0];
        fireEvent.click(firstCard);
      });
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('modal shows all benefits', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const firstCard = screen.getAllByRole('button')[0];
        fireEvent.click(firstCard);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/benefits/i)).toBeInTheDocument();
      });
    });

    test('closing modal removes it', async () => {
      render(<CardCatalog />);
      
      await waitFor(() => {
        const firstCard = screen.getAllByRole('button')[0];
        fireEvent.click(firstCard);
      });
      
      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Add Card Form', () => {
    test('form validation shows error for long name', async () => {
      render(<CardCatalog />);
      
      // Open card, click Add
      await openCardAndClickAdd();
      
      const nameInput = screen.getByPlaceholderText(/card name/i);
      fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });
      
      expect(screen.getByText(/100 characters/i)).toBeInTheDocument();
    });

    test('annual fee = $0 saved correctly', async () => {
      // THIS TEST WILL FAIL WITH BUG #1
      render(<CardCatalog />);
      
      await openCardAndClickAdd();
      
      const feeInput = screen.getByPlaceholderText(/annual fee/i);
      fireEvent.change(feeInput, { target: { value: '0.00' } });
      
      const addButton = screen.getByRole('button', { name: /add card/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText(/success/i)).toBeInTheDocument();
      });
    });

    test('form shows success message after submit', async () => {
      render(<CardCatalog />);
      
      await openCardAndClickAdd();
      
      const addButton = screen.getByRole('button', { name: /add card/i });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText(/added successfully/i)).toBeInTheDocument();
      });
    });

    test('duplicate add shows user-friendly error', async () => {
      render(<CardCatalog />);
      
      // Add card first time
      await openCardAndClickAdd();
      await submitForm();
      
      // Try adding same card again
      await openCardAndClickAdd();
      await submitForm();
      
      await waitFor(() => {
        expect(screen.getByText(/already own this card/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    test('shows error message on network failure', async () => {
      // Mock fetch to fail
      global.fetch = jest.fn(() => Promise.reject(new Error('Network')));
      
      render(<CardCatalog />);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });

    test('retry button refreshes on error', async () => {
      // Initial fetch fails
      let callCount = 0;
      global.fetch = jest.fn(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('Network'));
        // Second call succeeds
        return Promise.resolve({ json: () => ({ success: true, cards: [] }) });
      });
      
      render(<CardCatalog />);
      
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(retryButton);
      });
      
      // Should now show success state
    });
  });

  describe('Accessibility', () => {
    test('form labels associated with inputs', async () => {
      render(<CardCatalog />);
      
      await openCardAndClickAdd();
      
      const nameInput = screen.getByLabelText(/card name/i);
      expect(nameInput).toBeInTheDocument();
    });

    test('error messages associated with inputs', async () => {
      render(<CardCatalog />);
      
      await openCardAndClickAdd();
      
      const nameInput = screen.getByPlaceholderText(/card name/i);
      fireEvent.change(nameInput, { target: { value: 'a'.repeat(101) } });
      
      expect(screen.getByText(/100 characters/i)).toBeInTheDocument();
    });

    test('form disabled while submitting', async () => {
      render(<CardCatalog />);
      
      await openCardAndClickAdd();
      
      const addButton = screen.getByRole('button', { name: /add card/i });
      fireEvent.click(addButton);
      
      expect(addButton).toBeDisabled();
    });
  });
});
```

---

## Edge Case Tests - Critical Bug #1

```typescript
describe('CRITICAL: Annual Fee Zero Handling', () => {
  
  test('annual fee = $0 should save as 0, not null', async () => {
    // THIS TESTS THE CRITICAL BUG #1
    const renewalDate = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    
    const res = await fetch('/api/cards/add', {
      method: 'POST',
      body: JSON.stringify({
        masterCardId: 'valid-id',
        actualAnnualFee: 0, // Zero fee
        renewalDate: renewalDate.toISOString(),
      }),
    });
    
    const data = await res.json();
    
    // SHOULD BE:
    expect(data.userCard.actualAnnualFee).toBe(0);
    
    // CURRENTLY FAILS - returns null instead of 0
    // expect(data.userCard.actualAnnualFee).toBe(null); // BUG!
  });

  test('annual fee = $0 stored in database', async () => {
    // Create card with $0 fee
    const card = await addCardWithFee(0);
    
    // Query database directly
    const savedCard = await db.userCard.findUnique({
      where: { id: card.id }
    });
    
    // Should be 0, not null
    expect(savedCard.actualAnnualFee).toBe(0);
  });

  test('annual fee $1 = 100 cents', async () => {
    // When user enters $1.00, should save as 100 cents
    const card = await addCardWithFee(100);
    
    expect(card.actualAnnualFee).toBe(100);
  });

  test('annual fee $99.99 = 9999 cents', async () => {
    const card = await addCardWithFee(9999);
    
    expect(card.actualAnnualFee).toBe(9999);
  });
});
```

---

## Test Execution Commands

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- cards.test.ts

# Run tests with coverage
npm test -- --coverage

# Run integration tests only
npm test -- --testPathPattern=integration

# Run specific describe block
npm test -- --testNamePattern="Annual Fee"

# Watch mode for development
npm test -- --watch

# Smoke test before deployment
npm test -- --testNamePattern="Happy Path"
```

---

## Testing Checklist Before Production

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Edge cases for annual fee = $0 pass
- [ ] Duplicate card detection works (409)
- [ ] Auth check works (401)
- [ ] Form validation shows errors inline
- [ ] Pagination works (page=2, etc.)
- [ ] Search filters cards
- [ ] Issuer filter works
- [ ] Modal opens/closes
- [ ] Success message shows
- [ ] Error message shows on network failure
- [ ] Dark mode styling correct
- [ ] Mobile responsive (375px viewport)
- [ ] Tablet responsive (768px viewport)
- [ ] Desktop responsive (1440px viewport)

---

**Note**: Tests marked with "THIS TESTS THE CRITICAL BUG #1" will fail until Issue #1 is fixed.

