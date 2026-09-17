/** Stable, Luhn-valid Visa or Mastercard credit PAN unique to each member + product. */

const VISA_BIN = '414720'
const MASTERCARD_BIN = '542418'

function hashSeed(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function luhnCheckDigit(body: string) {
  let sum = 0
  let dbl = true
  for (let i = body.length - 1; i >= 0; i--) {
    let n = Number(body[i])
    if (dbl) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    dbl = !dbl
  }
  return String((10 - (sum % 10)) % 10)
}

export type CardNetwork = 'visa' | 'mastercard'

export function networkForProduct(productId?: string | null, productName?: string | null): CardNetwork {
  const id = String(productId || '').toLowerCase()
  const name = String(productName || '').toLowerCase()
  if (id.includes('travel') || name.includes('travel') || name.includes('mastercard')) {
    return 'mastercard'
  }
  return 'visa'
}

export function issueCreditCard(
  userId: string,
  opts?: { productId?: string | null; productName?: string | null; network?: CardNetwork }
) {
  const network = opts?.network || networkForProduct(opts?.productId, opts?.productName)
  const bin = network === 'mastercard' ? MASTERCARD_BIN : VISA_BIN
  const h = hashSeed(`apex-credit:${network}:${userId}:${opts?.productId || ''}`)
  const accountPart = String(h).padStart(9, '0').slice(-9)
  const body = `${bin}${accountPart}`
  const pan = body + luhnCheckDigit(body)
  const cvv = String((h % 900) + 100)
  const expMonth = String((h % 12) + 1).padStart(2, '0')
  const expYear = String(28 + (h % 4))

  return {
    network,
    networkLabel: network === 'mastercard' ? 'Mastercard' : 'Visa',
    pan,
    formatted: pan.replace(/(\d{4})(?=\d)/g, '$1 '),
    last4: pan.slice(-4),
    cvv,
    exp: `${expMonth}/${expYear}`,
  }
}
