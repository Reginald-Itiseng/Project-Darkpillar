import type { Account } from './types'

export type InstitutionCategory = 'bank' | 'mobile-money' | 'other'

export interface AccountProductOption {
  name: string
  group: string
  suggestedType: Account['type']
}

export interface Institution {
  id: string
  name: string
  category: InstitutionCategory
  products: AccountProductOption[]
}

// Real-world account products, sourced from each provider's own site, so the
// account creation form can guide the user instead of asking for a free-text
// bank name. `suggestedType` only pre-selects this app's internal
// day-to-day / savings-pocket / fixed-deposit type -- it never overrides it,
// since that's what actually drives balance and interest behaviour.
export const ACCOUNT_INSTITUTIONS: Institution[] = [
  {
    id: 'fnb',
    name: 'FNB',
    category: 'bank',
    products: [
      { name: 'Gold Cheque Account', group: 'Cheque Accounts', suggestedType: 'day-to-day' },
      { name: 'Premier Account', group: 'Cheque Accounts', suggestedType: 'day-to-day' },
      { name: 'Smart Account', group: 'Transactional Accounts', suggestedType: 'day-to-day' },
      { name: 'Future Forward Account', group: 'Transactional Accounts', suggestedType: 'day-to-day' },
      { name: 'Digiplus Account', group: 'Transactional Accounts', suggestedType: 'day-to-day' },
      { name: 'FNBy Account (0-17)', group: 'Youth & Student Accounts', suggestedType: 'day-to-day' },
      { name: 'FNBy Next Account (18-24)', group: 'Youth & Student Accounts', suggestedType: 'day-to-day' },
      { name: 'Student Account', group: 'Youth & Student Accounts', suggestedType: 'day-to-day' },
      { name: 'Savings Pocket', group: 'Savings', suggestedType: 'savings-pocket' },
      { name: 'Future Save Account', group: 'Savings', suggestedType: 'savings-pocket' },
      { name: 'Poloko Savings Account', group: 'Savings', suggestedType: 'savings-pocket' },
      { name: 'Flexi Fixed Deposit', group: 'Save & Invest', suggestedType: 'fixed-deposit' },
      { name: 'Notice Deposit', group: 'Save & Invest', suggestedType: 'fixed-deposit' },
    ],
  },
  {
    id: 'orange-botswana',
    name: 'Orange Botswana',
    category: 'mobile-money',
    products: [{ name: 'Orange Money', group: 'Mobile Money', suggestedType: 'day-to-day' }],
  },
  {
    id: 'mascom',
    name: 'Mascom',
    category: 'mobile-money',
    products: [{ name: 'MyZaka', group: 'Mobile Money', suggestedType: 'day-to-day' }],
  },
  {
    id: 'btc',
    name: 'BTC',
    category: 'mobile-money',
    products: [{ name: 'Smega', group: 'Mobile Money', suggestedType: 'day-to-day' }],
  },
  {
    id: 'other',
    name: 'Other / Cash',
    category: 'other',
    products: [{ name: 'Other', group: 'Other', suggestedType: 'day-to-day' }],
  },
]

export function getInstitution(id: string): Institution | undefined {
  return ACCOUNT_INSTITUTIONS.find((institution) => institution.id === id)
}

export function getProduct(institutionId: string, productName: string): AccountProductOption | undefined {
  return getInstitution(institutionId)?.products.find((product) => product.name === productName)
}
