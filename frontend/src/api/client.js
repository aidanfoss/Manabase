// frontend/src/api/client.js
const BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080/api"
    : "/api";

export const api = {
  // Generic JSON fetcher
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
    return text ? JSON.parse(text.replace(/^\uFEFF/, "")) : {};
  },

  // Generic POST
  async post(path, body, headers = {}) {
    return api.json(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  },

  // === App data endpoints ===
  getMetas: () => api.json("/metas"),
  getLandcycles: () => api.json("/landcycles"),

  getCards: ({ metas = [], landcycles = [], colors = [] }) => {
    const q = new URLSearchParams();
    metas.forEach((m) => q.append("metas", m));
    landcycles.forEach((l) => q.append("landcycles", l));
    colors.forEach((c) => q.append("colors", c));
    return api.json(`/cards?${q.toString()}`);
  },

  // === Auth ===
  login: (credentials) => api.post("/auth/login", credentials),
  register: (credentials) => api.post("/auth/register", credentials),

  // === Packages ===
  getPackages: () => api.json("/packages"),
  savePackage: (data) => api.post("/packages", data),
};
