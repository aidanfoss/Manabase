// frontend/src/services/moxfieldService.js
export class MoxfieldService {
  /**
   * Extract deck ID from Moxfield URL
   * @param {string} url - Moxfield deck URL
   * @returns {string|null} - Deck ID or null if invalid URL
   */
  static extractDeckId(url) {
    console.log('[MoxfieldService] extractDeckId called with URL:', url);
    try {
      const urlObj = new URL(url);
      console.log('[MoxfieldService] Parsed URL - hostname:', urlObj.hostname, 'pathname:', urlObj.pathname);

      if (!urlObj.hostname.includes('moxfield.com')) {
        console.warn('[MoxfieldService] Invalid hostname, not moxfield.com:', urlObj.hostname);
        return null;
      }

      // Match patterns like /decks/IKbNfhe_sU65t9KBUTq4tQ
      const match = urlObj.pathname.match(/\/decks\/([a-zA-Z0-9_-]+)/);
      if (match) {
        console.log('[MoxfieldService] Successfully extracted deck ID:', match[1]);
        return match[1];
      } else {
        console.warn('[MoxfieldService] No deck ID pattern found in pathname:', urlObj.pathname);
        return null;
      }
    } catch (error) {
      console.error('[MoxfieldService] Error parsing URL:', error.message, 'URL was:', url);
      return null;
    }
  }

  /**
   * Fetch deck data from Moxfield API
   * @param {string} deckId - Moxfield deck ID
   * @returns {Promise<Object>} - Deck data
   */
  static async fetchDeckData(deckId) {
    console.log('[MoxfieldService] fetchDeckData called with deckId:', deckId);
    const apiUrl = `https://api.moxfield.com/v3/decks/all/${deckId}`;
    console.log('[MoxfieldService] Making API request to:', apiUrl);

    try {
      const response = await fetch(apiUrl);
      console.log('[MoxfieldService] API response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('[MoxfieldService] API request failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch deck: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[MoxfieldService] Successfully parsed JSON response');
      console.log('[MoxfieldService] Response structure:');
      console.log('[MoxfieldService] - Has boards:', !!data?.boards);
      console.log('[MoxfieldService] - Has sections:', !!data?.sections);
      console.log('[MoxfieldService] - Response has name:', !!data?.name);

      // Check if the response uses the new 'boards' structure or old 'sections' structure
      if (!data || (!data.boards && !data.sections)) {
        console.error('[MoxfieldService] Invalid deck data - missing boards or sections');
        throw new Error('Invalid deck data received from Moxfield');
      }

      console.log('[MoxfieldService] fetchDeckData completed successfully');
      return data;
    } catch (error) {
      console.error('[MoxfieldService] Error in fetchDeckData:', error.message);
      throw error;
    }
  }

  /**
   * Parse Moxfield deck data into card format compatible with Manabase
   * @param {Object} deckData - Raw deck data from Moxfield API
   * @returns {Array} - Array of card objects
   */
  static parseDeckToCards(deckData) {
    console.log('[MoxfieldService] parseDeckToCards called');

    const cards = [];

    // Handle new 'boards' structure (boards.mainboard.cards, boards.sideboard.cards)
    if (deckData.boards) {
      console.log('[MoxfieldService] Using new boards structure');

      const mainboardCards = deckData.boards.mainboard?.cards || {};
      const sideboardCards = deckData.boards.sideboard?.cards || {};

      console.log('[MoxfieldService] Mainboard cards count:', Object.keys(mainboardCards).length);
      console.log('[MoxfieldService] Sideboard cards count:', Object.keys(sideboardCards).length);

      // Process mainboard cards
      if (Object.keys(mainboardCards).length > 0) {
        console.log('[MoxfieldService] Processing mainboard section');
        const mainCards = this.parseBoardSection(mainboardCards);
        cards.push(...mainCards);
        console.log('[MoxfieldService] Added', mainCards.length, 'main cards');
      }

      // Process sideboard cards (optional)
      if (Object.keys(sideboardCards).length > 0) {
        console.log('[MoxfieldService] Processing sideboard section');
        const sideboardParsedCards = this.parseBoardSection(sideboardCards);
        cards.push(...sideboardParsedCards);
        console.log('[MoxfieldService] Added', sideboardParsedCards.length, 'sideboard cards');
      }
    }
    // Fallback to old 'sections' structure for backward compatibility
    else if (deckData.sections) {
      console.log('[MoxfieldService] Using legacy sections structure');
      console.log('[MoxfieldService] Deck data sections:', Object.keys(deckData.sections));

      const mainCardCount = deckData?.sections?.main ? Object.keys(deckData.sections.main).length : 0;
      const sideboardCardCount = deckData?.sections?.sideboard ? Object.keys(deckData.sections.sideboard).length : 0;

      console.log('[MoxfieldService] Main section cards:', mainCardCount);
      console.log('[MoxfieldService] Sideboard section cards:', sideboardCardCount);

      // Process mainboard cards
      if (deckData.sections.main) {
        console.log('[MoxfieldService] Processing main section');
        const mainCards = this.parseSection(deckData.sections.main);
        cards.push(...mainCards);
        console.log('[MoxfieldService] Added', mainCards.length, 'main cards');
      }

      // Process sideboard cards (optional)
      if (deckData.sections.sideboard) {
        console.log('[MoxfieldService] Processing sideboard section');
        const sideboardCards = this.parseSection(deckData.sections.sideboard);
        cards.push(...sideboardCards);
        console.log('[MoxfieldService] Added', sideboardCards.length, 'sideboard cards');
      }
    } else {
      console.warn('[MoxfieldService] No recognized card structure found in deck data');
    }

    console.log('[MoxfieldService] Total cards parsed:', cards.length);
    return cards;
  }

  /**
   * Parse a section of cards from Moxfield format
   * @param {Object} section - Section data from Moxfield
   * @returns {Array} - Array of card objects
   */
  static parseSection(section) {
    console.log('[MoxfieldService] parseSection called');
    const totalCards = Object.keys(section || {}).length;
    console.log('[MoxfieldService] Section contains', totalCards, 'card entries');

    const cards = [];

    for (const [cardName, cardData] of Object.entries(section)) {
      console.log('[MoxfieldService] Processing card:', cardName, 'with data:', cardData);

      if (cardData && cardData.quantity > 0) {
        const card = {
          name: cardName,
          quantity: cardData.quantity,
          // Moxfield doesn't provide card IDs, we'll need to resolve these later
          // For now, we'll use the card name as identifier
          id: cardName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          // We'll need to fetch additional card data (type, mana cost, etc.) from our backend
        };
        console.log('[MoxfieldService] Created card object:', card);
        cards.push(card);
      } else {
        console.warn('[MoxfieldService] Skipping card due to invalid data:', cardName, cardData);
      }
    }

    console.log('[MoxfieldService] parseSection completed, returning', cards.length, 'cards');
    return cards;
  }

  /**
   * Parse a board section of cards from Moxfield's new format
   * @param {Object} boardSection - Board section data from Moxfield (cards object)
   * @returns {Array} - Array of card objects
   */
  static parseBoardSection(boardSection) {
    console.log('[MoxfieldService] parseBoardSection called');
    const totalCards = Object.keys(boardSection || {}).length;
    console.log('[MoxfieldService] Board section contains', totalCards, 'card entries');

    const cards = [];

    for (const [cardId, cardData] of Object.entries(boardSection)) {
      console.log('[MoxfieldService] Processing board card:', cardId, 'with data:', cardData);

      if (cardData && cardData.quantity > 0 && cardData.card) {
        // In the new format, card name is in cardData.card.name
        const cardName = cardData.card.name;
        console.log('[MoxfieldService] Extracted card name:', cardName);

        const card = {
          name: cardName,
          quantity: cardData.quantity,
          // Use the card's unique ID from Moxfield
          id: cardId,
          // We'll need to fetch additional card data (type, mana cost, etc.) from our backend
        };
        console.log('[MoxfieldService] Created card object:', card);
        cards.push(card);
      } else {
        console.warn('[MoxfieldService] Skipping card due to invalid data:', cardId, cardData);
      }
    }

    console.log('[MoxfieldService] parseBoardSection completed, returning', cards.length, 'cards');
    return cards;
  }

  /**
   * Import a deck from Moxfield URL
   * @param {string} url - Moxfield deck URL
   * @returns {Promise<{name: string, cards: Array}>} - Package data ready for import
   */
  static async importFromUrl(url) {
    console.log('[MoxfieldService] importFromUrl called with URL:', url);

    try {
      const deckId = this.extractDeckId(url);
      if (!deckId) {
        console.error('[MoxfieldService] Failed to extract deck ID from URL');
        throw new Error('Invalid Moxfield URL. Please check the URL and try again.');
      }

      console.log('[MoxfieldService] Successfully extracted deck ID:', deckId);

      const deckData = await this.fetchDeckData(deckId);
      console.log('[MoxfieldService] Successfully fetched deck data');

      // Extract deck name
      const deckName = deckData.name || `Imported Deck ${deckId.substring(0, 8)}`;
      console.log('[MoxfieldService] Using deck name:', deckName);

      // Parse cards
      const cards = this.parseDeckToCards(deckData);
      console.log('[MoxfieldService] Successfully parsed cards, total count:', cards.length);

      if (cards.length === 0) {
        console.error('[MoxfieldService] No cards found in deck after parsing');
        throw new Error('No cards found in the deck. The deck might be empty or private.');
      }

      // Fetch detailed card information for each card to enable printing selection
      console.log('[MoxfieldService] Fetching detailed card information for printing selection');
      const enhancedCards = await this.enhanceCardsWithDetails(cards);
      console.log('[MoxfieldService] Enhanced cards with detailed information:', enhancedCards.length);

      const result = {
        name: deckName,
        cards: enhancedCards
      };

      console.log('[MoxfieldService] importFromUrl completed successfully');
      console.log('[MoxfieldService] Final result - name:', result.name, 'cards:', result.cards.length);

      return result;
    } catch (error) {
      console.error('[MoxfieldService] Error in importFromUrl:', error.message);
      throw error;
    }
  }

  /**
   * Enhance cards with detailed Scryfall information for printing selection
   * @param {Array} cards - Array of basic card objects from Moxfield
   * @returns {Promise<Array>} - Array of enhanced card objects with printing details
   */
  static async enhanceCardsWithDetails(cards) {
    console.log('[MoxfieldService] enhanceCardsWithDetails called with', cards.length, 'cards');

    const enhancedCards = [];
    const uniqueCardNames = [...new Set(cards.map(card => card.name))];
    console.log('[MoxfieldService] Unique card names to fetch:', uniqueCardNames.length);

    // Fetch detailed information for each unique card name
    for (const cardName of uniqueCardNames) {
      try {
        console.log('[MoxfieldService] Fetching details for card:', cardName);

        // Use the backend Scryfall endpoint to get detailed card info
        const response = await fetch(`/api/scryfall/card?name=${encodeURIComponent(cardName)}`);
        if (!response.ok) {
          console.warn('[MoxfieldService] Failed to fetch details for', cardName, ':', response.status);
          continue;
        }

        const cardDetails = await response.json();
        console.log('[MoxfieldService] Successfully fetched details for', cardName);

        // Find all instances of this card in the original cards array
        const cardInstances = cards.filter(card => card.name === cardName);

        // For each instance, create an enhanced version with detailed information
        for (const cardInstance of cardInstances) {
          const enhancedCard = {
            ...cardInstance,
            // Add detailed Scryfall information
            oracle_id: cardDetails.oracle_id,
            type_line: cardDetails.type_line,
            color_identity: cardDetails.color_identity || [],
            set: cardDetails.set,
            collector_number: cardDetails.collector_number,
            image_uris: cardDetails.image_uris,
            scryfall_uri: cardDetails.scryfall_uri,
            prices: cardDetails.prices,
            prints: cardDetails.prints || [],
            // Choose the optimal printing (cheapest non-foil, or most recent if no price)
            selectedPrinting: this.selectOptimalPrinting(cardDetails)
          };

          enhancedCards.push(enhancedCard);
        }
      } catch (error) {
        console.error('[MoxfieldService] Error fetching details for', cardName, ':', error.message);
        // Continue with next card instead of failing completely
      }
    }

    console.log('[MoxfieldService] Enhanced', enhancedCards.length, 'card instances with details');
    return enhancedCards;
  }

  /**
   * Select the optimal printing for a card (cheapest available, otherwise most recent)
   * @param {Object} cardDetails - Detailed card information from Scryfall
   * @returns {Object} - Selected printing information
   */
  static selectOptimalPrinting(cardDetails) {
    console.log('[MoxfieldService] Selecting optimal printing for:', cardDetails.name);

    if (!cardDetails.prints || cardDetails.prints.length === 0) {
      console.log('[MoxfieldService] No prints available, using default');
      return {
        set: cardDetails.set,
        set_name: cardDetails.set_name,
        collector_number: cardDetails.collector_number,
        prices: cardDetails.prices,
        released_at: cardDetails.released_at
      };
    }

    // First, try to find the cheapest printing
    let cheapestPrinting = null;
    let cheapestPrice = Infinity;

    for (const printing of cardDetails.prints) {
      const nonFoilPrice = parseFloat(printing.prices?.usd) || Infinity;
      const foilPrice = parseFloat(printing.prices?.usd_foil) || Infinity;
      const minPrice = Math.min(nonFoilPrice, foilPrice);

      if (minPrice < cheapestPrice && minPrice > 0) {
        cheapestPrice = minPrice;
        cheapestPrinting = printing;
      }
    }

    if (cheapestPrinting) {
      console.log('[MoxfieldService] Selected cheapest printing:', cheapestPrinting.set_name, '($' + cheapestPrice + ')');
      return cheapestPrinting;
    }

    // If no priced printings found, use the most recent
    const sortedPrintings = cardDetails.prints.sort((a, b) =>
      new Date(b.released_at) - new Date(a.released_at)
    );

    console.log('[MoxfieldService] Selected most recent printing:', sortedPrintings[0].set_name);
    return sortedPrintings[0];
  }
}
