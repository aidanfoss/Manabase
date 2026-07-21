// src/components/TradelistManager.jsx
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import "../styles/tradelist.css";

export default function TradelistManager() {
  const [activeTab, setActiveTab] = useState("trading"); // "trading" or "manage"
  
  // State for Manage My Tradelist
  const [tradelist, setTradelist] = useState([]);
  const [loadingMyTrade, setLoadingMyTrade] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // State for Playgroup Trading
  const [partners, setPartners] = useState([]);
  const [activePartner, setActivePartner] = useState(null); // Selected user object
  const [wishlistMatches, setWishlistMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Active Trade States
  const [partnerInventory, setPartnerInventory] = useState([]); // Partner's cards (tradelist & wishlist)
  const [myWishlist, setMyWishlist] = useState([]); // Current user's wishlist
  const [offer, setOffer] = useState([]); // Cards current user is giving
  const [demand, setDemand] = useState([]); // Cards current user is getting
  const [filterPartnerWishlist, setFilterPartnerWishlist] = useState(true);
  const [filterMyWishlist, setFilterMyWishlist] = useState(true);
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [tradeMessage, setTradeMessage] = useState("");

  // Card Metadata / Artwork Cache
  const [printsCache, setPrintsCache] = useState({});
  const [inspectedCard, setInspectedCard] = useState(null); // Active card details in sidebar inspector
  const [activeInventoryTab, setActiveInventoryTab] = useState("partner"); // "partner" or "mine"

  // Load My Tradelist
  useEffect(() => {
    loadTradelist();
    loadMyWishlist();
  }, []);

  // Load matches and partners when entering Trading tab
  useEffect(() => {
    if (activeTab === "trading") {
      loadMatches();
      loadPartners();
    }
  }, [activeTab]);

  // Load partner's details when activePartner changes
  useEffect(() => {
    if (activePartner) {
      loadPartnerInventory(activePartner.id);
      // Reset trade offers when switching partner
      setOffer([]);
      setDemand([]);
      setTradeMessage("");
    }
  }, [activePartner]);

  // Cache card metadata helper
  const fetchCardMetadataBatch = async (cardNames) => {
    const uniqueNames = [...new Set(cardNames)].filter(name => !printsCache[name]);
    if (uniqueNames.length === 0) return;
    try {
      const batchResult = await api.getCardDetailsBatch(uniqueNames);
      setPrintsCache(prev => ({ ...prev, ...batchResult }));
    } catch (e) {
      console.warn("Failed to load metadata batch", e);
    }
  };

  const loadTradelist = async () => {
    setLoadingMyTrade(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/tradelist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTradelist(data || []);
        fetchCardMetadataBatch(data.map(c => c.card_name));
      }
    } catch (e) {
      console.error("Failed to load tradelist:", e);
    } finally {
      setLoadingMyTrade(false);
    }
  };

  const loadMyWishlist = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyWishlist(data || []);
        fetchCardMetadataBatch(data.map(c => c.card_name));
      }
    } catch (e) {
      console.error("Failed to load wishlist:", e);
    }
  };

  const loadPartners = async () => {
    try {
      const res = await api.getTradeUsers();
      setPartners(res || []);
    } catch (e) {
      console.error("Failed to load trade partners:", e);
    }
  };

  const loadMatches = async () => {
    setLoadingMatches(true);
    try {
      const res = await api.getTradeMatches();
      setWishlistMatches(res || []);
      fetchCardMetadataBatch(res.map(m => m.wishlist_item.card_name));
    } catch (e) {
      console.error("Failed to load trade matches:", e);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadPartnerInventory = async (userId) => {
    setLoadingPartner(true);
    try {
      const res = await api.getTradePartnerInventory(userId);
      setPartnerInventory(res || []);
      fetchCardMetadataBatch(res.map(c => c.card_name));
    } catch (e) {
      console.error("Failed to load partner inventory:", e);
    } finally {
      setLoadingPartner(false);
    }
  };

  // Autocomplete Search for Manage Tab
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await api.getCardSearch(val.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error("Card search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const addCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = {
        card_name: card.name,
        quantity: 1,
        set_code: (card.set || "").toUpperCase(),
        collector_number: card.collector_number || "",
        is_foil: false,
      };

      const res = await fetch("/api/collection/tradelist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        loadTradelist();
      }
    } catch (e) {
      console.error("Failed to add card to tradelist:", e);
    }
  };

  const updateCardDetails = async (card, updates) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = {
        card_name: card.card_name,
        quantity: updates.quantity !== undefined ? Math.max(0, updates.quantity) : card.quantity,
        set_code: updates.set_code !== undefined ? updates.set_code : card.set_code,
        collector_number: updates.collector_number !== undefined ? updates.collector_number : card.collector_number,
        is_foil: updates.is_foil !== undefined ? updates.is_foil : card.is_foil,
      };

      const res = await fetch("/api/collection/tradelist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadTradelist();
      }
    } catch (e) {
      console.error("Failed to update tradelist card:", e);
    }
  };

  const deleteCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/tradelist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_name: card.card_name,
        }),
      });

      if (res.ok) {
        loadTradelist();
      }
    } catch (e) {
      console.error("Failed to remove tradelist card:", e);
    }
  };

  // Trade Builder Operations
  const handleAddToOffer = (card) => {
    const existing = offer.find(o => o.card_name === card.card_name);
    const maxQty = card.quantity;

    if (existing) {
      if (existing.quantity >= maxQty) return; // Can't add more than owned
      setOffer(prev => prev.map(o => o.card_name === card.card_name ? { ...o, quantity: o.quantity + 1 } : o));
    } else {
      setOffer(prev => [...prev, { ...card, quantity: 1 }]);
    }
  };

  const handleRemoveFromOffer = (card) => {
    setOffer(prev => prev.map(o => {
      if (o.card_name === card.card_name) {
        return { ...o, quantity: o.quantity - 1 };
      }
      return o;
    }).filter(o => o.quantity > 0));
  };

  const handleAddToDemand = (card) => {
    const existing = demand.find(d => d.card_name === card.card_name);
    const maxQty = card.quantity;

    if (existing) {
      if (existing.quantity >= maxQty) return;
      setDemand(prev => prev.map(d => d.card_name === card.card_name ? { ...d, quantity: d.quantity + 1 } : d));
    } else {
      setDemand(prev => [...prev, { ...card, quantity: 1 }]);
    }
  };

  const handleRemoveFromDemand = (card) => {
    setDemand(prev => prev.map(d => {
      if (d.card_name === card.card_name) {
        return { ...d, quantity: d.quantity - 1 };
      }
      return d;
    }).filter(d => d.quantity > 0));
  };

  const handleExecuteTrade = async () => {
    if (offer.length === 0 && demand.length === 0) {
      setTradeMessage("⚠️ Cannot execute an empty trade!");
      return;
    }
    setExecutingTrade(true);
    setTradeMessage("");
    try {
      const res = await api.executeTrade(activePartner.id, offer, demand);
      if (res.success) {
        setTradeMessage("🎉 Trade completed successfully!");
        setOffer([]);
        setDemand([]);
        // Reload inventories
        loadTradelist();
        loadMyWishlist();
        loadPartnerInventory(activePartner.id);
        // Refresh matches
        loadMatches();
      } else {
        setTradeMessage(`❌ Error: ${res.error || "Trade failed"}`);
      }
    } catch (e) {
      setTradeMessage("❌ Network error executing trade. Please try again.");
    } finally {
      setExecutingTrade(false);
    }
  };

  // Helper to render card image uri
  const getCardImage = (cardName, setCode) => {
    const meta = printsCache[cardName];
    if (meta && meta.prints && setCode) {
      const print = meta.prints.find(p => p.set?.toUpperCase() === setCode.toUpperCase());
      if (print && (print.image_uris?.normal || print.card_faces?.[0]?.image_uris?.normal)) {
        return print.image_uris.normal || print.card_faces[0].image_uris.normal;
      }
    }
    return meta?.image_uris?.normal || meta?.card_faces?.[0]?.image_uris?.normal || "https://cards.scryfall.io/card_back.png";
  };

  const getCardPrices = (cardName) => {
    const meta = printsCache[cardName];
    return meta?.prices || {};
  };

  // Render Steam grid slots (fixed 8 slots, or more if offer length > 8)
  const renderSteamSlots = (items, onRemove, isMine) => {
    const slotCount = Math.max(8, items.length);
    const slots = [];
    
    for (let i = 0; i < slotCount; i++) {
      const item = items[i];
      if (item) {
        const image = getCardImage(item.card_name, item.set_code);
        slots.push(
          <div 
            key={i} 
            className={`steam-slot filled ${item.is_foil ? "foil-rainbow" : ""}`}
            onClick={() => onRemove(item)}
            onMouseEnter={() => setInspectedCard(item)}
          >
            <img src={image} alt={item.card_name} className="steam-slot-img" />
            <div className="steam-slot-badge">x{item.quantity}</div>
          </div>
        );
      } else {
        slots.push(
          <div key={i} className="steam-slot empty">
            <span className="plus">+</span>
          </div>
        );
      }
    }
    return slots;
  };

  // Filters for Inventories
  const filteredMyTradelist = tradelist.filter(item => {
    if (activePartner && filterPartnerWishlist) {
      const partnerWishNames = partnerInventory
        .filter(c => c.list_type === "wishlist")
        .map(c => c.card_name.toLowerCase());
      return partnerWishNames.includes(item.card_name.toLowerCase());
    }
    return true;
  });

  const filteredPartnerTradelist = partnerInventory
    .filter(c => c.list_type === "tradelist")
    .filter(item => {
      if (filterMyWishlist) {
        const myWishNames = myWishlist.map(c => c.card_name.toLowerCase());
        return myWishNames.includes(item.card_name.toLowerCase());
      }
      return true;
    });

  return (
    <div className="collection-page-container steam-theme">
      {/* Upper Navigation Tabs */}
      <div className="steam-tabs-container">
        <button 
          className={`steam-tab-btn ${activeTab === "trading" ? "active" : ""}`}
          onClick={() => setActiveTab("trading")}
        >
          🤝 Playgroup Trading
        </button>
        <button 
          className={`steam-tab-btn ${activeTab === "manage" ? "active" : ""}`}
          onClick={() => setActiveTab("manage")}
        >
          ⚙️ Manage My Tradelist
        </button>
      </div>

      {activeTab === "manage" ? (
        /* MANAGE MY TRADELIST TAB */
        <>
          <div className="collection-header">
            <div>
              <h1 className="collection-title">🤝 Tradelist Manager</h1>
              <p className="collection-subtitle">Track cards you do not need for proxy orders but would like to trade.</p>
            </div>
          </div>

          <div className="search-bar-row">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Type card name to add to your tradelist..."
                className="collection-search-input"
              />
              {searching && <span className="search-spinner-inline">Searching...</span>}
            </div>

            {searchResults.length > 0 && (
              <div className="search-suggestions-overlay">
                {searchResults.map((card) => (
                  <div 
                    key={card.id} 
                    className="suggestion-row"
                    onClick={() => addCard(card)}
                  >
                    <span className="name">{card.name}</span>
                    <span className="set">({card.set ? card.set.toUpperCase() : "N/A"})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="csv-table-wrapper">
            {loadingMyTrade && tradelist.length === 0 ? (
              <div className="table-loading">Loading tradelist...</div>
            ) : tradelist.length === 0 ? (
              <div className="table-empty">
                Your tradelist is currently empty. Quick search cards above to add cards you want to trade!
              </div>
            ) : (
              <table className="csv-table">
                <thead>
                  <tr>
                    <th className="col-qty">Quantity</th>
                    <th className="col-name">Card Name</th>
                    <th className="col-print">Printing</th>
                    <th className="col-foil">Finish</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tradelist.map((card) => (
                    <tr key={card.id}>
                      <td className="col-qty">
                        <div className="qty-picker-compact">
                          <button onClick={() => updateCardDetails(card, { quantity: card.quantity - 1 })}>-</button>
                          <span>{card.quantity}</span>
                          <button onClick={() => updateCardDetails(card, { quantity: card.quantity + 1 })}>+</button>
                        </div>
                      </td>
                      <td className="col-name font-bold">
                        {card.card_name}
                      </td>
                      <td className="col-print">
                        {(() => {
                          const cardMeta = printsCache[card.card_name];
                          const prints = cardMeta?.prints || [];
                          const activePrintIdx = prints.findIndex(p => p.set?.toUpperCase() === card.set_code?.toUpperCase() && p.collector_number === card.collector_number);
                          const valueIdx = activePrintIdx !== -1 ? activePrintIdx : 0;
                          
                          if (prints.length > 0) {
                            return (
                              <select 
                                value={valueIdx}
                                onChange={(e) => {
                                  const idx = parseInt(e.target.value);
                                  const p = prints[idx];
                                  if (p) {
                                    updateCardDetails(card, {
                                      set_code: p.set?.toUpperCase(),
                                      collector_number: p.collector_number || ""
                                    });
                                  }
                                }}
                                className="table-input set-select"
                                style={{ width: "100%", padding: "4px" }}
                              >
                                {prints.map((p, idx) => (
                                  <option key={idx} value={idx}>
                                    {p.set?.toUpperCase()} - {p.set_name}
                                  </option>
                                ))}
                              </select>
                            );
                          }
                          return <span className="loading-label">Loading...</span>;
                        })()}
                      </td>
                      <td className="col-foil">
                        <label className="switch-container">
                          <input
                            type="checkbox"
                            checked={!!card.is_foil}
                            onChange={(e) => updateCardDetails(card, { is_foil: e.target.checked })}
                          />
                          <span className="slider round"></span>
                          <span className="foil-label">{card.is_foil ? "Foil" : "Normal"}</span>
                        </label>
                      </td>
                      <td className="col-actions">
                        <button 
                          className="table-delete-btn"
                          onClick={() => deleteCard(card)}
                          title="Remove card"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* PLAYGROUP TRADING (STEAM STYLE) TAB */
        <div className="steam-trading-layout">
          
          {!activePartner ? (
            /* WISH LIST MATCHMAKER SCREEN */
            <div className="steam-matchmaker-container">
              <div className="steam-section-header">
                <h2>🤝 Playgroup Wishlist Matches</h2>
                <p>These are cards on your wishlist that members in your playgroup currently have in their tradelists.</p>
              </div>

              {/* Direct Select Dropdown */}
              <div className="direct-partner-select">
                <label>Directly Trade with Member:</label>
                <select 
                  onChange={(e) => {
                    const p = partners.find(usr => usr.id === e.target.value);
                    if (p) setActivePartner(p);
                  }}
                  value=""
                >
                  <option value="" disabled>-- Select Partner --</option>
                  {partners.map(usr => (
                    <option key={usr.id} value={usr.id}>{usr.username} ({usr.email})</option>
                  ))}
                </select>
              </div>

              {loadingMatches ? (
                <div className="steam-loader">Scanning playgroup wishlist matches...</div>
              ) : wishlistMatches.length === 0 ? (
                <div className="steam-empty-box">
                  No wishlist matches found. Either your wishlist is empty, or no one in your playgroup has those cards in their tradelists.
                  <br />
                  <span className="sub">Tip: Go to the Wishlist tab and add cards, or have other members add cards to their Tradelists!</span>
                </div>
              ) : (
                <div className="steam-matches-grid">
                  {wishlistMatches.map((match) => {
                    const cardName = match.wishlist_item.card_name;
                    const image = getCardImage(cardName, match.wishlist_item.set_code);
                    // Filter matching owners who have it in tradelist specifically, or fallback to owned
                    const owners = match.owners;
                    if (owners.length === 0) return null;

                    return (
                      <div key={match.wishlist_item.id} className="steam-match-card">
                        <div className="steam-match-img-wrapper">
                          <img src={image} alt={cardName} className="steam-match-img" />
                          <div className="steam-match-badge">Wishlist</div>
                        </div>
                        <div className="steam-match-info">
                          <h3>{cardName}</h3>
                          <div className="owners-list">
                            <span className="owner-title font-semibold text-sm">Playgroup Owners:</span>
                            {owners.map((owner, idx) => (
                              <div key={idx} className="owner-row">
                                <span className="owner-name">👤 {owner.username}</span>
                                <span className="owner-meta">
                                  {owner.quantity}x ({owner.list_type === "tradelist" ? "Tradelist" : "Collection"})
                                </span>
                                <button 
                                  className="trade-initiate-btn"
                                  onClick={() => {
                                    const p = partners.find(usr => usr.id === owner.user_id);
                                    if (p) setActivePartner(p);
                                  }}
                                >
                                  Trade
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE STEAM INTERACTIVE TRADE SCREEN */
            <div className="steam-trade-screen">
              {/* Back to matchmaker */}
              <button className="steam-back-btn" onClick={() => setActivePartner(null)}>
                ← Back to Matchmaker
              </button>

              <div className="steam-trade-header">
                <h2>Trading with <span className="partner-name">{activePartner.username}</span></h2>
                <p>Construct your offer by adding items from the inventory bins below.</p>
              </div>

              {/* Steam layout split screen */}
              <div className="steam-split-container">
                {/* Left section: Trade Board & Inventories */}
                <div className="steam-main-panel">
                  
                  {/* Two-Column Trade Board */}
                  <div className="steam-trade-slots-board">
                    {/* Left Column: Your Offer */}
                    <div className="steam-offer-side">
                      <h3>Your Trade Offer</h3>
                      <p className="subtitle">Cards you are giving</p>
                      <div className="slots-grid">
                        {renderSteamSlots(offer, handleRemoveFromOffer, true)}
                      </div>
                    </div>

                    {/* Right Column: Their Offer */}
                    <div className="steam-offer-side">
                      <h3>{activePartner.username}'s Offer</h3>
                      <p className="subtitle">Cards you are receiving</p>
                      <div className="slots-grid">
                        {renderSteamSlots(demand, handleRemoveFromDemand, false)}
                      </div>
                    </div>
                  </div>

                  {/* Center Actions Bar */}
                  <div className="steam-actions-bar">
                    {tradeMessage && (
                      <div className={`trade-status-message ${tradeMessage.includes("success") || tradeMessage.includes("🎉") ? "success" : "error"}`}>
                        {tradeMessage}
                      </div>
                    )}
                    <div className="actions-buttons">
                      <button 
                        className="execute-trade-btn"
                        onClick={handleExecuteTrade}
                        disabled={executingTrade || (offer.length === 0 && demand.length === 0)}
                      >
                        {executingTrade ? "Processing Trade..." : "Propose & Execute Trade"}
                      </button>
                      <button 
                        className="cancel-trade-btn"
                        onClick={() => {
                          setOffer([]);
                          setDemand([]);
                          setTradeMessage("");
                        }}
                      >
                        Reset Slots
                      </button>
                    </div>
                  </div>

                  {/* Lower Inventories Bin */}
                  <div className="steam-inventories-section">
                    <div className="steam-inventory-tabs">
                      <button 
                        className={`steam-inv-tab ${activeInventoryTab === "partner" ? "active" : ""}`}
                        onClick={() => setActiveInventoryTab("partner")}
                      >
                        👤 {activePartner.username}'s Tradelist Inventory
                      </button>
                      <button 
                        className={`steam-inv-tab ${activeInventoryTab === "mine" ? "active" : ""}`}
                        onClick={() => setActiveInventoryTab("mine")}
                      >
                        🎒 Your Tradelist Inventory
                      </button>
                    </div>

                    <div className="steam-inventory-pane">
                      {activeInventoryTab === "partner" ? (
                        /* Partner Inventory View */
                        <div className="inventory-pane-content">
                          <div className="filter-row">
                            <label className="checkbox-label">
                              <input 
                                type="checkbox" 
                                checked={filterMyWishlist}
                                onChange={(e) => setFilterMyWishlist(e.target.checked)}
                              />
                              <span>Only show cards that match my Wishlist</span>
                            </label>
                            <span className="count-label">{filteredPartnerTradelist.length} cards found</span>
                          </div>

                          {loadingPartner ? (
                            <div className="steam-loader">Loading partner inventory...</div>
                          ) : filteredPartnerTradelist.length === 0 ? (
                            <div className="steam-empty-box py-6">
                              No cards found. {filterMyWishlist && "Try unchecking the wishlist filter to see their entire tradelist!"}
                            </div>
                          ) : (
                            <div className="steam-inv-grid">
                              {filteredPartnerTradelist.map((card) => {
                                const image = getCardImage(card.card_name, card.set_code);
                                const isAdded = demand.find(d => d.card_name === card.card_name);
                                const currentQty = isAdded ? isAdded.quantity : 0;
                                const remainingQty = card.quantity - currentQty;

                                return (
                                  <div 
                                    key={card.id} 
                                    className={`steam-inv-card ${card.is_foil ? "foil-rainbow" : ""} ${remainingQty <= 0 ? "depleted" : ""}`}
                                    onClick={() => remainingQty > 0 && handleAddToDemand(card)}
                                    onMouseEnter={() => setInspectedCard(card)}
                                  >
                                    <div className="inv-img-wrap">
                                      <img src={image} alt={card.card_name} className="inv-card-img" />
                                      {card.is_foil && <span className="foil-pill">Foil</span>}
                                      {card.set_code && <span className="set-badge">{card.set_code.toUpperCase()}</span>}
                                    </div>
                                    <div className="inv-quantity-badge">Qty: {card.quantity}</div>
                                    {currentQty > 0 && <div className="added-overlay">In Trade: {currentQty}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* My Inventory View */
                        <div className="inventory-pane-content">
                          <div className="filter-row">
                            <label className="checkbox-label">
                              <input 
                                type="checkbox" 
                                checked={filterPartnerWishlist}
                                onChange={(e) => setFilterPartnerWishlist(e.target.checked)}
                              />
                              <span>Only show cards matching {activePartner.username}'s Wishlist</span>
                            </label>
                            <span className="count-label">{filteredMyTradelist.length} cards found</span>
                          </div>

                          {filteredMyTradelist.length === 0 ? (
                            <div className="steam-empty-box py-6">
                              No cards found. {filterPartnerWishlist && "Try unchecking the wishlist filter to see your entire tradelist!"}
                            </div>
                          ) : (
                            <div className="steam-inv-grid">
                              {filteredMyTradelist.map((card) => {
                                const image = getCardImage(card.card_name, card.set_code);
                                const isAdded = offer.find(o => o.card_name === card.card_name);
                                const currentQty = isAdded ? isAdded.quantity : 0;
                                const remainingQty = card.quantity - currentQty;

                                return (
                                  <div 
                                    key={card.id} 
                                    className={`steam-inv-card ${card.is_foil ? "foil-rainbow" : ""} ${remainingQty <= 0 ? "depleted" : ""}`}
                                    onClick={() => remainingQty > 0 && handleAddToOffer(card)}
                                    onMouseEnter={() => setInspectedCard(card)}
                                  >
                                    <div className="inv-img-wrap">
                                      <img src={image} alt={card.card_name} className="inv-card-img" />
                                      {card.is_foil && <span className="foil-pill">Foil</span>}
                                      {card.set_code && <span className="set-badge">{card.set_code.toUpperCase()}</span>}
                                    </div>
                                    <div className="inv-quantity-badge">Qty: {card.quantity}</div>
                                    {currentQty > 0 && <div className="added-overlay">In Trade: {currentQty}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right section: Selected Card Inspector Sidebar */}
                <div className="steam-inspector-sidebar">
                  <h3>Card Inspector</h3>
                  {inspectedCard ? (
                    <div className="inspector-card-details">
                      <div className={`inspector-img-wrapper ${inspectedCard.is_foil ? "foil-rainbow" : ""}`}>
                        <img 
                          src={getCardImage(inspectedCard.card_name, inspectedCard.set_code)} 
                          alt={inspectedCard.card_name} 
                          className="inspector-large-img"
                        />
                      </div>
                      <div className="inspector-details-list">
                        <h4>{inspectedCard.card_name}</h4>
                        {inspectedCard.set_code && (
                          <div className="detail-item">
                            <span className="lbl">Set Printing:</span>
                            <span className="val">{inspectedCard.set_code.toUpperCase()} ({inspectedCard.collector_number || "#?"})</span>
                          </div>
                        )}
                        <div className="detail-item">
                          <span className="lbl">Finish:</span>
                          <span className={`val ${inspectedCard.is_foil ? "text-emerald-400 font-bold" : ""}`}>
                            {inspectedCard.is_foil ? "✨ Foil Printing" : "Normal Non-Foil"}
                          </span>
                        </div>
                        {/* Render prices if available */}
                        {getCardPrices(inspectedCard.card_name).usd && (
                          <div className="detail-item price">
                            <span className="lbl">Est. Price (Normal):</span>
                            <span className="val">${getCardPrices(inspectedCard.card_name).usd}</span>
                          </div>
                        )}
                        {getCardPrices(inspectedCard.card_name).usd_foil && (
                          <div className="detail-item price">
                            <span className="lbl">Est. Price (Foil):</span>
                            <span className="val">${getCardPrices(inspectedCard.card_name).usd_foil}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="inspector-placeholder">
                      <div className="placeholder-icon">🔍</div>
                      <p>Hover or click a card in the grids to inspect details, price rankings, and set printing metadata.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
