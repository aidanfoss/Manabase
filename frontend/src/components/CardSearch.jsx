import React, { useState } from "react";

export default function CardSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  async function searchCards(e) {
    e.preventDefault();
    if (!query.trim()) return;
    const res = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    setResults(data.data || []);
  }

  return (
    <div className="card-search">
      <form onSubmit={searchCards}>
        <input
          type="text"
          placeholder="Search for cards..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="search-results">
        {results.map((card) => (
          <div key={card.id} className="card-result">
            <img src={card.image_uris?.small} alt={card.name} />
            <div>{card.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
