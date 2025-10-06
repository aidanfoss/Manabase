const BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:8080'

export const api = {
    async json(path) {
        const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        const clean = text.replace(/^\uFEFF/, '')
        return JSON.parse(clean)
    },

    getMetas: () => api.json('/api/metas'),
    getLandcycles: () => api.json('/api/landcycles'),
    getSideboard: () => api.json('/api/sideboard'),
    getCardByName: name => api.json(`/api/scryfall/card/${encodeURIComponent(name)}`),
    search: q => api.json(`/api/scryfall/search?q=${encodeURIComponent(q)}`)
}
