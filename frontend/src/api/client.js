// frontend/src/api/client.js
const BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080/api"
    : "/api";

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

    const response = await fetch(url, {
      method,
      headers,
      body: options.body,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    // Strip BOM if present
    return text ? JSON.parse(text.replace(/^\uFEFF/, "")) : {};
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

  // ---------------------------------------
  // === Packages ===
  // ---------------------------------------
  savePackage: (data) => api.post("/packages", data),
  deletePackage: (id) =>
    api.json(`/packages/${id}`, {
      method: "DELETE",
    }),

  // ---------------------------------------
  // === Scryfall Proxy ===
  // (calls your backend route, not Scryfall directly)
  // ---------------------------------------
  getCardSearch: (query) => api.json(`/scryfall?q=${encodeURIComponent(query)}`),
};
