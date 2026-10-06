import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

/**
 * Selects the lowest valid numeric price among usd / usd_foil.
 * Prefers nonfoil when equal, ignores invalid or 0 prices.
 */
function pickPrice(p) {
  const usd = Number(p?.usd);
  const foil = Number(p?.usd_foil);
  const prices = [usd, foil].filter(v => !isNaN(v) && v > 0);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  if (!isNaN(usd) && usd === min) return usd;
  return min;
}

/**
 * Fetches card details and printings for a card name.
 */
async function getCheapestFor(name) {
  try {
    const card = await api.getCardDetails(name);
    const prints = Array.isArray(card?.prints) ? card.prints : [];

    const valid = prints
      .map(c => ({ card: c, price: pickPrice(c?.prices || {}) }))
      .filter(e => e.price != null);

    let cheapestCard = card;
    let cheapest = pickPrice(card?.prices || {});

    if (valid.length > 0) {
      valid.sort((a, b) => a.price - b.price);
      cheapestCard = valid[0].card;
      cheapest = valid[0].price;
    }

    return {
      price: cheapest,
      image:
        cheapestCard?.image_uris?.normal ||
        cheapestCard?.image_uris?.large ||
        cheapestCard?.image_uris?.small ||
        card?.image,
      set: cheapestCard?.set_name || cheapestCard?.set,
      all: prints.length > 0 ? prints : [card].filter(Boolean),
    };
  } catch (e) {
    return {
      price: null,
      image: null,
      set: null,
      all: [],
    };
  }
}

/**
 * React hook: fetches card data (staples + sideboard),
 * attaches prices, images, and print info.
 */
export function useCards({ staples = [], sideboard = [] }) {
  const [items, setItems] = useState([]);

  // Merge names and notes
  const list = useMemo(() => {
    const withNotes = new Map(
      sideboard.map(s => [
        typeof s === 'string' ? s : s?.name,
        typeof s === 'string' ? undefined : s?.note,
      ])
    );
    const names = [...new Set([...(staples || []), ...Array.from(withNotes.keys())])];
    return { names, notes: withNotes };
  }, [staples, sideboard]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const results = [];
      for (const name of list.names) {
        try {
          const cheapest = await getCheapestFor(name);
          results.push({
            name,
            note: list.notes.get(name),
            price: cheapest.price,
            image: cheapest.image,
            set: cheapest.set,
            prints: cheapest.all,
          });
        } catch (e) {
          results.push({ name, note: list.notes.get(name), error: String(e) });
        }
      }
      if (alive) setItems(results);
    })();
    return () => {
      alive = false;
    };
  }, [list.names.join('|')]);

  return items;
}
