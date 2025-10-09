import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

/**
 * Selects the lowest valid numeric price among usd / usd_foil.
 * Prefers nonfoil when equal, ignores invalid or 0 prices.
 */
function pickPrice(p) {
  const usd = Number(p?.usd)
  const foil = Number(p?.usd_foil)
  const prices = [usd, foil].filter(v => !isNaN(v) && v > 0)
  if (!prices.length) return null
  const min = Math.min(...prices)
  if (!isNaN(usd) && usd === min) return usd
  return min
}

/**
 * Fetches all unique printings for a card and finds the cheapest valid one.
 * Falls back to a single card lookup if no valid prices found.
 */
async function getCheapestFor(name) {
  const q = `!"${name}" unique:prints include:extras`
  try {
    const sr = await api.search(q)
    const prints = Array.isArray(sr?.data) ? sr.data : []

    // Collect valid prices only
    const valid = prints
      .map(c => ({ card: c, price: pickPrice(c?.prices || {}) }))
      .filter(e => e.price != null)

    let cheapestCard = null
    let cheapest = null

    if (valid.length > 0) {
      valid.sort((a, b) => a.price - b.price)
      cheapestCard = valid[0].card
      cheapest = valid[0].price
    }

    // ✅ fallback: no valid prices at all
    if (!cheapestCard) {
      const card = await api.getCardByName(name)
      const price = pickPrice(card?.prices || {})
      return {
        price: price ?? null,
        image:
          card?.image_uris?.normal ||
          card?.image_uris?.large ||
          card?.image_uris?.small,
        set: card?.set_name,
        all: [card].filter(Boolean),
      }
    }

    // ✅ normal return: cheapest valid printing
    return {
      price: cheapest,
      image:
        cheapestCard.image_uris?.normal ||
        cheapestCard.image_uris?.large ||
        cheapestCard.image_uris?.small,
      set: cheapestCard.set_name,
      all: prints,
    }
  } catch (e) {
    // Fallback on any API failure
    const card = await api.getCardByName(name)
    const price = pickPrice(card?.prices || {})
    return {
      price: price ?? null,
      image:
        card?.image_uris?.normal ||
        card?.image_uris?.large ||
        card?.image_uris?.small,
      set: card?.set_name,
      all: [card].filter(Boolean),
    }
  }
}

/**
 * React hook: fetches card data (staples + sideboard),
 * attaches prices, images, and print info.
 */
export function useCards({ staples = [], sideboard = [] }) {
  const [items, setItems] = useState([])

  // Merge names and notes
  const list = useMemo(() => {
    const withNotes = new Map(
      sideboard.map(s => [
        typeof s === 'string' ? s : s?.name,
        typeof s === 'string' ? undefined : s?.note,
      ])
    )
    const names = [...new Set([...(staples || []), ...Array.from(withNotes.keys())])]
    return { names, notes: withNotes }
  }, [staples, sideboard])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const results = []
      for (const name of list.names) {
        try {
          const cheapest = await getCheapestFor(name)
          results.push({
            name,
            note: list.notes.get(name),
            price: cheapest.price,
            image: cheapest.image,
            set: cheapest.set,
            prints: cheapest.all,
          })
        } catch (e) {
          results.push({ name, note: list.notes.get(name), error: String(e) })
        }
      }
      if (alive) setItems(results)
    })()
    return () => {
      alive = false
    }
  }, [list.names.join('|')])

  return items
}
