const fs = require('fs');

let content = fs.readFileSync('c:/Users/bossf/Documents/Projects/Manabase/frontend/src/components/WishlistHub.jsx', 'utf8');

// 1. Add states
content = content.replace(
  'const [activeTab, setActiveTab] = useState("lists"); // "lists", "nexus"',
  'const [activeTab, setActiveTab] = useState("lists"); // "lists", "nexus", "trades"\n  const [activeTrades, setActiveTrades] = useState([]);\n  const [counterTrade, setCounterTrade] = useState(null);\n  const [counterOffer, setCounterOffer] = useState([]);\n  const [counterDemand, setCounterDemand] = useState([]);'
);

// 2. Add loadActiveTrades function and related actions
const newFunctions = `
  const loadActiveTrades = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/trade/active", { headers: { Authorization: \`Bearer \${token}\` } });
      if (res.ok) {
        setActiveTrades(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProposeTrade = async (partnerId, offer, demand) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/trade/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ partnerId, offer, demand })
      });
      if (res.ok) {
        alert("Trade proposed successfully!");
        loadActiveTrades();
        loadPlaygroups();
        if (activeGroup) loadPlaygroupDetails(activeGroup.id);
      } else {
        const data = await res.json();
        alert(\`Error: \${data.error}\`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to propose trade.");
    }
  };

  const handleTradeAction = async (tradeId, action, offer = null, demand = null) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(\`/api/trade/\${tradeId}/action\`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ action, offer, demand })
      });
      if (res.ok) {
        alert(\`Trade \${action} successful!\`);
        setCounterTrade(null);
        loadActiveTrades();
        loadLists();
        if (activeGroup) loadPlaygroupDetails(activeGroup.id);
      } else {
        const data = await res.json();
        alert(\`Error: \${data.error}\`);
      }
    } catch (e) {
      console.error(e);
      alert(\`Failed to \${action} trade.\`);
    }
  };
`;
content = content.replace('const handleCreateGroup = async () => {', newFunctions + '\n  const handleCreateGroup = async () => {');

// 3. Update the button
content = content.replace(
  'onClick={() => handleFulfillTrade(c.card_name, c.user_id, wishlist[0]?.user_id)}',
  'onClick={() => handleProposeTrade(c.user_id || peer.id, [], [{ card_name: c.card_name, quantity: 1, set_code: c.set_code, is_foil: !!c.is_foil }])}'
);
content = content.replace(/>\s*Request Fulfill Swap \(/g, '> Propose Trade (');


// 4. Update the tabs UI
const tabsHtml = `
      <div className="nexus-tabs-header">
        <button 
          className={\`nexus-tab-btn \${activeTab === "lists" ? "active" : ""}\`}
          onClick={() => setActiveTab("lists")}
        >
          📋 My Lists
        </button>
        <button 
          className={\`nexus-tab-btn \${activeTab === "nexus" ? "active" : ""}\`}
          onClick={() => setActiveTab("nexus")}
        >
          👥 Playgroup Nexus
        </button>
        <button 
          className={\`nexus-tab-btn \${activeTab === "trades" ? "active" : ""}\`}
          onClick={() => { setActiveTab("trades"); loadActiveTrades(); }}
        >
          🤝 Active Trades
        </button>
      </div>
`;
content = content.replace(/<div className="nexus-tabs-header">[\s\S]*?<\/div>/, tabsHtml);

// 5. Add VIEW 3 at the bottom
const tradesView = `
      {/* VIEW 3: ACTIVE TRADES */}
      {activeTab === "trades" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <h2 style={{ margin: 0 }}>My Active Trades</h2>
          
          {counterTrade ? (
            <div className="setup-card" style={{ padding: "1.5rem" }}>
              <h3>Counter Offer to {counterTrade.partner_username}</h3>
              <p>Select cards from either user's inventory to construct a new offer.</p>
              
              <div className="matrix-columns-split">
                <div className="matrix-sub-column">
                  <h4>What you are giving (Offer)</h4>
                  {counterOffer.map((c, i) => (
                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px'}}>
                      <span>{c.card_name} x{c.quantity}</span>
                      <button className="remove-card-link" onClick={() => {
                        const newOffer = [...counterOffer];
                        newOffer.splice(i, 1);
                        setCounterOffer(newOffer);
                      }}>❌</button>
                    </div>
                  ))}
                  <div style={{marginTop: "1rem"}}>
                    <select className="set-select" onChange={(e) => {
                      if(!e.target.value) return;
                      const card = JSON.parse(e.target.value);
                      setCounterOffer([...counterOffer, { ...card, quantity: 1 }]);
                      e.target.value = "";
                    }}>
                      <option value="">+ Add card you own...</option>
                      {groupInventory.filter(c => c.owner_username !== counterTrade.partner_username).map((c, i) => (
                        <option key={i} value={JSON.stringify(c)}>{c.card_name} ({c.set_code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="matrix-sub-column">
                  <h4>What you want (Demand)</h4>
                  {counterDemand.map((c, i) => (
                    <div key={i} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px'}}>
                      <span>{c.card_name} x{c.quantity}</span>
                      <button className="remove-card-link" onClick={() => {
                        const newDem = [...counterDemand];
                        newDem.splice(i, 1);
                        setCounterDemand(newDem);
                      }}>❌</button>
                    </div>
                  ))}
                  <div style={{marginTop: "1rem"}}>
                    <select className="set-select" onChange={(e) => {
                      if(!e.target.value) return;
                      const card = JSON.parse(e.target.value);
                      setCounterDemand([...counterDemand, { ...card, quantity: 1 }]);
                      e.target.value = "";
                    }}>
                      <option value="">+ Add card they own...</option>
                      {groupInventory.filter(c => c.owner_username === counterTrade.partner_username).map((c, i) => (
                        <option key={i} value={JSON.stringify(c)}>{c.card_name} ({c.set_code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button className="setup-btn" style={{background: "#3b82f6"}} onClick={() => handleTradeAction(counterTrade.id, "counter", counterOffer, counterDemand)}>Submit Counter</button>
                <button className="setup-btn" style={{background: "#64748b"}} onClick={() => setCounterTrade(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {activeTrades.length === 0 ? (
                <p style={{ color: "#64748b" }}>You have no active trades.</p>
              ) : (
                activeTrades.map(trade => {
                  // Determine who is "me" in this trade
                  // If I am sender, the trade.offer is my cards going out, trade.demand is cards I want in.
                  const imSender = (trade.offer[0]?.user_id !== trade.partner_id && trade.offer.length > 0) || (trade.demand[0]?.user_id === trade.partner_id && trade.demand.length > 0) || true; // Well, we assigned it correctly on the backend where offer = my cards. Wait, backend says: offer = items.filter(i => i.user_id === req.user.id), demand = items.filter(i => i.user_id !== req.user.id)
                  
                  return (
                    <div key={trade.id} className="setup-card" style={{ marginBottom: "1rem", position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Trade with {trade.partner_username}</h3>
                          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Status: <strong style={{color: "#fff"}}>{trade.status.toUpperCase()}</strong></span>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {trade.status === "proposed" && trade.offer[0]?.user_id === trade.partner_id /* wait, backend offer is always my cards. If they proposed, I am receiver */ && trade.receiver_id && (
                            <>
                              <button className="setup-btn" style={{background: "#10b981"}} onClick={() => handleTradeAction(trade.id, "accept")}>Accept</button>
                              <button className="setup-btn" style={{background: "#f59e0b"}} onClick={() => {
                                setCounterTrade(trade);
                                setCounterOffer(trade.offer || []);
                                setCounterDemand(trade.demand || []);
                              }}>Counter</button>
                              <button className="setup-btn" style={{background: "#ef4444"}} onClick={() => handleTradeAction(trade.id, "decline")}>Decline</button>
                            </>
                          )}
                          {/* If status is countered, and I am the one receiving the counter... */
                            trade.status === "countered" && (
                            <>
                              <button className="setup-btn" style={{background: "#10b981"}} onClick={() => handleTradeAction(trade.id, "accept")}>Accept Counter</button>
                              <button className="setup-btn" style={{background: "#f59e0b"}} onClick={() => {
                                setCounterTrade(trade);
                                setCounterOffer(trade.offer || []);
                                setCounterDemand(trade.demand || []);
                              }}>Counter Again</button>
                              <button className="setup-btn" style={{background: "#ef4444"}} onClick={() => handleTradeAction(trade.id, "decline")}>Decline</button>
                            </>
                          )}
                          {trade.status === "accepted" && (
                            <button className="setup-btn" style={{background: "#3b82f6"}} onClick={() => handleTradeAction(trade.id, "complete")}>Confirm Physical Receipt</button>
                          )}
                        </div>
                      </div>

                      <div className="matrix-columns-split">
                        <div className="matrix-sub-column">
                          <h4>You Give:</h4>
                          {trade.offer.length > 0 ? trade.offer.map((c, i) => (
                            <div key={i}>- {c.card_name} x{c.quantity}</div>
                          )) : <div style={{color: "#64748b"}}>Nothing</div>}
                        </div>
                        <div className="matrix-sub-column">
                          <h4>You Get:</h4>
                          {trade.demand.length > 0 ? trade.demand.map((c, i) => (
                            <div key={i}>- {c.card_name} x{c.quantity}</div>
                          )) : <div style={{color: "#64748b"}}>Nothing</div>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
`;

content = content.replace(/<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*}\s*$/, tradesView);

fs.writeFileSync('c:/Users/bossf/Documents/Projects/Manabase/frontend/src/components/WishlistHub.jsx', content);
