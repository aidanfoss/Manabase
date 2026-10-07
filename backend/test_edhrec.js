import { getEDHRecSuggestions } from "./services/deckUpdater.js";

async function test() {
  const commander = "Atraxa, Praetors' Voice";
  const deck = ["Birds of Paradise", "Sol Ring"];
  const suggestions = await getEDHRecSuggestions(commander, deck);
  console.log(JSON.stringify(suggestions, null, 2));
}

test().catch(console.error);
