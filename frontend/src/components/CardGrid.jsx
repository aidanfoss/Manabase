import React from 'react'
import Card from './Card'

export default function CardGrid({ items }) {
  return (
    <div className="grid">
      {items.map((it) => <Card key={it.name} item={it} />)}
    </div>
  )
}
