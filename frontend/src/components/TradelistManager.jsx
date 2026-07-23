// src/components/TradelistManager.jsx
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import "../styles/tradelist.css";

export default function TradelistManager() {
  const [activeTab, setActiveTab] = useState("trading"); // "trading" or "manage"
  
  // State for Manage My Tradelist
  const [tradelist, setTradelist] = useState([]);
  const [myOwnedCollection, setMyOwnedCollection] = useState([]);
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

  // State for Trade History & Ledger
  const [ledgerData, setLedgerData] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPartnerFilter, setHistoryPartnerFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [expandedTradeId, setExpandedTradeId] = useState(null);

  // Active Trades Hub State
  const [activeTrades, setActiveTrades] = useState([]);
  const [loadingActiveTrades, setLoadingActiveTrades] = useState(false);
  const [activeTradeFilter, setActiveTradeFilter] = useState("all");
  const [counterTrade, setCounterTrade] = useState(null);
  const [counterOffer, setCounterOffer] = useState([]);
  const [counterDemand, setCounterDemand] = useState([]);

  const loadActiveTrades = async () => {
    setLoadingActiveTrades(true);
    try {
      const res = await api.getActiveTrades();
      setActiveTrades(res || []);
    } catch (e) {
      console.error("Failed to load active trades:", e);
    } finally {
      setLoadingActiveTrades(false);
    }
  };

  const handleTradeAction = async (tradeId, action, counterOff = null, counterDem = null) => {
    if (action === "counter") {
      setTradeMessage("🔍 Querying Scryfall API for live card prices...");
      setExecutingTrade(true);
    }
    try {
      const res = await api.tradeAction(tradeId, action, counterOff, counterDem);
      if (res && res.error) {
        alert(`Error: ${res.error}`);
        return;
      }
      setCounterTrade(null);
      loadActiveTrades();
      loadMatches();
      loadHistoryAndLedger();
    } catch (e) {
      console.error("Failed to execute trade action:", e);
      alert("Failed to update trade.");
    } finally {
      if (action === "counter") {
        setExecutingTrade(false);
      }
    }
  };

  const loadHistoryAndLedger = async () => {
    setLoadingHistory(true);
    try {
      const [ledgerRes, historyRes] = await Promise.all([
        api.getTradeLedger(),
        api.getTradeHistory()
      ]);
      setLedgerData(ledgerRes || []);
      setTradeHistory(historyRes || []);

      const cardNames = [];
      (historyRes || []).forEach(t => {
        (t.items || []).forEach(i => cardNames.push(i.card_name));
      });
      if (cardNames.length > 0) {
        fetchCardMetadataBatch(cardNames);
      }
    } catch (e) {
      console.error("Failed to load trade history & ledger:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistoryAndLedger();
      loadPartners();
    } else if (activeTab === "active") {
      loadActiveTrades();
    }
  }, [activeTab]);

  // Load My Tradelist & Check URL tab params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    if (tabParam && ["trading", "active", "manage", "history"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    loadTradelist();
    loadMyWishlist();
    loadActiveTrades();
  }, []);

  // Load matches and partners when entering Trading tab
  useEffect(() => {
    if (activeTab === "trading") {
      loadMatches();
      loadPartners();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "trading" && !activePartner && partners.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const partnerId = urlParams.get("partner");
      if (partnerId) {
        const p = partners.find(usr => String(usr.id) === partnerId);
        if (p) setActivePartner(p);
      }
    }
  }, [activeTab, partners, activePartner]);

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

      const [resTrade, resOwned] = await Promise.all([
        fetch("/api/collection/tradelist", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/collection/owned", { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let tradeData = [];
      let ownedData = [];

      if (resTrade.ok) {
        tradeData = await resTrade.json();
        setTradelist(tradeData || []);
      }
      if (resOwned.ok) {
        ownedData = await resOwned.json();
        setMyOwnedCollection(ownedData || []);
      }

      const allCards = [...(tradeData || []), ...(ownedData || [])];
      fetchCardMetadataBatch(allCards.map(c => c.card_name));
    } catch (e) {
      console.error("Failed to load tradelist/owned collection:", e);
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
      
      const cardNames = [];
      res.forEach(match => {
        match.theyWant.forEach(c => cardNames.push(c.card_name));
        match.youWant.forEach(c => cardNames.push(c.card_name));
      });
      fetchCardMetadataBatch(cardNames);
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

  const updateWishlistCardDetails = async (card, updates) => {
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

      const res = await fetch("/api/collection/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadMyWishlist();
      }
    } catch (e) {
      console.error("Failed to update wishlist card:", e);
    }
  };

  const deleteWishlistCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/collection/wishlist", {
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
        loadMyWishlist();
      }
    } catch (e) {
      console.error("Failed to remove wishlist card:", e);
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
    setTradeMessage("🔍 Querying Scryfall API for live card prices...");
    try {
      const res = await api.executeTrade(activePartner.id, offer, demand);
      if (res.success) {
        setTradeMessage("🎉 Trade proposed successfully with fresh Scryfall prices!");
        setOffer([]);
        setDemand([]);
        // Reload inventories
        loadTradelist();
        loadMyWishlist();
        loadPartnerInventory(activePartner.id);
        // Refresh matches
        loadMatches();
        loadActiveTrades();
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

  // Helper to calculate lowest market price among all printings (Market Low / Red)
  const getMarketLowPrice = (cardItem) => {
    if (!cardItem) return 0;
    const cardName = cardItem.card_name || cardItem.name;

    // 1. Direct market_low property on card item
    const directLow = parseFloat(cardItem.market_low) || 0;
    if (directLow > 0) return directLow;

    // 2. Prints metadata lookup for lowest printing price
    if (cardName && printsCache[cardName]) {
      const cardMeta = printsCache[cardName];
      const lowest = parseFloat(cardMeta.prices?.lowest);
      if (!isNaN(lowest) && lowest > 0) return lowest;

      if (cardMeta.prints && cardMeta.prints.length > 0) {
        const allPrices = cardMeta.prints
          .map(p => Math.min(parseFloat(p.prices?.usd) || Infinity, parseFloat(p.prices?.usd_foil) || Infinity))
          .filter(p => isFinite(p) && p > 0);
        if (allPrices.length > 0) return Math.min(...allPrices);
      }
    }

    // 3. Fallback to direct price/market_price
    return parseFloat(cardItem.market_price) || parseFloat(cardItem.price) || 0;
  };

  // Helper to calculate exact printing price (Printing Specific / Green) with fallback to Market Low if unpriced
  const getCardPrice = (cardItem) => {
    if (!cardItem) return 0;
    const cardName = cardItem.card_name || cardItem.name;

    // 1. Direct market_price or price on card item
    const directPrice = parseFloat(cardItem.price) || parseFloat(cardItem.market_price) || 0;
    if (directPrice > 0) return directPrice;

    // 2. Prints metadata cache lookup
    if (cardName && printsCache[cardName]) {
      const cardMeta = printsCache[cardName];
      let activePrint = null;
      if (cardMeta.prints && cardItem.set_code) {
        activePrint = cardMeta.prints.find(p => 
          p.set?.toUpperCase() === cardItem.set_code?.toUpperCase() && 
          (!cardItem.collector_number || p.collector_number === cardItem.collector_number)
        );
      }
      if (!activePrint) activePrint = cardMeta;

      const prices = activePrint.prices || cardMeta.prices || {};
      const priceVal = cardItem.is_foil
        ? (prices.usd_foil || prices.usd || prices.usd_etched)
        : (prices.usd || prices.usd_foil || prices.usd_etched);

      const parsed = parseFloat(priceVal);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // 3. Fallback for unpriced / unreleased printing -> Market Low
    return getMarketLowPrice(cardItem);
  };

  const getCardPrices = (cardName, setCode, collectorNumber) => {
    const meta = printsCache[cardName];
    if (!meta) return {};
    if (meta.prints && setCode) {
      const print = meta.prints.find(p => 
        p.set?.toUpperCase() === setCode?.toUpperCase() &&
        (!collectorNumber || p.collector_number === collectorNumber)
      );
      if (print && print.prices) return print.prices;
    }
    return meta?.prices || {};
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "$0.00";
    const num = Number(val);
    if (num <= 0) return "$0.00";
    return `$${num.toFixed(2)}`;
  };

  // Totals for trade calculations
  const totalTradelistValue = tradelist.reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);
  const totalWishlistValue = myWishlist.reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);
  const offerValue = offer.reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);
  const demandValue = demand.reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);

  // Render Steam grid slots (fixed 8 slots, or more if offer length > 8)
  const renderSteamSlots = (items, onRemove, isMine) => {
    const slotCount = Math.max(8, items.length);
    const slots = [];
    
    for (let i = 0; i < slotCount; i++) {
      const item = items[i];
      if (item) {
        const image = getCardImage(item.card_name, item.set_code);
        const itemPrice = getCardPrice(item);
        slots.push(
          <div 
            key={i} 
            className={`steam-slot filled ${item.is_foil ? "foil-rainbow" : ""}`}
            onClick={() => onRemove(item)}
            onMouseEnter={() => setInspectedCard(item)}
          >
            <img src={image} alt={item.card_name} className="steam-slot-img" />
            <div className="steam-slot-price-badge">
              {formatPrice(itemPrice * item.quantity)}
            </div>
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

  // Filters for Inventories (Collection = Owned cards available to give)
  const filteredMyTradelist = (myOwnedCollection.length > 0 ? myOwnedCollection : tradelist).filter(item => {
    if (activePartner && filterPartnerWishlist) {
      const partnerWishNames = partnerInventory
        .filter(c => c.list_type === "wishlist" || c.list_type === "tradelist")
        .map(c => c.card_name.toLowerCase());
      return partnerWishNames.includes(item.card_name.toLowerCase());
    }
    return true;
  });

  const partnerCollection = partnerInventory.filter(c => c.list_type === "owned");
  const filteredPartnerTradelist = (partnerCollection.length > 0 ? partnerCollection : partnerInventory.filter(c => c.list_type === "tradelist")).filter(item => {
    if (filterMyWishlist) {
      const myWantNames = [...myWishlist, ...tradelist].map(c => c.card_name.toLowerCase());
      return myWantNames.includes(item.card_name.toLowerCase());
    }
    return true;
  });

  const filteredTradeHistory = tradeHistory.filter(t => {
    if (historyPartnerFilter !== "all" && String(t.partner_id) !== String(historyPartnerFilter)) {
      return false;
    }
    if (historyStatusFilter !== "all" && t.status !== historyStatusFilter) {
      return false;
    }
    return true;
  });

  const filteredActiveTrades = activeTrades.filter(t => {
    if (activeTradeFilter === "outbound") return t.is_outbound && t.status !== "accepted";
    if (activeTradeFilter === "inbound") return !t.is_outbound && t.status !== "accepted";
    if (activeTradeFilter === "accepted") return t.status === "accepted";
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
          className={`steam-tab-btn ${activeTab === "active" ? "active" : ""}`}
          onClick={() => { setActiveTab("active"); loadActiveTrades(); }}
        >
          ⚡ Active Trades {activeTrades.length > 0 && <span style={{ marginLeft: "0.4rem", background: "rgba(59,130,246,0.3)", color: "#93c5fd", borderRadius: "10px", padding: "2px 8px", fontSize: "0.75rem", fontWeight: 700 }}>{activeTrades.length}</span>}
        </button>
        <button 
          className={`steam-tab-btn ${activeTab === "manage" ? "active" : ""}`}
          onClick={() => setActiveTab("manage")}
        >
          ⚙️ Manage My Tradelist
        </button>
        <button 
          className={`steam-tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📜 Trade History & Ledger
        </button>
      </div>

      {activeTab === "manage" ? (
        /* MANAGE MY TRADELIST TAB */
        <>
          <div className="collection-header">
            <div>
              <h1 className="collection-title">🤝 Tradelist Manager</h1>
              <p className="collection-subtitle">
                Track cards you do not need for proxy orders but would like to trade.
                {totalTradelistValue > 0 && (
                  <span className="tradelist-total-badge"> Est. Total Value: {formatPrice(totalTradelistValue)}</span>
                )}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <details style={{ background: "rgba(30,41,59,0.5)", borderRadius: "8px", padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
              <summary style={{ cursor: "pointer", fontWeight: "bold", fontSize: "1.1rem" }}>
                🖨️ Proxy Wishlist Drawer ({myWishlist.length} {totalWishlistValue > 0 ? `• Est. Total: ${formatPrice(totalWishlistValue)}` : ""})
              </summary>
              <div className="csv-table-wrapper" style={{ marginTop: "1rem" }}>
                {myWishlist.length === 0 ? (
                  <div className="table-empty">Your proxy wishlist is currently empty.</div>
                ) : (
                  <table className="csv-table">
                    <thead>
                      <tr>
                        <th className="col-qty">Quantity</th>
                        <th className="col-name">Card Name</th>
                        <th className="col-print">Printing</th>
                        <th className="col-foil">Finish</th>
                        <th className="col-price">Est. Price</th>
                        <th className="col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myWishlist.map((card) => {
                        const price = getCardPrice(card);
                        const lineTotal = price * card.quantity;
                        return (
                          <tr key={card.id}>
                            <td className="col-qty">
                              <div className="qty-picker-compact">
                                <button onClick={() => updateWishlistCardDetails(card, { quantity: card.quantity - 1 })}>-</button>
                                <span>{card.quantity}</span>
                                <button onClick={() => updateWishlistCardDetails(card, { quantity: card.quantity + 1 })}>+</button>
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
                                          updateWishlistCardDetails(card, {
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
                                  onChange={(e) => updateWishlistCardDetails(card, { is_foil: e.target.checked })}
                                />
                                <span className="slider round"></span>
                                <span className="foil-label">{card.is_foil ? "Foil" : "Normal"}</span>
                              </label>
                            </td>
                            <td className="col-price font-bold">
                              <span>
                                <span className="price-tag-emerald">{formatPrice(lineTotal)}</span>
                                {card.quantity > 1 && <span className="unit-price-sub"> ({formatPrice(price)} ea)</span>}
                              </span>
                            </td>
                            <td className="col-actions">
                              <button 
                                className="table-delete-btn"
                                onClick={() => deleteWishlistCard(card)}
                                title="Remove card"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </details>
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
                    <th className="col-price">Est. Price</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tradelist.map((card) => {
                    const price = getCardPrice(card);
                    const lineTotal = price * card.quantity;
                    return (
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
                        <td className="col-price font-bold">
                          <span>
                            <span className="price-tag-emerald">{formatPrice(lineTotal)}</span>
                            {card.quantity > 1 && <span className="unit-price-sub"> ({formatPrice(price)} ea)</span>}
                          </span>
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : activeTab === "active" ? (
        /* ACTIVE TRADES HUB TAB */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Header & Filter Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 className="collection-title">⚡ Active Trades</h1>
              <p className="collection-subtitle">
                Review inbound trade proposals, track outbound proposals, and complete accepted physical exchanges.
              </p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                className={`steam-tab-btn ${activeTradeFilter === "all" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
                onClick={() => setActiveTradeFilter("all")}
              >
                All Active ({activeTrades.length})
              </button>
              <button
                className={`steam-tab-btn ${activeTradeFilter === "outbound" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
                onClick={() => setActiveTradeFilter("outbound")}
              >
                📤 Outbound ({activeTrades.filter(t => t.is_outbound && t.status !== "accepted").length})
              </button>
              <button
                className={`steam-tab-btn ${activeTradeFilter === "inbound" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
                onClick={() => setActiveTradeFilter("inbound")}
              >
                📥 Inbound ({activeTrades.filter(t => !t.is_outbound && t.status !== "accepted").length})
              </button>
              <button
                className={`steam-tab-btn ${activeTradeFilter === "accepted" ? "active" : ""}`}
                style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}
                onClick={() => setActiveTradeFilter("accepted")}
              >
                🤝 Accepted ({activeTrades.filter(t => t.status === "accepted").length})
              </button>
            </div>
          </div>

          {/* Counter Offer Modal / Interface if counterTrade is active */}
          {counterTrade ? (
            <div className="setup-card" style={{ padding: "1.5rem", background: "rgba(30, 41, 59, 0.6)", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, color: "#60a5fa" }}>✏️ Construct Counter Offer for {counterTrade.partner_username}</h3>
                <button className="steam-btn secondary compact" onClick={() => setCounterTrade(null)}>Cancel</button>
              </div>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Modify the offered and requested cards to send a revised counter-proposal.
              </p>

              {(() => {
                const counterOfferTotal = counterOffer.reduce((sum, item) => sum + ((item.price || item.market_price || getCardPrice(item) || 0) * (item.quantity || 1)), 0);
                const counterDemandTotal = counterDemand.reduce((sum, item) => sum + ((item.price || item.market_price || getCardPrice(item) || 0) * (item.quantity || 1)), 0);
                const counterNetVal = counterDemandTotal - counterOfferTotal;

                return (
                  <>
                    <div className="matrix-columns-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                      {/* Your Offer Column */}
                      <div className="matrix-sub-column" style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                          <h4 style={{ margin: 0, color: "#f8fafc" }}>🎒 What You Give (Offer)</h4>
                          <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600 }}>{formatPrice(counterOfferTotal)}</span>
                        </div>
                        {counterOffer.length === 0 ? (
                          <p style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>No cards selected in your offer.</p>
                        ) : (
                          counterOffer.map((item, idx) => {
                            const cardPrice = item.price || item.market_price || getCardPrice(item) || 0;
                            const cardImage = getCardImage(item.card_name, item.set_code);

                            return (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.04)", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                  <img src={cardImage} alt={item.card_name} style={{ width: "32px", height: "44px", borderRadius: "4px", objectFit: "cover" }} />
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                      <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>{item.card_name}</span>
                                      {item.quantity > 1 && <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700 }}>x{item.quantity}</span>}
                                      {item.set_code && <span className="set-badge" style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}>{item.set_code.toUpperCase()}</span>}
                                      {Boolean(item.is_foil) && <span style={{ color: "#f59e0b", fontSize: "0.75rem" }}>★ Foil</span>}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: "2px" }}>
                                      {formatPrice(cardPrice * (item.quantity || 1))} {item.quantity > 1 ? `(${formatPrice(cardPrice)} ea)` : ""}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem" }}
                                  onClick={() => {
                                    const next = [...counterOffer];
                                    next.splice(idx, 1);
                                    setCounterOffer(next);
                                  }}
                                  title="Remove card"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                        {/* Quick add dropdown from my tradelist/inventory */}
                        <div style={{ marginTop: "1rem" }}>
                          <select
                            className="table-input set-select"
                            style={{ width: "100%", padding: "0.5rem" }}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const card = JSON.parse(e.target.value);
                              setCounterOffer(prev => [...prev, { card_name: card.card_name, set_code: card.set_code || "", is_foil: !!card.is_foil, quantity: 1, price: getCardPrice(card) }]);
                              e.target.value = "";
                            }}
                          >
                            <option value="">+ Add card from your inventory...</option>
                            {(myOwnedCollection.length > 0 ? myOwnedCollection : tradelist).map((c, i) => (
                              <option key={i} value={JSON.stringify(c)}>{c.card_name} ({c.set_code ? c.set_code.toUpperCase() : "N/A"}) - {formatPrice(getCardPrice(c))}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Your Demand Column */}
                      <div className="matrix-sub-column" style={{ background: "rgba(15, 23, 42, 0.4)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                          <h4 style={{ margin: 0, color: "#f8fafc" }}>🎁 What You Receive (Demand)</h4>
                          <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: 600 }}>{formatPrice(counterDemandTotal)}</span>
                        </div>
                        {counterDemand.length === 0 ? (
                          <p style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>No cards selected in your demand.</p>
                        ) : (
                          counterDemand.map((item, idx) => {
                            const cardPrice = item.price || item.market_price || getCardPrice(item) || 0;
                            const cardImage = getCardImage(item.card_name, item.set_code);

                            return (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.04)", borderRadius: "8px", marginBottom: "0.5rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                  <img src={cardImage} alt={item.card_name} style={{ width: "32px", height: "44px", borderRadius: "4px", objectFit: "cover" }} />
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                      <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>{item.card_name}</span>
                                      {item.quantity > 1 && <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700 }}>x{item.quantity}</span>}
                                      {item.set_code && <span className="set-badge" style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}>{item.set_code.toUpperCase()}</span>}
                                      {Boolean(item.is_foil) && <span style={{ color: "#f59e0b", fontSize: "0.75rem" }}>★ Foil</span>}
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "#38bdf8", marginTop: "2px" }}>
                                      {formatPrice(cardPrice * (item.quantity || 1))} {item.quantity > 1 ? `(${formatPrice(cardPrice)} ea)` : ""}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem" }}
                                  onClick={() => {
                                    const next = [...counterDemand];
                                    next.splice(idx, 1);
                                    setCounterDemand(next);
                                  }}
                                  title="Remove card"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                        {/* Quick add dropdown from partner's inventory */}
                        <div style={{ marginTop: "1rem" }}>
                          <select
                            className="table-input set-select"
                            style={{ width: "100%", padding: "0.5rem" }}
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const card = JSON.parse(e.target.value);
                              setCounterDemand(prev => [...prev, { card_name: card.card_name, set_code: card.set_code || "", is_foil: !!card.is_foil, quantity: 1, price: getCardPrice(card) }]);
                              e.target.value = "";
                            }}
                          >
                            <option value="">+ Add card from {counterTrade.partner_username}'s collection...</option>
                            {partnerInventory.filter(c => c.list_type === "tradelist" || c.list_type === "owned").map((c, i) => (
                              <option key={i} value={JSON.stringify(c)}>{c.card_name} ({c.set_code ? c.set_code.toUpperCase() : "N/A"}) - {formatPrice(getCardPrice(c))}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap", gap: "1rem" }}>
                      <div style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                        Value Delta: <strong style={{ color: counterNetVal >= 0 ? "#34d399" : "#f87171" }}>{counterNetVal >= 0 ? `+${formatPrice(counterNetVal)} in your favor` : `-${formatPrice(Math.abs(counterNetVal))} in partner's favor`}</strong>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem" }}>
                        <button
                          className="steam-btn primary"
                          onClick={() => handleTradeAction(counterTrade.id, "counter", counterOffer, counterDemand)}
                        >
                          🚀 Send Counter Proposal
                        </button>
                        <button className="steam-btn secondary" onClick={() => setCounterTrade(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            /* Active Trades List */
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {loadingActiveTrades ? (
                <div className="table-loading">Loading active trades...</div>
              ) : filteredActiveTrades.length === 0 ? (
                <div className="table-empty" style={{ background: "rgba(30,41,59,0.3)", borderRadius: "12px", textAlign: "center", padding: "3rem" }}>
                  <p style={{ margin: 0, fontSize: "1rem", color: "#94a3b8" }}>
                    {activeTradeFilter === "all" ? "No active trades currently pending." : `No ${activeTradeFilter} trades found.`}
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                    Use the Playgroup Trading tab to find matches and propose a new trade.
                  </p>
                  <button className="steam-btn primary" style={{ marginTop: "1rem", display: "inline-block" }} onClick={() => setActiveTab("trading")}>
                    🤝 Find Trade Matches
                  </button>
                </div>
              ) : (
                filteredActiveTrades.map((trade) => {
                  const offerTotal = trade.offer.reduce((sum, item) => sum + ((item.market_price || 0) * (item.quantity || 1)), 0);
                  const demandTotal = trade.demand.reduce((sum, item) => sum + ((item.market_price || 0) * (item.quantity || 1)), 0);
                  const netVal = demandTotal - offerTotal;

                  let badgeBg = "rgba(59, 130, 246, 0.15)";
                  let badgeColor = "#60a5fa";
                  let badgeText = "";

                  if (trade.status === "accepted") {
                    badgeBg = "rgba(16, 185, 129, 0.15)";
                    badgeColor = "#34d399";
                    badgeText = "🤝 Accepted • Awaiting Physical Completion";
                  } else if (trade.is_outbound) {
                    badgeBg = "rgba(245, 158, 11, 0.15)";
                    badgeColor = "#fbbf24";
                    badgeText = trade.status === "countered" ? "📤 Counter Offered • Waiting for Partner" : "📤 Outbound Proposal • Pending Response";
                  } else {
                    badgeBg = "rgba(99, 102, 241, 0.2)";
                    badgeColor = "#818cf8";
                    badgeText = trade.status === "countered" ? "📥 Counter Offer Received • Action Needed" : "📥 Inbound Proposal • Action Needed";
                  }

                  return (
                    <div
                      key={trade.id}
                      style={{
                        background: "rgba(30, 41, 59, 0.4)",
                        border: trade.status === "accepted" ? "1px solid rgba(52, 211, 153, 0.3)" : trade.is_outbound ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(99, 102, 241, 0.3)",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                      }}
                    >
                      {/* Trade Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span>Trade with <strong style={{ color: "#38bdf8" }}>@{trade.partner_username}</strong></span>
                          </h3>
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            Last updated: {new Date(trade.updated_at).toLocaleString()}
                          </span>
                        </div>

                        <span
                          style={{
                            background: badgeBg,
                            color: badgeColor,
                            padding: "0.35rem 0.85rem",
                            borderRadius: "20px",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            border: `1px solid ${badgeColor}40`
                          }}
                        >
                          {badgeText}
                        </span>
                      </div>

                      {/* Offer vs Demand Side-by-side */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                        {/* You Give */}
                        <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              🎒 You Give ({trade.offer.length})
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "#38bdf8", fontWeight: 600 }}>
                              {formatPrice(offerTotal)}
                            </span>
                          </div>

                          {trade.offer.length === 0 ? (
                            <span style={{ color: "#64748b", fontSize: "0.8rem", fontStyle: "italic" }}>No cards offered</span>
                          ) : (
                            trade.offer.map((item, idx) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#cbd5e1", padding: "0.25rem 0", borderBottom: idx < trade.offer.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                                <span>{item.card_name} {item.quantity > 1 ? `x${item.quantity}` : ""} {item.is_foil ? "★" : ""}</span>
                                <span style={{ color: "#94a3b8" }}>{formatPrice((item.market_price || 0) * (item.quantity || 1))}</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* You Receive */}
                        <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f8fafc", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              🎁 You Receive ({trade.demand.length})
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "#38bdf8", fontWeight: 600 }}>
                              {formatPrice(demandTotal)}
                            </span>
                          </div>

                          {trade.demand.length === 0 ? (
                            <span style={{ color: "#64748b", fontSize: "0.8rem", fontStyle: "italic" }}>No cards requested</span>
                          ) : (
                            trade.demand.map((item, idx) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#cbd5e1", padding: "0.25rem 0", borderBottom: idx < trade.demand.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                                <span>{item.card_name} {item.quantity > 1 ? `x${item.quantity}` : ""} {item.is_foil ? "★" : ""}</span>
                                <span style={{ color: "#94a3b8" }}>{formatPrice((item.market_price || 0) * (item.quantity || 1))}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Financial Summary & Actions Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", gap: "0.75rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                          Value Delta: <strong style={{ color: netVal >= 0 ? "#34d399" : "#f87171" }}>{netVal >= 0 ? `+${formatPrice(netVal)} in your favor` : `-${formatPrice(Math.abs(netVal))} in partner's favor`}</strong>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {trade.status === "accepted" ? (
                            <>
                              <button
                                className="steam-btn primary compact"
                                onClick={() => handleTradeAction(trade.id, "complete")}
                              >
                                🎉 Mark as Completed
                              </button>
                              <button
                                className="steam-btn secondary compact"
                                onClick={() => handleTradeAction(trade.id, "decline")}
                              >
                                Cancel Trade
                              </button>
                            </>
                          ) : !trade.is_outbound ? (
                            /* Inbound Trade Actions */
                            <>
                              <button
                                className="steam-btn primary compact"
                                style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                                onClick={() => handleTradeAction(trade.id, "accept")}
                              >
                                ✅ Accept Trade
                              </button>
                              <button
                                className="steam-btn secondary compact"
                                style={{ borderColor: "#3b82f6", color: "#60a5fa" }}
                                onClick={() => {
                                  setCounterTrade(trade);
                                  setCounterOffer([...trade.offer]);
                                  setCounterDemand([...trade.demand]);
                                  if (trade.partner_id) loadPartnerInventory(trade.partner_id);
                                }}
                              >
                                ✏️ Counter Offer
                              </button>
                              <button
                                className="steam-btn secondary compact"
                                style={{ borderColor: "#ef4444", color: "#f87171" }}
                                onClick={() => handleTradeAction(trade.id, "decline")}
                              >
                                ❌ Decline
                              </button>
                            </>
                          ) : (
                            /* Outbound Trade Actions */
                            <>
                              <button
                                className="steam-btn secondary compact"
                                style={{ borderColor: "#3b82f6", color: "#60a5fa" }}
                                onClick={() => {
                                  setCounterTrade(trade);
                                  setCounterOffer([...trade.offer]);
                                  setCounterDemand([...trade.demand]);
                                  if (trade.partner_id) loadPartnerInventory(trade.partner_id);
                                }}
                              >
                                ✏️ Revise Offer
                              </button>
                              <button
                                className="steam-btn secondary compact"
                                style={{ borderColor: "#ef4444", color: "#f87171" }}
                                onClick={() => handleTradeAction(trade.id, "decline")}
                              >
                                🚫 Withdraw Proposal
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : activeTab === "history" ? (
        /* TRADE HISTORY & LEDGER TAB */
        <div className="trade-history-wrapper">
          <div className="collection-header">
            <div>
              <h1 className="collection-title">📜 Trade History & Per-User Ledger</h1>
              <p className="collection-subtitle">
                View your per-user card balance ledger and track all historical playgroup trades.
              </p>
            </div>
            <button 
              className="steam-btn secondary"
              onClick={loadHistoryAndLedger}
              disabled={loadingHistory}
            >
              {loadingHistory ? "🔄 Refreshing..." : "🔄 Refresh History"}
            </button>
          </div>

          {/* Section 1: Per-User Ledger */}
          <div className="ledger-section">
            <div className="steam-section-header">
              <h2>📊 Per-User Debt & Credit Ledger</h2>
              <p>Net card value balances calculated from completed and accepted trades.</p>
            </div>

            {ledgerData.length === 0 ? (
              <div className="table-empty">No trade partners found in your playgroup.</div>
            ) : (
              <div className="ledger-cards-grid">
                {ledgerData.map((userLedger) => {
                  const net = userLedger.net_balance || 0;
                  const owesYou = net > 0;
                  const youOwe = net < 0;

                  return (
                    <div 
                      key={userLedger.partner_id} 
                      className={`ledger-card ${owesYou ? "credit" : youOwe ? "debt" : "even"}`}
                    >
                      <div className="ledger-card-header">
                        <div className="user-avatar-badge">
                          <img 
                            src={`https://api.dicebear.com/7.x/identicon/svg?seed=${userLedger.partner_username}`} 
                            alt={userLedger.partner_username} 
                            className="avatar-img"
                          />
                          <div className="user-text-info">
                            <h3 className="partner-name">{userLedger.partner_username}</h3>
                            <span className="partner-email">{userLedger.partner_email}</span>
                          </div>
                        </div>

                        <div className={`ledger-status-badge ${owesYou ? "credit" : youOwe ? "debt" : "even"}`}>
                          {owesYou && `🟢 ${userLedger.partner_username} owes you ${formatPrice(net)} in cards`}
                          {youOwe && `🔴 You owe ${userLedger.partner_username} ${formatPrice(Math.abs(net))} in cards`}
                          {!owesYou && !youOwe && `⚪ Settled / Even ($0.00)`}
                        </div>
                      </div>

                      <div className="ledger-stats-row">
                        <div className="stat-box">
                          <span className="stat-lbl">Given</span>
                          <span className="stat-val give-val">{formatPrice(userLedger.total_given_value)}</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-lbl">Received</span>
                          <span className="stat-val get-val">{formatPrice(userLedger.total_received_value)}</span>
                        </div>
                      </div>

                      <div className="ledger-card-actions">
                        <button 
                          className="steam-btn primary compact flex-1"
                          onClick={() => {
                            const p = partners.find(usr => String(usr.id) === String(userLedger.partner_id)) || { id: userLedger.partner_id, username: userLedger.partner_username };
                            setActivePartner(p);
                            setActiveTab("trading");
                          }}
                        >
                          🤝 Trade with {userLedger.partner_username}
                        </button>
                        <button
                          className="steam-btn secondary compact flex-1"
                          onClick={() => {
                            setHistoryPartnerFilter(String(userLedger.partner_id));
                          }}
                        >
                          🔍 Filter History
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: History Log */}
          <div className="history-log-section" style={{ marginTop: "2.5rem" }}>
            <div className="history-log-header">
              <div className="steam-section-header" style={{ marginBottom: 0 }}>
                <h2>📜 All Trades Log ({filteredTradeHistory.length})</h2>
                <p>Complete history of proposed, accepted, counter-offered, and completed trades.</p>
              </div>

              {/* Filter controls */}
              <div className="history-filters">
                <div className="filter-group">
                  <label>Partner:</label>
                  <select 
                    value={historyPartnerFilter} 
                    onChange={(e) => setHistoryPartnerFilter(e.target.value)}
                    className="steam-select"
                  >
                    <option value="all">All Partners</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.username}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={historyStatusFilter} 
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                    className="steam-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="accepted">Accepted</option>
                    <option value="proposed">Proposed</option>
                    <option value="countered">Countered</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingHistory ? (
              <div className="table-loading">Loading trade history...</div>
            ) : filteredTradeHistory.length === 0 ? (
              <div className="table-empty">No trade history matching selected filters.</div>
            ) : (
              <div className="history-cards-list">
                {filteredTradeHistory.map((trade) => {
                  const isExpanded = expandedTradeId === trade.id;

                  const offerVal = (trade.offer || []).reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);
                  const demandVal = (trade.demand || []).reduce((sum, item) => sum + (getCardPrice(item) * item.quantity), 0);
                  const netDelta = demandVal - offerVal;

                  return (
                    <div key={trade.id} className={`history-trade-card status-${trade.status}`}>
                      <div className="history-trade-header" onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}>
                        <div className="trade-meta-main">
                          <span className="trade-id-tag">Trade #{trade.id.substring(0, 8)}</span>
                          <span className="trade-date">{new Date(trade.updated_at || trade.created_at).toLocaleDateString()} {new Date(trade.updated_at || trade.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="trade-partner">With <strong>{trade.partner_username}</strong></span>
                        </div>

                        <div className="trade-meta-right">
                          <div className="trade-values-summary">
                            <span className="val-pill give">You Gave: {formatPrice(offerVal)}</span>
                            <span className="val-pill get">Received: {formatPrice(demandVal)}</span>
                            <span className={`val-pill net ${netDelta > 0 ? "credit" : netDelta < 0 ? "debt" : "even"}`}>
                              {netDelta > 0 ? `+${formatPrice(netDelta)}` : netDelta < 0 ? `-${formatPrice(Math.abs(netDelta))}` : `$0.00`}
                            </span>
                          </div>

                          <span className={`history-status-tag ${trade.status}`}>
                            {trade.status.toUpperCase()}
                          </span>

                          <button className="expand-toggle-btn">
                            {isExpanded ? "▲ Details" : "▼ Details"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="history-trade-details">
                          <div className="history-items-grid">
                            <div className="history-items-column">
                              <h4>Outbound (Given by You)</h4>
                              {trade.offer?.length === 0 ? (
                                <div className="empty-subtext">No cards offered</div>
                              ) : (
                                <div className="steam-slots-grid mini">
                                  {trade.offer.map((item, idx) => {
                                    const price = getCardPrice(item);
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`steam-slot filled compact ${item.is_foil ? "foil-rainbow" : ""}`}
                                        onMouseEnter={() => setInspectedCard(item)}
                                      >
                                        <img src={getCardImage(item.card_name, item.set_code)} alt={item.card_name} className="steam-slot-img" />
                                        <div className="steam-slot-price-badge">{formatPrice(price * item.quantity)}</div>
                                        <div className="steam-slot-badge">x{item.quantity}</div>
                                        <div className="card-name-hover-tooltip">{item.card_name}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="history-items-column">
                              <h4>Inbound (Received from {trade.partner_username})</h4>
                              {trade.demand?.length === 0 ? (
                                <div className="empty-subtext">No cards demanded</div>
                              ) : (
                                <div className="steam-slots-grid mini">
                                  {trade.demand.map((item, idx) => {
                                    const price = getCardPrice(item);
                                    return (
                                      <div 
                                        key={idx} 
                                        className={`steam-slot filled compact ${item.is_foil ? "foil-rainbow" : ""}`}
                                        onMouseEnter={() => setInspectedCard(item)}
                                      >
                                        <img src={getCardImage(item.card_name, item.set_code)} alt={item.card_name} className="steam-slot-img" />
                                        <div className="steam-slot-price-badge">{formatPrice(price * item.quantity)}</div>
                                        <div className="steam-slot-badge">x{item.quantity}</div>
                                        <div className="card-name-hover-tooltip">{item.card_name}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PLAYGROUP TRADING (STEAM STYLE) TAB */
        <div className="steam-trading-layout">
          
          {!activePartner ? (
            /* WISH LIST MATCHMAKER SCREEN */
            <div className="steam-matchmaker-container">
              <div className="steam-section-header">
                <h2>🤝 Playgroup Wishlist Matches</h2>
                <p>These are cards on your wishlist that members in your playgroup currently have in their collection.</p>
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
                  No wishlist matches found. Either your wishlist is empty, or no one in your playgroup has those cards in their collection.
                  <br />
                  <span className="sub">Tip: Go to the Wishlist tab and add cards, or have other members add cards to their collection!</span>
                </div>
              ) : (
                <div className="steam-user-matches-grid">
                  {wishlistMatches.map((match) => {
                    const { user, youWant, theyWant } = match;
                    const theyWantValue = theyWant.reduce((sum, c) => sum + (getCardPrice(c) * (c.quantity || 1)), 0);
                    const youWantValue = youWant.reduce((sum, c) => sum + (getCardPrice(c) * (c.quantity || 1)), 0);
                    const matchDiff = youWantValue - theyWantValue;

                    return (
                      <div key={user.id} className="steam-user-match-row">
                        <div className="user-match-header">
                          <div>
                            <h3>👤 {user.username}</h3>
                            {(theyWantValue > 0 || youWantValue > 0) && (
                              <span className={`match-value-balance ${matchDiff > 0 ? "positive" : matchDiff < 0 ? "negative" : "even"}`}>
                                {matchDiff === 0
                                  ? "Equal Value (~$0.00)"
                                  : matchDiff > 0
                                  ? `+${formatPrice(matchDiff)} value in your favor`
                                  : `${formatPrice(Math.abs(matchDiff))} value gap`}
                              </span>
                            )}
                          </div>
                          <button 
                            className="trade-initiate-btn"
                            onClick={() => {
                              const p = partners.find(usr => usr.id === user.id);
                              if (p) setActivePartner(p);
                            }}
                          >
                            Start Trade
                          </button>
                        </div>
                        <div className="user-match-body">
                          {/* Left side: They want */}
                          <div className="match-half they-want-half">
                            <span className="match-half-title">
                              Cards they want from you ({formatPrice(theyWantValue)})
                            </span>
                            <div className="match-mini-grid">
                              {theyWant.slice(0, 8).map((c, i) => (
                                <div key={i} className="mini-card-wrap">
                                  <img 
                                    src={getCardImage(c.card_name, c.set_code)} 
                                    alt={c.card_name} 
                                    title={`${c.card_name} (x${c.quantity}) - ${formatPrice(getCardPrice(c))}`} 
                                    className="mini-card-img" 
                                  />
                                  <span className="mini-card-price">{formatPrice(getCardPrice(c))}</span>
                                </div>
                              ))}
                              {theyWant.length > 8 && (
                                <div className="mini-card-more" title={`${theyWant.length - 8} more cards`}>...</div>
                              )}
                              {theyWant.length === 0 && <span className="no-cards-txt">None</span>}
                            </div>
                          </div>
                          
                          {/* Middle: Arrow */}
                          <div className="match-arrow-center">
                            ⟷
                          </div>

                          {/* Right side: You want */}
                          <div className="match-half you-want-half">
                            <span className="match-half-title">
                              Cards you want from them ({formatPrice(youWantValue)})
                            </span>
                            <div className="match-mini-grid">
                              {youWant.slice(0, 8).map((c, i) => (
                                <div key={i} className="mini-card-wrap">
                                  <img 
                                    src={getCardImage(c.card_name, c.set_code)} 
                                    alt={c.card_name} 
                                    title={`${c.card_name} (x${c.quantity}) - ${formatPrice(getCardPrice(c))}`} 
                                    className="mini-card-img" 
                                  />
                                  <span className="mini-card-price">{formatPrice(getCardPrice(c))}</span>
                                </div>
                              ))}
                              {youWant.length > 8 && (
                                <div className="mini-card-more" title={`${youWant.length - 8} more cards`}>...</div>
                              )}
                              {youWant.length === 0 && <span className="no-cards-txt">None</span>}
                            </div>
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
                      <p className="subtitle">
                        Cards you are giving {offerValue > 0 && <span className="offer-total-txt">• Total: {formatPrice(offerValue)}</span>}
                      </p>
                      <div className="slots-grid">
                        {renderSteamSlots(offer, handleRemoveFromOffer, true)}
                      </div>
                    </div>

                    {/* Right Column: Their Offer */}
                    <div className="steam-offer-side">
                      <h3>{activePartner.username}'s Offer</h3>
                      <p className="subtitle">
                        Cards you are receiving {demandValue > 0 && <span className="demand-total-txt">• Total: {formatPrice(demandValue)}</span>}
                      </p>
                      <div className="slots-grid">
                        {renderSteamSlots(demand, handleRemoveFromDemand, false)}
                      </div>
                    </div>
                  </div>

                  {/* Center Actions Bar */}
                  <div className="steam-actions-bar">
                    {/* Trade Balance Summary */}
                    {(offer.length > 0 || demand.length > 0) && (
                      <div className="trade-balance-box">
                        <div className="balance-col">
                          <span className="lbl">Your Offer</span>
                          <span className="val offer-val">{formatPrice(offerValue)}</span>
                        </div>
                        <div className="balance-vs">VS</div>
                        <div className="balance-col">
                          <span className="lbl">{activePartner.username}'s Offer</span>
                          <span className="val demand-val">{formatPrice(demandValue)}</span>
                        </div>
                        <div className="balance-col difference">
                          <span className="lbl">Value Balance</span>
                          {(() => {
                            const diff = demandValue - offerValue;
                            if (Math.abs(diff) < 0.01) {
                              return <span className="val even">Even Trade ($0.00)</span>;
                            } else if (diff > 0) {
                              return <span className="val positive">+{formatPrice(diff)} (In your favor)</span>;
                            } else {
                              return <span className="val negative">-{formatPrice(Math.abs(diff))} (In partner's favor)</span>;
                            }
                          })()}
                        </div>
                      </div>
                    )}

                    {tradeMessage && (
                      <div className={`trade-status-message ${tradeMessage.includes("success") || tradeMessage.includes("🎉") ? "success" : tradeMessage.includes("Querying") ? "info" : "error"}`}>
                        {tradeMessage}
                      </div>
                    )}
                    <div className="actions-buttons">
                      <button 
                        className="execute-trade-btn"
                        onClick={handleExecuteTrade}
                        disabled={executingTrade || (offer.length === 0 && demand.length === 0)}
                      >
                        {executingTrade ? "🔍 Querying Scryfall Prices..." : "Propose & Execute Trade"}
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
                        👤 {activePartner.username}'s Collection Inventory
                      </button>
                      <button 
                        className={`steam-inv-tab ${activeInventoryTab === "mine" ? "active" : ""}`}
                        onClick={() => setActiveInventoryTab("mine")}
                      >
                        🎒 Your Collection Inventory
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
                              No cards found. {filterMyWishlist && "Try unchecking the wishlist filter to see their entire collection!"}
                            </div>
                          ) : (
                            <div className="steam-inv-grid">
                              {filteredPartnerTradelist.map((card) => {
                                const image = getCardImage(card.card_name, card.set_code);
                                const isAdded = demand.find(d => d.card_name === card.card_name);
                                const currentQty = isAdded ? isAdded.quantity : 0;
                                const remainingQty = card.quantity - currentQty;
                                const cardPrice = getCardPrice(card);

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
                                      {cardPrice > 0 && (
                                        <span className="inv-price-badge">{formatPrice(cardPrice)}</span>
                                      )}
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
                                const cardPrice = getCardPrice(card);

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
                                      {cardPrice > 0 && (
                                        <span className="inv-price-badge">{formatPrice(cardPrice)}</span>
                                      )}
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
                        {/* Price breakdown: Market Low (Red) & Printing Specific (Green) */}
                        {(() => {
                          const printingPrice = getCardPrice(inspectedCard);
                          const marketLow = getMarketLowPrice(inspectedCard);
                          return (
                            <div className="inspector-price-section">
                              <div className="detail-item price-row low-price-row">
                                <span className="lbl" style={{ color: "#94a3b8", fontWeight: 600 }}>🔻 Market Low:</span>
                                <span className="val price-red">{formatPrice(marketLow)}</span>
                              </div>

                              <div className="detail-item price-row printing-price-row">
                                <span className="lbl" style={{ color: "#94a3b8", fontWeight: 600 }}>🏷️ Printing Specific:</span>
                                <span className="val price-green">{formatPrice(printingPrice)}</span>
                              </div>

                              {inspectedCard.quantity > 1 && (
                                <div className="inspector-total-row">
                                  Total (x{inspectedCard.quantity}): <span className="price-green font-bold">{formatPrice(printingPrice * inspectedCard.quantity)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
