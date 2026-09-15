export const US_STATES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
] as const

export type ProductCategory = 'checking' | 'savings' | 'credit-card'

export type BankProduct = {
  id: string
  category: ProductCategory
  name: string
  headline: string
  summary: string
  perks: string[]
  checkingName: string
}

export const BANK_PRODUCTS: BankProduct[] = [
  {
    id: 'personal-checking',
    category: 'checking',
    name: 'Personal Checking',
    headline: 'Everyday banking with no monthly fee',
    summary: 'Fee-free personal checking for daily spending, debit, and transfers.',
    perks: ['$0 monthly fee', '55,000+ fee-free ATMs', 'Instant transfers and mobile deposit'],
    checkingName: 'Personal Checking',
  },
  {
    id: 'business-checking',
    category: 'checking',
    name: 'Business Checking',
    headline: 'Built for operators and payroll',
    summary: 'Business checking for deposits, vendors, and operating cash.',
    perks: ['Business debit card', 'ACH and wire ready', 'Separate from personal activity'],
    checkingName: 'Business Checking',
  },
  {
    id: 'high-yield-savings',
    category: 'savings',
    name: 'High-Yield Savings',
    headline: '4.30% APY with no minimum',
    summary: 'The savings account already on Nicolet member dashboards.',
    perks: ['4.30% APY', 'No minimum balance', 'Move money instantly from checking'],
    checkingName: 'Personal Checking',
  },
  {
    id: 'cash-rewards-visa',
    category: 'credit-card',
    name: 'Cash Rewards Visa',
    headline: '3% cash back on everyday spend',
    summary: 'Unlimited cash back on groceries, gas, and streaming.',
    perks: ['3% groceries and gas', '2% dining', '1% everything else'],
    checkingName: 'Personal Checking',
  },
  {
    id: 'travel-rewards-visa',
    category: 'credit-card',
    name: 'Travel Rewards Visa',
    headline: '2x points on travel and dining',
    summary: 'Points for flights, hotels, and restaurants, with no foreign transaction fee.',
    perks: ['2x travel and dining', 'No foreign transaction fee', 'Transfer points to travel partners'],
    checkingName: 'Personal Checking',
  },
]

export function getProduct(id?: string | null) {
  if (!id) return null
  return BANK_PRODUCTS.find((p) => p.id === id) ?? null
}

export function productsByCategory(category: ProductCategory) {
  return BANK_PRODUCTS.filter((p) => p.category === category)
}

export function isValidUsZip(value: string) {
  return /^\d{5}(-\d{4})?$/.test(String(value || '').trim())
}

export function isValidUsState(value: string) {
  const code = String(value || '').trim().toUpperCase()
  return US_STATES.some(([abbr]) => abbr === code)
}
