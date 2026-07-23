export const MONTHLY_PRICE_CENTS = 19_900
export const SETUP_PRICE_CENTS = 29_900
export const INTRO_DISCOUNT_CENTS = 5_000
export const INTRO_MONTHS = 3

export type LaunchCatalog = {
  monthlyAmount: number | null
  monthlyCurrency: string
  monthlyInterval?: string
  setupAmount: number | null
  setupCurrency: string
  setupRecurring: boolean
  couponDeleted: boolean
  couponAmountOff: number | null
  couponCurrency: string | null
  couponDuration?: string
  couponDurationMonths?: number | null
}

export function launchCatalogMatches(input: LaunchCatalog) {
  return input.monthlyAmount === MONTHLY_PRICE_CENTS &&
    input.monthlyCurrency === "usd" &&
    input.monthlyInterval === "month" &&
    input.setupAmount === SETUP_PRICE_CENTS &&
    input.setupCurrency === "usd" &&
    input.setupRecurring === false &&
    input.couponDeleted === false &&
    input.couponAmountOff === INTRO_DISCOUNT_CENTS &&
    input.couponCurrency === "usd" &&
    input.couponDuration === "repeating" &&
    input.couponDurationMonths === INTRO_MONTHS
}
