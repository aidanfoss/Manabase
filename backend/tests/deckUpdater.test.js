import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
vi.mock('../db/connection.js', () => ({
  db: {}
}));

import { getEDHRecSuggestions } from '../services/deckUpdater.js';

describe('deckUpdater EDHRec Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should correctly parse "New Cards" and "Top Cards"', async () => {
    const mockEDHRecResponse = {
      data: {
        container: {
          json_dict: {
            cardlists: [
              {
                header: "New Cards",
                cardviews: [
                  { name: "New Card 1", synergy: 0.1, lift: 5.0, url: "/cards/new-1" },
                  { name: "Already In Deck", synergy: 0.2, lift: 6.0, url: "/cards/new-2" }
                ]
              },
              {
                header: "Top Cards",
                cardviews: [
                  { name: "Top Card 1", synergy: 0.5, lift: 8.0, url: "/cards/top-1" },
                  { name: "Already In Deck", synergy: 0.8, lift: 9.0, url: "/cards/top-2" }
                ]
              }
            ]
          }
        }
      }
    };

    axios.get.mockResolvedValue(mockEDHRecResponse);

    const deckCardNames = ["Already In Deck", "Another Card"];
    const result = await getEDHRecSuggestions("Edgar Markov", deckCardNames);

    // Should fetch the correct formatted commander url
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("edgar-markov.json"));

    // Should contain "New Card 1" but not "Already In Deck"
    expect(result.newCards).toHaveLength(1);
    expect(result.newCards[0].name).toBe("New Card 1");

    // Should contain "Top Card 1" but not "Already In Deck"
    expect(result.highSynergy).toHaveLength(1);
    expect(result.highSynergy[0].name).toBe("Top Card 1");
    // Should fallback to synergy
    expect(result.highSynergy[0].synergy).toBe(0.5);
  });

  it('should correctly parse "High Lift Cards" and "High Synergy Cards" if present', async () => {
    const mockEDHRecResponse = {
      data: {
        container: {
          json_dict: {
            cardlists: [
              {
                header: "High Lift Cards",
                cardviews: [
                  { name: "Lift Card 1", synergy: null, lift: 7.0, url: "/cards/lift-1" }
                ]
              },
              {
                header: "High Synergy Cards",
                cardviews: [
                  { name: "Synergy Card 1", synergy: 0.9, lift: 2.0, url: "/cards/sync-1" },
                  { name: "Lift Card 1", synergy: 0.8, lift: 7.0, url: "/cards/lift-1" } // duplicate to check dedup
                ]
              }
            ]
          }
        }
      }
    };

    axios.get.mockResolvedValue(mockEDHRecResponse);

    const result = await getEDHRecSuggestions("Edgar Markov", []);

    expect(result.newCards).toHaveLength(0);
    // Should deduplicate Lift Card 1
    expect(result.highSynergy).toHaveLength(2);

    // Check sorting (descending by synergy/lift).
    // Synergy Card 1 has synergy 0.9.
    // Lift Card 1 from "High Lift Cards" has lift 7.0 (falls back to lift). So 7.0 > 0.9.
    expect(result.highSynergy[0].name).toBe("Lift Card 1");
    expect(result.highSynergy[0].synergy).toBe(7.0);

    expect(result.highSynergy[1].name).toBe("Synergy Card 1");
    expect(result.highSynergy[1].synergy).toBe(0.9);
  });

  it('should safely return empty arrays if API fails', async () => {
    axios.get.mockRejectedValue(new Error("Network Error"));

    const result = await getEDHRecSuggestions("Edgar Markov", []);

    expect(result.newCards).toEqual([]);
    expect(result.highSynergy).toEqual([]);
  });
});