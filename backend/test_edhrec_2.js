import { getEDHRecSuggestions } from "./services/deckUpdater.js";

async function test() {
  const commander = "Atraxa, Grand Unifier";
  const deck = ["Birds of Paradise", "Sol Ring"];
  const suggestions = await getEDHRecSuggestions(commander, deck);
  console.log('Suggestions length: ' + (suggestions.highSynergy.length + suggestions.newCards.length));
}

test().catch(console.error);
