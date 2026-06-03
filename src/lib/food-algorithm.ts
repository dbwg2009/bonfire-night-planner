import type { Guest, FoodCalculation } from './types'

/**
 * Smart food quantity calculator.
 *
 * Strategy:
 * - Guests with a single preference (burger-only or sausage-only) are counted at 100%.
 * - Guests who want both are counted at `splitRatio` (default 0.6) per item, reflecting that
 *   at outdoor events most "both" guests eat both, but some don't finish both.
 * - A buffer factor (default 1.1 = 10%) is added for waste, unexpected guests, and seconds.
 * - Bread products match the food quantities exactly.
 */
export function calculateFood(
  guests: Guest[],
  splitRatio = 0.6,
  bufferFactor = 1.1
): FoodCalculation {
  const accepted = guests.filter(g => g.rsvp_status === 'accepted')

  const burgerOnly = accepted.filter(
    g => g.dietary.includes('burger') && !g.dietary.includes('sausage')
  )
  const sausageOnly = accepted.filter(
    g => g.dietary.includes('sausage') && !g.dietary.includes('burger')
  )
  const both = accepted.filter(
    g => g.dietary.includes('burger') && g.dietary.includes('sausage')
  )
  const neither = accepted.filter(g => g.dietary.length === 0)

  // Core demand calculation
  const rawBurgers = burgerOnly.length + both.length * splitRatio
  const rawSausages = sausageOnly.length + both.length * splitRatio

  // Apply buffer and round up
  const buyBurgers = Math.ceil(rawBurgers * bufferFactor)
  const buySausages = Math.ceil(rawSausages * bufferFactor)

  return {
    burger_only_count: burgerOnly.length,
    sausage_only_count: sausageOnly.length,
    both_count: both.length,
    neither_count: neither.length,
    recommended_burgers: Math.round(rawBurgers),
    recommended_sausages: Math.round(rawSausages),
    buy_burgers: buyBurgers,
    buy_sausages: buySausages,
    buy_burger_buns: buyBurgers,
    buy_hot_dog_buns: buySausages,
    total_bread_products: buyBurgers + buySausages,
    split_ratio: splitRatio,
    buffer_factor: bufferFactor
  }
}

export function generateShoppingListWhatsApp(calc: FoodCalculation, eventName: string): string {
  const lines = [
    `🔥 *${eventName} — Food Shopping List*`,
    '',
    '*Quantities to buy:*',
    `🍔 Burgers: *${calc.buy_burgers}*`,
    `🌭 Sausages: *${calc.buy_sausages}*`,
    `🍞 Burger buns: *${calc.buy_burger_buns}*`,
    `🌭 Hot dog buns: *${calc.buy_hot_dog_buns}*`,
    '',
    '*Based on:*',
    `• ${calc.burger_only_count} burger only`,
    `• ${calc.sausage_only_count} sausage only`,
    `• ${calc.both_count} wanting both`,
    `• ${calc.neither_count} having nothing`,
    '',
    `_Includes ${Math.round((calc.buffer_factor - 1) * 100)}% buffer for waste_`
  ]
  return lines.join('\n')
}
