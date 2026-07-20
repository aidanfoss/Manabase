import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function TradeMatrix() {
  const { user } = useAuth();
  const [playgroups, setPlaygroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupInventory, setGroupInventory] = useState([]);
  const [tradePairs, setTradePairs] = useState([]);

  useEffect(() => {
    fetchPlaygroups();
  }, []);

  useEffect(() => {
    if (activeGroup) {
      fetchGroupInventory(activeGroup.id);
    }
  }, [activeGroup]);

  const fetchPlaygroups = async () => {
    try {
      const res = await fetch("/api/playgroups", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroups(data);
        if (data.length > 0) setActiveGroup(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGroupInventory = async (groupId) => {
    try {
      const res = await fetch(`/api/playgroups/${groupId}/inventory`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroupInventory(data);
        calculateTrades(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateTrades = (inventory) => {
    // A simplified trade matrix algorithm.
    // In a real app, you'd match "User A wants X" and "User B has X".
    // Since we don't have a "wants" list implemented in the UI yet, 
    // we'll just show high-value cards owned by others in the group
    // that might be good trade targets based on 85% market value.
    
    if (!user) return;
    
    const othersCards = inventory.filter(c => c.owner_id !== user.id && c.market_price > 5);
    othersCards.sort((a, b) => b.market_price - a.market_price);
    
    setTradePairs(othersCards.slice(0, 50)); // Top 50 trade targets
  };

  return (
    <div style={{ padding: "2rem", color: "white" }}>
      <h1>Trade Matrix</h1>
      
      {playgroups.length > 0 ? (
        <div style={{ marginBottom: "2rem" }}>
          <label style={{ marginRight: "1rem" }}>Select Playgroup: </label>
          <select 
            value={activeGroup?.id || ""} 
            onChange={e => setActiveGroup(playgroups.find(p => p.id === parseInt(e.target.value)))}
            style={{ padding: "0.5rem" }}
          >
            {playgroups.map(pg => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <p>You must join a playgroup to use the Trade Matrix.</p>
      )}

      {activeGroup && (
        <div style={{ background: "#222", padding: "1rem", borderRadius: "8px" }}>
          <h2>Potential Trade Targets (Values at 85%)</h2>
          <p style={{ color: "#aaa" }}>
            This board highlights high-value cards owned by others in your group. 
            Trade value is calculated at 85% of market price.
          </p>
          
          <table style={{ width: "100%", textAlign: "left", marginTop: "1rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #444" }}>
                <th style={{ padding: "0.5rem" }}>Card Name</th>
                <th>Owner</th>
                <th>Market Price</th>
                <th style={{ color: "#4caf50" }}>Trade Value (85%)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tradePairs.map(card => (
                <tr key={card.id} style={{ borderBottom: "1px solid #333" }}>
                  <td style={{ padding: "0.5rem" }}>{card.card_name} {card.is_foil ? "✨" : ""}</td>
                  <td>{card.owner_username}</td>
                  <td>${card.market_price?.toFixed(2)}</td>
                  <td style={{ color: "#4caf50" }}>${(card.market_price * 0.85).toFixed(2)}</td>
                  <td>
                    <button style={{ padding: "0.3rem 0.6rem", background: "#3a7bd5", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
                      Request Trade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tradePairs.length === 0 && <p style={{ marginTop: "1rem" }}>No high-value trade targets found in this group yet.</p>}
        </div>
      )}
    </div>
  );
}
