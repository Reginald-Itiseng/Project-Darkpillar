# Neon Database Integration Guide

## Overview

This application now has full Neon database integration with:
- User authentication (register/login) backed by `neon_auth` schema
- Financial data management (accounts, transactions, budgets, goals) backed by `public` schema
- Row-Level Security (RLS) for data isolation
- Session-based authentication with secure cookies

## Environment Setup

### Required Environment Variables

Set the following variable in both local development (`.env.local`) and Vercel Project Settings:

```
DATABASE_URL=postgresql://user:password@your-neon-host/dbname
```

This is automatically set when Neon integration is connected in Vercel.

For local setup:
1. Copy `.env.example` to `.env.local`
2. Paste your Neon pooled `DATABASE_URL`

## Database Schema

### neon_auth Schema
- `user` - User accounts with clearance levels
- `session` - Active user sessions
- `account` - Password hashes and provider accounts
- `organization`, `member`, `project_config` - Stack Auth tables

### public Schema
- `accounts` - Financial accounts (day-to-day, fixed-deposit)
- `transactions` - Income, expense, and transfer transactions
- `budgets` - Monthly spending budgets by category
- `goals` - Financial goals with targets
- `categories` - Custom transaction categories
- `users` - Deprecated (kept for reference)

All financial tables have RLS enabled and restrict access to the user's own data.

## API Endpoints

### Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/verify
```

### Financial Operations

```
GET    /api/financial/accounts
POST   /api/financial/accounts
PUT    /api/financial/accounts?id=<id>

GET    /api/financial/transactions
POST   /api/financial/transactions

GET    /api/financial/budgets
POST   /api/financial/budgets
PUT    /api/financial/budgets?id=<id>
DELETE /api/financial/budgets?id=<id>

GET    /api/financial/goals
POST   /api/financial/goals
PUT    /api/financial/goals?id=<id>
DELETE /api/financial/goals?id=<id>

GET    /api/financial/categories
POST   /api/financial/categories
```

## Authentication Flow

1. **Register**: User creates account with email, name, and PIN
   - PIN is hashed using PBKDF2
   - User stored in `neon_auth.user`
   - Session token returned

2. **Login**: User authenticates with email and PIN
   - PIN verified against stored hash
   - Session created in `neon_auth.session`
   - Token sent as secure httpOnly cookie

3. **Verify**: Check if session is valid
   - Token verified against database
   - Returns user info if valid

4. **Logout**: Clear session
   - Session token deleted
   - Cookie cleared

## Client-Side Integration

### Using API Storage

```typescript
import * as apiStorage from '@/lib/api-storage'

// Register
const { user, token } = await apiStorage.register(email, name, pin)

// Login
const { user, token } = await apiStorage.login(email, pin)

// Verify session
const user = await apiStorage.verifySession()

// Financial Operations
const accounts = await apiStorage.getAccounts()
const account = await apiStorage.addAccount(accountData)
const updated = await apiStorage.updateAccount(id, updates)

const transactions = await apiStorage.getTransactions()
await apiStorage.addTransaction(transactionData)

const budgets = await apiStorage.getBudgets()
await apiStorage.addBudget(budgetData)
await apiStorage.updateBudget(id, updates)
await apiStorage.deleteBudget(id)

const goals = await apiStorage.getGoals()
await apiStorage.addGoal(goalData)
await apiStorage.updateGoal(id, updates)
await apiStorage.deleteGoal(id)

const categories = await apiStorage.getCategories()
await apiStorage.addCategory(categoryData)
```

## Testing Steps

### 1. Environment Check
- [ ] DATABASE_URL is set in environment variables
- [ ] Neon database is accessible
- [ ] All database tables exist with RLS enabled

### 2. Authentication Flow
- [ ] Register new user works
- [ ] Login with registered user works
- [ ] Session token is stored securely
- [ ] Logout clears session
- [ ] Verify session works after login

### 3. Financial Operations
- [ ] Can create and fetch accounts
- [ ] Can create and fetch transactions
- [ ] Account balance updates with transactions
- [ ] Can create budgets
- [ ] Can create and manage goals
- [ ] Can fetch categories (including defaults)

### 4. RLS Verification
- [ ] User can only see their own data
- [ ] User cannot access other users' data
- [ ] Session user_id is properly set in RLS policies

## Security Considerations

### Current Implementation
- PIN hashing with PBKDF2 (basic, suitable for demo)
- Secure httpOnly cookies for session tokens
- RLS policies for database-level access control
- Session validation on every request

### Production Recommendations
- [ ] Replace PBKDF2 with bcrypt for password hashing
- [ ] Implement rate limiting on auth endpoints
- [ ] Add CSRF protection
- [ ] Use stronger password requirements
- [ ] Implement account lockout after failed attempts
- [ ] Add audit logging
- [ ] Use HTTPS only
- [ ] Consider implementing refresh tokens with rotation

## Troubleshooting

### "DATABASE_URL is not set"
- Check that Neon integration is connected in Vercel
- Verify environment variable is properly set

### "Invalid or expired session"
- User session token may have expired (7 day TTL)
- User needs to re-login
- Clear browser cookies and try again

### "Unauthorized" on API calls
- Verify user is logged in via `/api/auth/verify`
- Check that session token is being sent in request headers
- Ensure session token hasn't expired

### RLS Errors
- Verify `app.user_id` is being set before queries
- Check that RLS policies are enabled on the table
- Verify user ID matches the policies

## Next Steps

1. **Update Dashboard Components**: Modify dashboard pages to use new API storage instead of localStorage
2. **Add Form Validation**: Implement robust form validation for all inputs
3. **Error Handling**: Add proper error boundaries and error messages
4. **Caching Strategy**: Implement client-side caching with SWR
5. **Real-time Updates**: Consider adding webhooks or subscriptions for live updates

## File Structure

```
lib/
  db.ts                 - Connection pool and query helpers
  db-auth.ts            - Authentication database operations
  db-financial.ts       - Financial data database operations
  api-storage.ts        - Client-side API wrapper
  storage.ts            - Original localStorage version (deprecated)
  types.ts              - TypeScript interfaces

app/api/
  auth/
    register/route.ts   - Registration endpoint
    login/route.ts      - Login endpoint
    logout/route.ts     - Logout endpoint
    verify/route.ts     - Session verification endpoint
  financial/
    accounts/route.ts   - Accounts endpoints
    transactions/route.ts - Transactions endpoints
    budgets/route.ts    - Budgets endpoints
    goals/route.ts      - Goals endpoints
    categories/route.ts - Categories endpoints

components/
  auth-guard.tsx        - Protected route wrapper
  terminal-login.tsx    - Login/register UI
```
