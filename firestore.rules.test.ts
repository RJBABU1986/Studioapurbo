/**
 * Security Rules Specification Verification (Dirty Dozen Test Suite)
 * Run against Firebase Emulator Suite when testing locally with @firebase/rules-unit-testing.
 */

export const DIRTY_DOZEN_CASES = [
  {
    id: 1,
    name: 'Unauthenticated Invoice Read',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv1',
    auth: null,
  },
  {
    id: 2,
    name: 'Cross-User PII Leak',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/customers/cust1',
    auth: { uid: 'u2', email_verified: true },
  },
  {
    id: 3,
    name: 'Unverified Email Spoofing',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices',
    auth: { uid: 'u3', email: 'ranababu9496@gmail.com', email_verified: false },
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Customer',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/customers/cust2',
    payload: { ownerId: 'u1', serialNo: 1, name: 'Test', phone: '01700000000', isAdmin: true },
  },
  {
    id: 5,
    name: 'OwnerId Spoofing on Create',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv2',
    payload: { ownerId: 'u2' },
  },
  {
    id: 6,
    name: 'Oversized ID Poisoning',
    expected: 'PERMISSION_DENIED',
    path: `users/u1/invoices/${'a'.repeat(200)}`,
  },
  {
    id: 7,
    name: 'Client Timestamp Forgery',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/expenses/exp1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    id: 8,
    name: 'Immutable Field Mutation',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv1',
    payload: { ownerId: 'u2' },
  },
  {
    id: 9,
    name: 'Oversized String DoS',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv3',
    payload: { notes: 'x'.repeat(50000) },
  },
  {
    id: 10,
    name: 'Unbounded Array Bomb',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv4',
    payload: { items: Array.from({ length: 50 }, (_, i) => ({ name: `Item ${i}`, qty: 1, rate: 10, total: 10 })) },
  },
  {
    id: 11,
    name: 'Negative Financial Manipulation',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices/inv5',
    payload: { dueAmount: -5000, netTotal: -100 },
  },
  {
    id: 12,
    name: 'Blanket List Query Scraping',
    expected: 'PERMISSION_DENIED',
    path: 'users/u1/invoices',
    auth: { uid: 'u2', email_verified: true },
  },
];
