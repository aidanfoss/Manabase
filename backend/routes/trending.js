import express from "express";
import { getEDHRecSuggestions } from "../services/deckUpdater.js";
import { fetchCardData } from "../services/scryfall.js";

const router = express.Router();

const POPULAR_COMMANDERS = [
  "Atraxa, Praetors' Voice",
  "The Ur-Dragon",
  "Wilhelt, the Rotcleaver",
  "Prosper, Tome-Bound",
  "Kinnan, Bonder Prodigy",
  "Niv-Mizzet, Parun"
];

const getFallbackImage = (cardName) => `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&format=image`;

router.get("/random", async (_, res) => {
  try {
    const randomCommander = POPULAR_COMMANDERS[Math.floor(Math.random() * POPULAR_COMMANDERS.length)];
    const suggestions = await getEDHRecSuggestions(randomCommander, []);

    let selectedCards = suggestions.newCards;
    if (selectedCards.length < 5) {
      const needed = 5 - selectedCards.length;
      selectedCards = [...selectedCards, ...suggestions.highSynergy.filter((_, i) => i < needed)];
    } else {
      selectedCards = selectedCards.sort(() => 0.5 - Math.random()).slice(0, 5);
    }

    const commanderData = await fetchCardData(randomCommander);
    const commanderImage = commanderData?.image || getFallbackImage(randomCommander);

    const cardsWithImages = await Promise.all(selectedCards.map(async (card) => {
      const cardData = await fetchCardData(card.name);
      return {
        ...card,
        image: cardData?.image || getFallbackImage(card.name)
      };
    }));

    res.json({
      commander: {
        name: randomCommander,
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
