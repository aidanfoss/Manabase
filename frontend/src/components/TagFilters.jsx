import React from 'react'

export default function TagFilters({ metas, landcycles, selected, onToggle }) {
  return (
    <div>
      <div className="group">
        <h3>Metas</h3>
        <div className="taglist">
          {metas.map(m => (
            <button className={'tag ' + (selected.metas.has(m.name) ? 'active' : '')}
              onClick={() => onToggle('metas', m.name)}
              key={m.name}>{m.name}</button>
          ))}
        </div>
      </div>

      <div className="group">
        <h3>Land Cycles</h3>
        <div className="taglist">
          {landcycles.map(lc => (
            <button className={'tag ' + (selected.landcycles.has(lc.name || lc?.cycle || lc?.id || 'unknown') ? 'active' : '')}
              onClick={() => onToggle('landcycles', lc.name || lc?.cycle || lc?.id || 'unknown')}
              key={lc.name || lc?.cycle || lc?.id || 'unknown'}>{lc.name || lc?.cycle || lc?.id || 'Unknown'}</button>
          ))}
        </div>
      </div>
    </div>
  )
}