import React from 'react'
import { fmtUSD } from '../utils/money'

export default function Card({ item }) {
    const { name, note, price, image, prints } = item
    return (
        <div className='card'>
            {/* note icon */}
            {note && <div className='note-dot'>?</div>}
            {note && <div className='tooltip'>{note}</div>}

            {/* card art */}
            {image ? (
                <img src={image} alt={name} />
            ) : (
                <div style={{ height: '256px', display: 'grid', placeItems: 'center' }} className='muted'>
                    No image
                </div>
            )}

            <div className='title'>{name}</div>

            {/* price tag */}
            <div className='price-tag'>lowest {fmtUSD(price)}</div>

            {/* show price table only when hovering over price tag */}
            {Array.isArray(prints) && prints.length > 0 && (
                <div className='price-hover'>
                    <div className='price-row'>
                        <b>Printings</b>
                        <span>{prints.length}</span>
                    </div>
                    {prints.slice(0, 6).map((p, i) => {
                        const usd = p?.prices?.usd ? Number(p.prices.usd) : null
                        const foil = p?.prices?.usd_foil ? Number(p.prices.usd_foil) : null
                        const shown = usd != null ? usd : foil
                        const tag = usd != null ? 'nonfoil' : foil != null ? 'foil' : '—'
                        return (
                            <div className='price-row' key={p.id || i}>
                                <span>
                                    {p.set_name || '—'} <span className='muted'>({tag})</span>
                                </span>
                                <span>{shown != null ? `$${shown.toFixed(2)}` : '—'}</span>
                            </div>
                        )
                    })}
                    {prints.length > 6 && <div className='muted' style={{ paddingTop: 6 }}>…more</div>}
                </div>
            )}
        </div>
    )
}
