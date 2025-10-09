// frontend/src/api/client.js
const BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:8080" // Local dev backend
    : ""; // Production: same origin

export const api = {
  async json(path) {
    const url = `${BASE}${path}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    return JSON.parse(text.replace(/^\uFEFF/, "")); // remove BOM
  },

  getMetas: () => api.json("/api/metas"),
  getLandcycles: () => api.json("/api/landcycles"),

  getCards: ({ metas = [], landcycles = [], colors = [] }) => {
    const q = new URLSearchParams();
    metas.forEach((m) => q.append("metas", m));
    landcycles.forEach((l) => q.append("landcycles", l));
    colors.forEach((c) => q.append("colors", c));
    return api.json(`/api/cards?${q.toString()}`);
  },
};
