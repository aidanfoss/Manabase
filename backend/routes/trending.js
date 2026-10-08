import express from "express";
import { getEDHRecSuggestions } from "../services/deckUpdater.js";
import { fetchCardData } from "../services/scryfall.js";
import { getRandomCommanderCard, getRandomCards } from "./scryfallLocal.js";

const router = express.Router();

const getFallbackImage = (cardName) => `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&format=image`;

router.get("/random", async (_, res) => {
  try {
    const randomCommanderCard = await getRandomCommanderCard();
    const commanderName = randomCommanderCard?.name || "Atraxa, Praetors' Voice";
    const commanderImage = randomCommanderCard?.image_uris?.normal ||
                           randomCommanderCard?.card_faces?.[0]?.image_uris?.normal ||
                           randomCommanderCard?.image_uris?.small ||
                           getFallbackImage(commanderName);

    const suggestions = await getEDHRecSuggestions(commanderName, []);

    let selectedCards = suggestions.newCards || [];
    if (selectedCards.length < 4) {
      const needed = 4 - selectedCards.length;
      const synergyCards = (suggestions.highSynergy || []).filter(c => !selectedCards.some(sc => sc.name.toLowerCase() === c.name.toLowerCase()));
      selectedCards = [...selectedCards, ...synergyCards.slice(0, needed)];
    }

    if (selectedCards.length < 4) {
      const randomFallback = await getRandomCards(4 - selectedCards.length);
      selectedCards = [...selectedCards, ...randomFallback];
    } else {
      selectedCards = selectedCards.sort(() => 0.5 - Math.random()).slice(0, 4);
    }

    const cardsWithImages = await Promise.all(selectedCards.map(async (card) => {
      const cardData = await fetchCardData(card.name);
      return {
        ...card,
        image: cardData?.image || getFallbackImage(card.name)
      };
    }));

    res.json({
      commander: {
        name: commanderName,
        image: commanderImage
      },
      cards: cardsWithImages
    });
  } catch (error) {
    console.error("Failed to fetch trending:", error);
    res.status(500).json({ error: "Failed to fetch trending data" });
  }
});

export default router;
