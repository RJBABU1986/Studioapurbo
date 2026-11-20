# Security Specification: Opoorbo Digital Studio (অপূর্ব ডিজিটাল ষ্টুডিও)

## 1. Data Invariants
1. **Strict Tenant & PII Isolation**: All studio settings, customer phone numbers, invoices, and monthly expense records live under `/users/{userId}/...` and are readable/writable ONLY by the authenticated owner (`request.auth.uid == userId` with verified email or verified phone number) or verified system admin (`ranababu9496@gmail.com` with `email_verified == true`).
2. **Identity Integrity**: Every document MUST carry `ownerId == userId` and `ownerId == request.auth.uid` on creation, and `ownerId` is immutable on updates.
3. **Referential & Financial Integrity**:
   - An invoice cannot be created with negative totals, negative paid/due amounts, or without a valid `customerId` that exists (or is created atomically in the same batch via `existsAfter`).
   - An invoice's `items` array MUST contain between 1 and 25 items.
   - Invoice `status` (`paid` | `partial` | `due`) cannot skip validation or become corrupted; once `status == 'paid'` and `dueAmount == 0`, financial amounts cannot be tampered with arbitrarily except for recording Drive/WhatsApp metadata or admin correction.
4. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` on creation, and `createdAt` is immutable on update while `updatedAt == request.time`.
5. **Path Hardening & Resource Bounds**: All document IDs (`userId`, `customerId`, `invoiceId`, `expenseId`, `settingId`) must match `^[a-zA-Z0-9_\\-]+$` and stay `<= 128` characters. Every string field enforces strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Invoice Read**: Unauthenticated client requests `get(/users/u1/invoices/inv1)` -> `PERMISSION_DENIED`.
2. **Cross-User PII Leak**: User `u2` requests `get(/users/u1/customers/cust1)` -> `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: User with `email: 'ranababu9496@gmail.com'` and `email_verified: false` tries to list `/users/u1/invoices` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Customer**: Owner creates customer with extra `isAdmin: true` field -> `PERMISSION_DENIED` (`hasOnly` rejection).
5. **OwnerId Spoofing on Create**: User `u1` creates invoice under `/users/u1/invoices/inv1` with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
6. **Oversized ID Poisoning**: User `u1` creates invoice with 500-char ID or invalid characters `inv/../../x` -> `PERMISSION_DENIED` (`isValidId`).
7. **Client Timestamp Forgery**: User `u1` creates expense with `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: User `u1` updates invoice attempting to change `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
9. **Oversized String DoS**: User `u1` creates invoice with 50,000-character `notes` -> `PERMISSION_DENIED` (`size() <= 500`).
10. **Unbounded Array Bomb**: User `u1` creates invoice with 100 line items in `items` -> `PERMISSION_DENIED` (`size() <= 25`).
11. **Negative Financial Manipulation**: User `u1` creates invoice with `dueAmount: -5000` or `netTotal: -100` -> `PERMISSION_DENIED`.
12. **Blanket List Query Scraping**: User `u2` runs `collectionGroup('invoices')` or `list(/users/u1/invoices)` -> `PERMISSION_DENIED` (`resource.data.ownerId == request.auth.uid`).
