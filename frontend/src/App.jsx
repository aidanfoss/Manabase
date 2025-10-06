import React, { useEffect, useMemo, useState } from 'react'
import { api } from './api/client'
import Card from './components/Card'
import './styles.css'

export default function App() {
    const [metas, setMetas] = useState([])
    const [landcycles, setLandcycles] = useState([])
    const [selected, setSelected] = useState({
        metas: new Set(),
        landcycles: new Set(),
        colors: new Set()
    })
    const [cards, setCards] = useState({ staples: [], sideboard: [], lands: [] })

    // fetch initial data
    useEffect(() => {
        ; (async () => {
            const [m, l] = await Promise.all([
                api.getMetas(),
                api.getLandcycles()
            ])
            setMetas(m || [])
            setLandcycles(l || [])
        })()
    }, [])

    // toggle functions
    function toggleMeta(name) {
        setSelected(prev => {
            const next = new Set(prev.metas)
            next.has(name) ? next.delete(name) : next.add(name)
            return { ...prev, metas: next }
        })
    }

    function toggleCycle(name) {
        setSelected(prev => {
            const next = new Set(prev.landcycles)
            next.has(name) ? next.delete(name) : next.add(name)
            return { ...prev, landcycles: next }
        })
    }

    function toggleColor(c) {
        setSelected(prev => {
            const next = new Set(prev.colors)
            next.has(c) ? next.delete(c) : next.add(c)
            return { ...prev, colors: next }
        })
    }

    // rebuild combined lists when selection changes
    useEffect(() => {
        const chosenMetas = metas.filter(m => selected.metas.size === 0 || selected.metas.has(m.name))
        const staples = chosenMetas.flatMap(m => m.staples || [])
        const sideboard = chosenMetas.flatMap(m => m.sideboard || [])
        const lands = landcycles.filter(lc => selected.landcycles.size === 0 || selected.landcycles.has(lc.name))
        setCards({ staples, sideboard, lands })
    }, [metas, landcycles, selected.metas, selected.landcycles])

    return (
        <div className='app'>
            <aside className='aside'>
                <h2>Manabase Builder</h2>
                <p className='helper'>
                    Select colors, metas, and land cycles to populate cards. Prices shown are the lowest printing (foil or nonfoil).
                </p>

                {/* Color buttons */}
                <div className='section'>
                    <h3>Colors</h3>
                    <div className='color-buttons'>
                        {['W', 'U', 'B', 'R', 'G'].map(c => (
                            <button
                                key={c}
                                onClick={() => toggleColor(c)}
                                className={`color-btn color-${c}${selected.colors.has(c) ? ' active' : ''}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Metas */}
                <div className='section'>
                    <h3>Metas</h3>
                    <div className='taglist'>
                        {metas.map(m => (
                            <button
                                key={m.name}
                                onClick={() => toggleMeta(m.name)}
                                className={`tag${selected.metas.has(m.name) ? ' active' : ''}`}
                            >
                                {m.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Land Cycles */}
                <div className='section'>
                    <h3>Land Cycles</h3>
                    <div className='taglist'>
                        {landcycles.map(lc => (
                            <button
                                key={lc.name}
                                onClick={() => toggleCycle(lc.name)}
                                className={`tag${selected.landcycles.has(lc.name) ? ' active' : ''}`}
                            >
                                {lc.name}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            <main className='main'>
                <div className='section-title'>Staples</div>
                <div className='grid'>
                    {cards.staples.map((n, i) => {
                        const card = typeof n === 'string' ? { name: n } : n
                        return <Card key={i} item={card} />
                    })}
                </div>

                <div className='section-title'>Sideboard</div>
                <div className='grid'>
                    {cards.sideboard.map((n, i) => {
                        const card = typeof n === 'string' ? { name: n } : n
                        return <Card key={i} item={card} />
                    })}
                </div>

                <div className='section-title'>Lands</div>
                <div className='grid'>
                    {cards.lands.map((n, i) => {
                        const card = typeof n === 'string' ? { name: n } : n
                        return <Card key={i} item={card} />
                    })}
                </div>
            </main>
        </div>
    )
}
