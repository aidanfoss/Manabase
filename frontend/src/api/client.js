// frontend/src/api/client.js
const BASE = "/api";

const batchCache = {};
const inflightBatch = {};

export const api = {
  // ---------------------------------------
  // Generic JSON fetcher
  // ---------------------------------------
  async json(path, options = {}) {
    const url = `${BASE}${path}`;
    const token = localStorage.getItem("token");

    const method = options.method || "GET";
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    console.log(`🌐 [API Request] ${method} ${url}`, options.body ? JSON.parse(options.body) : "");

    const response = await fetch(url, {
      method,
      headers,
      body: options.body,
    });

    if (!response.ok) {
      console.error(`❌ [API Error] ${method} ${url} status: ${response.status}`);
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    const data = text ? JSON.parse(text.replace(/^\uFEFF/, "")) : {};
    console.log(`✅ [API Response] ${method} ${url}`, Array.isArray(data) ? `Array(${data.length})` : typeof data === "object" ? `Keys: [${Object.keys(data).join(", ")}]` : data);
    return data;
  },

  // ---------------------------------------
  // Generic POST
  // ---------------------------------------
  async post(path, body, headers = {}) {
    return api.json(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  },

  // ---------------------------------------
  // === App data endpoints ===
  // ---------------------------------------
  getMetas: () => api.json("/packages"), // for backwards safety
  getPackages: () => api.json("/packages"),
  getLandcycles: () => api.json("/landcycles"),
  // Presets
  getPresets: (colors) => {
    const params = new URLSearchParams();
    if (colors && colors.length > 0) {
      colors.forEach(color => params.append('colors', color));
    } else {
      params.append('colors', 'colorless');
    }
    return api.json(`/presets?${params.toString()}`);
  },
  applyPreset: (presetId) => api.json(`/presets/${presetId}/apply`, { method: "POST" }),
  getLandcyclePresets: (packages, landcycles, colors) => {
    const params = new URLSearchParams();
    if (packages) params.append('packages', packages);
    if (landcycles) params.append('landcycles', landcycles);
    if (colors) params.append('colors', colors);
    return api.json(`/presets?${params.toString()}`);
  },
  getPreset: (id) => api.json(`/presets/${id}`),
  savePreset: (presetData) => api.post("/presets", presetData),
  updatePreset: (id, presetData) => api.json(`/presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(presetData),
  }),
  deletePreset: (presetId) => api.json(`/presets/${presetId}`, { method: "DELETE" }),

  getCards: ({ packages = [], landcycles = [], colors = [] }) => {
    const q = new URLSearchParams();
    packages.forEach((m) => q.append("packages", m));
    landcycles.forEach((l) => q.append("landcycles", l));
    colors.forEach((c) => q.append("colors", c));
    return api.json(`/cards?${q.toString()}`);
  },

  // ---------------------------------------
  // === Auth ===
  // ---------------------------------------
  login: (credentials) => api.post("/auth/login", credentials),
  register: (credentials) => api.post("/auth/register", credentials),
  getAuthProviders: () => api.json("/auth/providers"),
  loginWithGoogle: (payload = {}) => api.post("/auth/google", payload),
  loginWithDiscord: (payload = {}) => api.post("/auth/discord", payload),

  // ---------------------------------------
  // === Packages ===
  // ---------------------------------------
  savePackage: (data) => {
    if (data.id) {
      // Update existing
      return api.json(`/packages/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    } else {
      // Create new
      return api.post("/packages", data);
    }
  },
  deletePackage: (id) =>
    api.json(`/packages/${id}`, {
      method: "DELETE",
    }),
  importFromMoxfield: (url) =>
    api.post("/packages/import/moxfield", { url }),

  // ---------------------------------------
  // === Scryfall Proxy ===
  // (calls your backend route, not Scryfall directly)
  // ---------------------------------------
  getCardSearch: (query) => api.json(`/scryfall?q=${encodeURIComponent(query)}`),
  getCardDetails: (name) => api.json(`/scryfall/card?name=${encodeURIComponent(name)}`),
  getCardDetailsBatch: async (names) => {
    const missingNames = names.filter((n) => !batchCache[n]);
    const namesToFetch = missingNames.filter((n) => !inflightBatch[n]);

    if (namesToFetch.length > 0) {
      const fetchPromise = api.post(`/scryfall/batch`, { names: namesToFetch }).then((res) => {
        Object.keys(res).forEach((k) => {
          batchCache[k] = res[k];
        });
        return res;
      }).finally(() => {
        namesToFetch.forEach((n) => {
          delete inflightBatch[n];
        });
      });

      namesToFetch.forEach((n) => {
        inflightBatch[n] = fetchPromise;
      });
    }

    const promises = missingNames.map((n) => inflightBatch[n]).filter(Boolean);
    if (promises.length > 0) {
      await Promise.all(promises);
    }

    const result = {};
    names.forEach((n) => {
      if (batchCache[n]) result[n] = batchCache[n];
    });
    return result;
  },

  // ---------------------------------------
  // === Playgroup Trading ===
  // ---------------------------------------
  getTradeUsers: () => api.json("/trade/users"),
  getTradeMatches: () => api.json("/trade/matches"),
  getTradePartnerInventory: (userId) => api.json(`/trade/inventory/${userId}`),
  executeTrade: (partnerId, offer, demand) => api.post("/trade/propose", { partnerId, offer, demand }),
  getActiveTrades: () => api.json("/trade/active"),
  tradeAction: (tradeId, action, offer = null, demand = null) => api.post(`/trade/${tradeId}/action`, { action, offer, demand }),
  getTradeHistory: () => api.json("/trade/history"),
  getTradeLedger: () => api.json("/trade/ledger"),

  // ---------------------------------------
  // === Archidekt Sync ===
  // ---------------------------------------
  updateArchidektConfig: (config) => api.json("/archidekt/config", { method: "PUT", body: JSON.stringify(config) }),
  getArchidektDeckInfo: (deckId) => api.json(`/archidekt/deck/${deckId}`),
  syncArchidektDeck: (deckId, mappings) => api.json(`/archidekt/sync/${deckId}`, { method: "POST", body: JSON.stringify({ mappings }) }),
  getSavedArchidektDecks: () => api.json("/archidekt/decks"),
  updateArchidektDeckOptions: (deckId, options) => api.json(`/archidekt/decks/${deckId}`, { method: "PUT", body: JSON.stringify(options) }),

  // ---------------------------------------
  // === Playgroups ===
  // ---------------------------------------
  resyncPlaygroupDecks: (playgroupId) => api.json(`/playgroups/${playgroupId}/resync-decks`, { method: "POST" }),

  // ---------------------------------------
  // === Marketplace & Retail Pricing ===
  // ---------------------------------------
  searchLotusVault: (name) => api.json(`/pricing/lotusvault/search?name=${encodeURIComponent(name)}`),
  batchLotusVault: (names) => api.post("/pricing/lotusvault/batch", { names }),
  optimizeManaPool: (items, options) => api.post("/pricing/manapool/optimize", { items, options }),
};
