import { db } from '@/lib/db'
import { transaction } from '@/lib/db/schema'
import { and, eq, like } from 'drizzle-orm'

const RENAMES: Array<[string, string, string]> = [
  ['WIRE FROM CORPORATE CLIENT', 'WIRE RITZ CARLTON NAPLES', 'The Ritz-Carlton Naples'],
  ['CATERING DEPOSIT FIFTH AVE', 'ACH ARTIS NAPLES EVENTS', 'Artis Naples'],
  ['ACH CREDIT VENDOR REBATE', 'ACH SYSCO FOODS REBATE', 'Sysco Foods'],
  ['Zelle banquet client Naples', 'ACH HILTON NAPLES BANQUET', 'Hilton Naples'],
  ['MOBILE CHECK DEPOSIT', 'CHECK DEP NAPLES GRANDE', 'Naples Grande Beach Resort'],
  ['STRIPE PAYOUT CATERING', 'STRIPE TRANSFER NAPLES CATERING', 'Stripe'],
  ['SQUARE INC PAYOUT', 'SQUARE INC PAYOUT NAPLES FL', 'Square'],
  ['WELLS FARGO HOME MORTGAGE', 'COLLIERS NAPLES RETAIL LEASE', 'Colliers Naples'],
  ['STATE FARM INSURANCE', 'STATE FARM BUSINESS INS', 'State Farm'],
  ['PROGRESSIVE INSURANCE', 'PROGRESSIVE COMMERCIAL FL', 'Progressive'],
  ['NETFLIX.COM', 'COMCAST BUSINESS NAPLES', 'Comcast Business'],
  ['APPLE.COM/BILL', 'TOAST TAB SUBSCRIPTION', 'Toast'],
  ['STARBUCKS', 'SYSCO FOODS NAPLES FL', 'Sysco Foods'],
  ['CHIPOTLE', 'RESTAURANT DEPOT NAPLES', 'Restaurant Depot'],
  ['UBER TRIP', 'FEDEX COMMERCIAL NAPLES', 'FedEx'],
  ['WALMART', 'GORDON FOOD SERVICE FL', 'Gordon Food Service'],
  ['PUBLIX', 'FRESHPOINT PRODUCE TAMPA', 'FreshPoint'],
  ['COSTCO WHSE', 'US FOODS TAMPA FL', 'US Foods'],
  ['SHELL OIL', 'FPL COMMERCIAL NAPLES', 'FPL'],
  ['CAMPIELLO RISTORANTE NAPLES', 'NAPLES PAPER AND CHEM', 'Naples Paper'],
  ['THE BAY HOUSE NAPLES FL', 'CITY OF NAPLES UTILITIES', 'City of Naples'],
  ['BLEU PROVENCE NAPLES FL', 'NAPLES DAILY NEWS ADS', 'Naples Daily News'],
  ['DORONA STEAK NAPLES FL', 'GOOGLE ADS LLC', 'Google Ads'],
  ['USS NEMO NAPLES FL', 'META PLATFORMS ADS', 'Meta Ads'],
  ['BARBATELLA 5TH AVE NAPLES', 'YELP ADVERTISING', 'Yelp'],
  ['THE CONTINENTAL NAPLES', 'NAPLES CHAMBER OF COMMERCE', 'Naples Chamber'],
  ['OCEAN PRIME NAPLES', 'SHERWIN WILLIAMS NAPLES', 'Sherwin Williams'],
  ['BONEFISH GRILL NAPLES', 'NAPLES ACE HARDWARE COMM', 'Ace Hardware'],
  ['SEASONS 52 NAPLES', 'FORT MYERS GAS CO', 'Florida City Gas'],
]

export async function relabelJimmyMerchants(userId: string) {
  for (const [from, to, counterparty] of RENAMES) {
    await db
      .update(transaction)
      .set({ description: to, counterparty })
      .where(and(eq(transaction.userId, userId), like(transaction.description, `%${from}%`)))
  }
}
