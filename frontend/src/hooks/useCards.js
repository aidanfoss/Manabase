import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

// Helper: pick the best (lowest non-null) among usd and usd_foil
function pickPrice(p) {
  const nums = [p?.usd, p?.usd_foil].map(v => v == null ? null : Number(v)).filter(v => v != null && !Number.isNaN(v))
  if (nums.length === 0) return null
  return Math.min(...nums)
}

async function getCheapestFor(name) {
  // Try to fetch all prints via search, preferring unique prints
  // We encode query to exact match to avoid commander/funny variants
  const q = `!\"${name}\" unique:prints include:extras`
  try {
    const sr = await api.search(q)
    const prints = Array.isArray(sr?.data) ? sr.data : []
    let cheapest = null, cheapestCard = null
    for (const c of prints) {
      const price = pickPrice(c?.prices || {})
      if (price != null && (cheapest == null || price < cheapest)) {
        cheapest = price
        cheapestCard = c
      }
    }
    if (cheapestCard) {
      return { price: cheapest, image: cheapestCard.image_uris?.normal || cheapestCard.image_uris?.large || cheapestCard.image_uris?.small, set: cheapestCard.set_name, all: prints }
    }
  } catch (e) {
    // fall through to single
  }
  // Fallback: single named print
  const card = await api.getCardByName(name)
  const price = pickPrice(card?.prices || {})
  return { price, image: card?.image_uris?.normal || card?.image_uris?.large || card?.image_uris?.small, set: card?.set_name, all: [card].filter(Boolean) }
}

export function useCards({ staples = [], sideboard = [] }) {
  const [items, setItems] = useState([])
  const list = useMemo(() => {
    const withNotes = new Map(sideboard.map(s => [typeof s === 'string' ? s : s?.name, typeof s === 'string' ? undefined : s?.note]))
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
            prints: cheapest.all
          })
        } catch (e) {
          results.push({ name, note: list.notes.get(name), error: String(e) })
        }
      }
      if (alive) setItems(results)
    })()
    return () => { alive = false }
  }, [list.names.join('|')])

  return items
}
