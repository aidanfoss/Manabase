// src/components/WishlistHub.jsx
import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import "../styles/wishlist.css";

export default function WishlistHub() {
  const [activeTab, setActiveTab] = useState("lists"); // "lists", "nexus", "trades"
  const [selectedList, setSelectedList] = useState("proxy_wishlist");
  const [activeTrades, setActiveTrades] = useState([]);
  const [counterTrade, setCounterTrade] = useState(null);
  const [counterOffer, setCounterOffer] = useState([]);
  const [counterDemand, setCounterDemand] = useState([]);
  // Lists data states
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Playgroups states
  const [playgroups, setPlaygroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupWishlist, setGroupWishlist] = useState([]);
  const [groupInventory, setGroupInventory] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");

  // Print view state
  const [showPrintMode, setShowPrintMode] = useState(false);
  
  // Prints resolution cache
  const [printsCache, setPrintsCache] = useState({});
  const [selectedPrints, setSelectedPrints] = useState({}); // cardName -> print index

  // MPC print cost config (default $0.25)
  const [mpcUnitCost, setMpcUnitCost] = useState(0.25);

  useEffect(() => {
    loadLists();
    loadPlaygroups();
  }, []);

  useEffect(() => {
    if (activeGroup) {
      loadPlaygroupDetails(activeGroup.id);
    } else {
      setGroupMembers([]);
      setGroupWishlist([]);
      setGroupInventory([]);
    }
  }, [activeGroup]);

  // Load lists
  const loadLists = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Fetch Proxy Wishlist
      let newWishlist = [];
      let newTradeList = [];
      const resWish = await fetch("/api/lists/proxy_wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resWish.ok) {
        newWishlist = await resWish.json() || [];
        setWishlist(newWishlist);
      }

      // Fetch Trade List (removed)


      const uniqueNames = [...new Set([
        ...newWishlist.map(c => c.card_name)
      ])];
      
      if (uniqueNames.length > 0) {
        fetchPrintsBatch(uniqueNames, newWishlist);
      }
      
    } catch (e) {
      console.error("Failed to load lists:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrintsBatch = async (cardNames, wList) => {
    const namesToFetch = cardNames.filter(name => !printsCache[name]);
    console.log("📋 [WishlistHub] fetchPrintsBatch requested for:", cardNames, "Uncached to fetch:", namesToFetch);
    if (namesToFetch.length === 0) return;

    try {
      const batchResult = await api.getCardDetailsBatch(namesToFetch);
      console.log("📦 [WishlistHub] getCardDetailsBatch result keys:", Object.keys(batchResult || {}), batchResult);

      setPrintsCache(prev => {
        const next = { ...prev, ...batchResult };
        console.log("🗄️ [WishlistHub] Updated printsCache size:", Object.keys(next).length);
        return next;
      });

      setSelectedPrints(prev => {
        const next = { ...prev };
        const currentList = [...(wList || wishlist)];
        
        namesToFetch.forEach(cardName => {
          const cardData = batchResult[cardName];
          if (!cardData) {
            console.warn(`⚠️ [WishlistHub] No cardData returned for "${cardName}" in batch response!`);
          } else if (!cardData.prints || cardData.prints.length === 0) {
            console.warn(`⚠️ [WishlistHub] cardData for "${cardName}" has EMPTY prints array!`, cardData);
          } else {
            console.log(`✅ [WishlistHub] "${cardName}" has ${cardData.prints.length} printings.`);
          }

          if (cardData && cardData.prints) {
            const savedCard = currentList.find(c => c.card_name === cardName);
            if (savedCard && savedCard.set_code) {
              const matchIdx = cardData.prints.findIndex(p => p.set?.toUpperCase() === savedCard.set_code.toUpperCase());
              if (matchIdx !== -1) {
                next[cardName] = matchIdx;
                return;
              }
            }
            next[cardName] = 0;
          }
        });
        return next;
      });

    } catch (err) {
      console.error("❌ [WishlistHub] Failed to fetch card prints batch:", err);
    }
  };

  // Search autocomplete
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

  // Add card to current list
  const addCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = {
        card_name: card.name,
        list_kind: "proxy_wishlist",
        quantity: 1,
        set_code: (card.set || "").toUpperCase(),
        collector_number: card.collector_number || "",
        is_foil: false,
      };

      const res = await fetch("/api/lists", {
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
        loadLists();
      }
    } catch (e) {
      console.error("Failed to add card:", e);
    }
  };

  // Update card in list
  const updateCardDetails = async (card, updates) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = {
        card_name: card.card_name,
        list_kind: "proxy_wishlist",
        quantity: updates.quantity !== undefined ? updates.quantity : card.quantity,
        set_code: updates.set_code !== undefined ? updates.set_code : card.set_code,
        collector_number: updates.collector_number !== undefined ? updates.collector_number : card.collector_number,
        is_foil: updates.is_foil !== undefined ? updates.is_foil : card.is_foil,
        any_printing: updates.any_printing !== undefined ? updates.any_printing : card.any_printing,
        target_owner_id: updates.target_owner_id !== undefined ? updates.target_owner_id : card.target_owner_id
      };

      const res = await fetch("/api/lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadLists();
      }
    } catch (e) {
      console.error("Failed to update list item:", e);
    }
  };

  const handleSetAllAnyPrinting = async () => {
    if (!window.confirm("Are you sure you want to clear specific printing requirements for all wishlist cards in trades?")) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const itemsToUpdate = wishlist.filter(c => !c.any_printing);
      
      await Promise.all(itemsToUpdate.map(async (c) => {
        const cardMeta = printsCache[c.card_name];
        const defaultSet = cardMeta?.set?.toUpperCase() || c.set_code;
        const defaultNum = cardMeta?.collector_number || c.collector_number || "";

        await fetch(`/api/lists/${c.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            quantity: c.quantity,
            is_foil: c.is_foil,
            any_printing: true,
            set_code: defaultSet,
            collector_number: defaultNum,
            target_owner_id: c.target_owner_id
          })
        });
      }));
      
      // Clear print index cache for updated items
      setSelectedPrints(prev => {
        const next = { ...prev };
        itemsToUpdate.forEach(c => next[c.card_name] = 0);
        return next;
      });

      loadLists();
    } catch (e) {
      console.error(e);
    }
  };

  // Delete card from list
  const deleteCard = async (card) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`/api/lists/${card.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        loadLists();
      }
    } catch (e) {
      console.error("Failed to delete card:", e);
    }
  };

  // Change print set
  const handlePrintChange = (card, printIdx) => {
    setSelectedPrints(prev => ({ ...prev, [card.card_name]: printIdx }));
    const cardData = printsCache[card.card_name];
    if (cardData && cardData.prints?.[printIdx]) {
      const print = cardData.prints[printIdx];
      updateCardDetails(card, {
        set_code: print.set?.toUpperCase(),
        collector_number: print.collector_number || "",
      });
    }
  };

  // Playgroup service methods
  const loadPlaygroups = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/playgroups", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroups(data || []);
        if (data.length > 0 && !activeGroup) {
          setActiveGroup(data[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load playgroups:", e);
    }
  };

  const loadPlaygroupDetails = async (groupId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Fetch group members
      const membersRes = await fetch(`/api/playgroups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (membersRes.ok) setGroupMembers(await membersRes.json());

      // Fetch group bundled wishlists
      const wishlistRes = await fetch(`/api/playgroups/${groupId}/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wishlistRes.ok) setGroupWishlist(await wishlistRes.json());

      // Fetch group members physical inventory
      const invRes = await fetch(`/api/playgroups/${groupId}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (invRes.ok) setGroupInventory(await invRes.json());
    } catch (e) {
      console.error("Failed to fetch playgroup info:", e);
    }
  };

  
  const loadActiveTrades = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/trade/active", { headers: { Authorization: `Bearer ${token}` } });
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ partnerId, offer, demand })
      });
      if (res.ok) {
        alert("Trade proposed successfully!");
        loadActiveTrades();
        loadPlaygroups();
        if (activeGroup) loadPlaygroupDetails(activeGroup.id);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to propose trade.");
    }
  };

  const handleTradeAction = async (tradeId, action, offer = null, demand = null) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/trade/${tradeId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, offer, demand })
      });
      if (res.ok) {
        alert(`Trade ${action} successful!`);
        setCounterTrade(null);
        loadActiveTrades();
        loadLists();
        if (activeGroup) loadPlaygroupDetails(activeGroup.id);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert(`Failed to ${action} trade.`);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/playgroups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newGroupName.trim() })
      });
      if (res.ok) {
        const newGroup = await res.json();
        setNewGroupName("");
        loadPlaygroups();
        setActiveGroup(newGroup);
        alert(`Success! Created playgroup "${newGroup.name}"`);
      }
    } catch (e) {
      console.error("Failed to create playgroup:", e);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinGroupId.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/playgroups/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ playgroup_id: joinGroupId.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setJoinGroupId("");
        loadPlaygroups();
        alert(`Success! Joined playgroup: ${data.name}`);
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error}`);
      }
    } catch (e) {
      console.error("Failed to join playgroup:", e);
    }
  };

  const handleDownloadMpcJson = () => {
    if (groupWishlist.length === 0) return;
    
    // Active print queue (first 612)
    const printQueue = groupWishlist.slice(0, 612);

    const mpcfillData = {
      cards: printQueue.map(c => ({
        name: c.card_name,
        quantity: 1,
        set: c.set_code || "",
        collector_number: c.collector_number || "",
        foil: !!c.is_foil
      }))
    };

    const blob = new Blob([JSON.stringify(mpcfillData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeGroup?.name || "group"}_mpcfill_manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMpcCsv = () => {
    const currentList = wishlist;
    if (currentList.length === 0) return;

    const headers = "Quantity,Name,Set,Collector Number,Foil\r\n";
    const rows = currentList.map(c => 
      `${c.quantity},"${c.card_name}",${c.set_code || ""},${c.collector_number || ""},${c.is_foil ? "S" : ""}`
    ).join("\r\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mpc_proxy_wishlist_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMoxfield = () => {
    const currentList = wishlist;
    if (currentList.length === 0) return;

    const listText = currentList.map(c => `${c.quantity} ${c.card_name}`).join("\n");
    navigator.clipboard.writeText(listText);
    alert("Decklist copied to clipboard!");
  };

  // Trade Fulfill Handler
  const handleFulfillTrade = async (cardName, ownerId, buyerId) => {
    if (!activeGroup) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/playgroups/${activeGroup.id}/trade-fulfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ card_name: cardName, owner_id: ownerId, buyer_id: buyerId })
      });

      if (res.ok) {
        alert("Physical trade verified! Ownership updated, buyer's wishlist updated, and manifest updated!");
        loadLists();
        loadPlaygroupDetails(activeGroup.id);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to fulfill trade.");
    }
  };



  // Math metrics for MPC Order Engine
  const mpcListCount = groupWishlist.length;
  const isFloorMet = mpcListCount >= 108;
  const progressPercent = Math.min((mpcListCount / 612) * 100, 100);

  // Group wishlists by user for Venmo calculation
  const mpcActiveCards = groupWishlist.slice(0, 612);
  const venmoUserCounts = {};
  mpcActiveCards.forEach(c => {
    venmoUserCounts[c.username] = (venmoUserCounts[c.username] || 0) + 1;
  });

  const totalEstimateCost = mpcActiveCards.length * mpcUnitCost;

  // Build the Trade Matrix match list
  const getTradeMatches = () => {
    if (!activeGroup || groupInventory.length === 0 || groupWishlist.length === 0) return [];
    
    // Get current logged in user's ID
    const token = localStorage.getItem("token");
    if (!token) return [];
    // Decode user ID roughly (or we can use user object from context)
    // Find active user's wishlist
    const myWishlistNames = wishlist.map(c => c.card_name.toLowerCase());
    
    // Matches where: peers own cards that the user wants
    const peersCardsIWant = groupInventory.filter(c => 
      c.owner_username !== (wishlist[0]?.username || "") && // peer card
      myWishlistNames.includes(c.card_name.toLowerCase())
    );

    // Matches where: peers want cards that the user owns
    // Find my physical collection names
    // To do this fully, we look at combined wishlist cards that belong to others
    // and match them with what the user owns physically
    const myOwnedRes = groupInventory.filter(c => c.owner_id === activeGroup.members?.[0]?.id); // rough check, let's look at owner_username
    // Let's find matches based on username
    const matches = [];

    // Let's group by peer to display "High-Value Trade Pairs"
    groupMembers.forEach(peer => {
      // Skip active user
      if (groupWishlist.length > 0 && peer.username === groupWishlist[0]?.username) return;

      const peerCardsIWant = groupInventory.filter(c => 
        c.owner_username === peer.username && 
        myWishlistNames.includes(c.card_name.toLowerCase())
      );

      // Peer wants cards I own
      const peerWishlistNames = groupWishlist
        .filter(c => c.username === peer.username)
        .map(c => c.card_name.toLowerCase());

      const myCardsPeerWants = groupInventory.filter(c => 
        c.owner_username !== peer.username && // my cards (roughly anything not theirs)
        c.owner_username === groupWishlist[0]?.username && // must be mine
        peerWishlistNames.includes(c.card_name.toLowerCase())
      );

      if (peerCardsIWant.length > 0 || myCardsPeerWants.length > 0) {
        matches.push({
          peer,
          cardsIWant: peerCardsIWant,
          cardsPeerWants: myCardsPeerWants
        });
      }
    });

    return matches;
  };

  const tradeMatches = getTradeMatches();

  // printable sheets mapping helper
  const printItemsList = [];
  wishlist.forEach(c => {
    const cardMeta = printsCache[c.card_name];
    const imageUri = cardMeta?.image_uris?.normal || cardMeta?.card_faces?.[0]?.image_uris?.normal || "https://cards.scryfall.io/card_back.png";
    for (let i = 0; i < c.quantity; i++) {
      printItemsList.push({ name: c.card_name, image: imageUri });
    }
  });

  if (showPrintMode) {
    return (
      <div className="printable-sheets-container">
        <div className="print-controls no-print">
          <h2>🖨️ Printable Proxy Sheets Layout</h2>
          <p>This layout is scaled to standard Magic card dimensions (63mm x 88mm). Use <code>Ctrl + P</code> to print sheets.</p>
          <div className="print-actions">
            <button className="print-btn-confirm" onClick={() => window.print()}>Open Print Dialog</button>
            <button className="print-btn-cancel" onClick={() => setShowPrintMode(false)}>Exit Print Layout</button>
          </div>
        </div>

        <div className="print-grid">
          {printItemsList.map((card, index) => (
            <div key={index} className="print-card-wrapper">
              <img src={card.image} alt={card.name} className="print-card-img" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-page-container">
      
      {/* Header and Compliance Checker */}
      <div className="wishlist-header">
        <div>
          <h1 className="wishlist-title">✨ Wishlist & Proxy Hub</h1>
          <p className="wishlist-subtitle">Manage proxy lists, chronological MakePlayingCards queues, and local playgroup trades.</p>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      
      <div className="nexus-tabs-header">
        <button 
          className={`nexus-tab-btn ${activeTab === "lists" ? "active" : ""}`}
          onClick={() => setActiveTab("lists")}
        >
          📋 My Lists
        </button>
        <button 
          className={`nexus-tab-btn ${activeTab === "nexus" ? "active" : ""}`}
          onClick={() => setActiveTab("nexus")}
        >
          👥 Playgroup Nexus
        </button>
      </div>


      {/* VIEW 1: MY THREE LISTS */}
      {activeTab === "lists" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Sub-tabs Selection */}
          <div className="sub-tabs-row">
            <button 
              className={`sub-tab-btn ${selectedList === "proxy_wishlist" ? "active" : ""}`}
              onClick={() => setSelectedList("proxy_wishlist")}
            >
              🖨️ Proxy Wishlist ({wishlist.length})
            </button>
            <button 
              className="sub-tab-btn"
              onClick={() => window.location.href = "/trade"}
            >
              🤝 Go to Trade Hub ↗
            </button>

          </div>

          {/* Quick descriptions */}
          <div className="compliance-banner compliant" style={{ background: "rgba(37,99,235,0.06)", borderColor: "rgba(37,99,235,0.2)", color: "#93c5fd" }}>
            🖨️ Proxy Wishlist: Cards you want to print. Pooled chronologically with playgroup wishlists to hit bulk brackets.
          </div>

          {/* Search bar */}
          <div className="search-bar-row">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search card to add to proxy wishlist..."
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
          {/* Lists Views */}
          <>
              {/* Summary Bar */}
              <div className="wishlist-summary-bar">
                <div className="stat-cards-row">
                  <div className="summary-stat-card">
                    <span className="label">Unique Cards</span>
                    <span className="val">{wishlist.length}</span>
                  </div>
                  <div className="summary-stat-card">
                    <span className="label">Total Quantity</span>
                    <span className="val">
                      {wishlist.reduce((sum, c) => sum + c.quantity, 0)}
                    </span>
                  </div>
                  <div className="summary-stat-card">
                    <span className="label">Est. Cost</span>
                    <span className="val">
                      ${(
                        wishlist.reduce((sum, c) => sum + c.quantity, 0) * 0.25
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="proxy-actions-row">
                  <button className="proxy-btn" onClick={handleCopyMoxfield} disabled={wishlist.length === 0}>
                    📋 Copy Decklist
                  </button>
                  <button className="proxy-btn" onClick={handleDownloadMpcCsv} disabled={wishlist.length === 0}>
                    💾 Download CSV
                  </button>
                  <button className="proxy-btn print" onClick={() => setShowPrintMode(true)} disabled={wishlist.length === 0}>
                    🖨️ Print Sheets
                  </button>
                  <button className="proxy-btn any-print" onClick={handleSetAllAnyPrinting} disabled={wishlist.length === 0}>
                    🔄 Clear Specific Trade Printing Rules
                  </button>
                </div>
              </div>

              {/* Grid cards */}
              {wishlist.length === 0 ? (
                <div className="empty-wishlist-box">
                  This list is empty. Search cards above to add them.
                </div>
              ) : (
                <div className="csv-table-wrapper">
                  <table className="csv-table">
                    <thead>
                      <tr>
                        <th className="col-qty">Quantity</th>
                        <th className="col-name">Card Name</th>
                        <th className="col-print">Printing</th>
                        <th className="col-foil">Finish</th>
                        <th className="col-any">Any Print</th>
                        <th className="col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wishlist.map((c) => {
                        const cardMeta = printsCache[c.card_name];
                        const prints = cardMeta?.prints || [];
                        const activePrintIdx = selectedPrints[c.card_name] || 0;

                        return (
                          <tr key={c.id}>
                            <td className="col-qty">
                              <div className="qty-picker-compact">
                                <button onClick={() => updateCardDetails(c, { quantity: c.quantity - 1 })}>-</button>
                                <span>{c.quantity}</span>
                                <button onClick={() => updateCardDetails(c, { quantity: c.quantity + 1 })}>+</button>
                              </div>
                            </td>
                            <td className="col-name font-bold">
                              {c.card_name}
                            </td>
                            <td className="col-print">
                              {!c.any_printing ? (
                                prints.length > 0 ? (
                                  <select 
                                    value={activePrintIdx}
                                    onChange={(e) => handlePrintChange(c, parseInt(e.target.value))}
                                    className="table-input set-select"
                                    style={{ width: "100%", padding: "4px" }}
                                  >
                                    {prints.map((p, idx) => (
                                      <option key={idx} value={idx}>
                                        {p.set?.toUpperCase()} - {p.set_name} (#{p.collector_number || "?"})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="loading-label">Loading...</span>
                                )
                              ) : (
                                <span className="sub" style={{ color: "#64748b" }}>Any Printing</span>
                              )}
                            </td>
                            <td className="col-foil">
                              <label className="switch-container">
                                <input
                                  type="checkbox"
                                  checked={!!c.is_foil}
                                  onChange={(e) => updateCardDetails(c, { is_foil: e.target.checked })}
                                />
                                <span className="slider round"></span>
                                <span className="foil-label">{c.is_foil ? "Foil" : "Normal"}</span>
                              </label>
                            </td>
                            <td className="col-any">
                                <label className="switch-container" title="If unchecked, you will only accept the selected printing in a trade">
                                  <input 
                                    type="checkbox"
                                    checked={c.any_printing}
                                    onChange={(e) => {
                                      const anyPrint = e.target.checked;
                                      if (anyPrint) {
                                        updateCardDetails(c, { any_printing: true });
                                      } else {
                                        const meta = printsCache[c.card_name];
                                        if (meta) {
                                          updateCardDetails(c, { 
                                            any_printing: false, 
                                            set_code: meta.set?.toUpperCase(), 
                                            collector_number: meta.collector_number || "" 
                                          });
                                          setSelectedPrints(prev => ({ ...prev, [c.card_name]: 0 }));
                                        } else {
                                          updateCardDetails(c, { any_printing: false });
                                        }
                                      }
                                    }}
                                  />
                                  <span className="slider round"></span>
                                </label>
                              </td>
                            <td className="col-actions">
                              <button 
                                className="table-delete-btn"
                                onClick={() => deleteCard(c)}
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
                </div>
              )}
            </>
        </div>
      )}

      {/* VIEW 2: PLAYGROUP NEXUS */}
      {activeTab === "nexus" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Active Playgroup selector & join/create actions */}
          <div className="playgroup-setup-grid">
            {/* Selector */}
            <div className="setup-card">
              <label className="playgroup-label">👥 Select Active Playgroup:</label>
              {playgroups.length > 0 ? (
                <select 
                  value={activeGroup?.id || ""} 
                  onChange={(e) => {
                    const group = playgroups.find(g => g.id === parseInt(e.target.value));
                    setActiveGroup(group);
                  }}
                  className="playgroup-dropdown"
                >
                  {playgroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} (ID: {g.id})</option>
                  ))}
                </select>
              ) : (
                <p style={{ color: "#64748b", margin: "0", fontSize: "0.85rem" }}>You are not in any playgroups yet.</p>
              )}

              {activeGroup && (
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Active members: <strong>{groupMembers.length}</strong>
                </div>
              )}
            </div>

            {/* Create / Join actions */}
            <div className="setup-card" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New playgroup name..."
                  className="setup-input"
                  style={{ flex: 1 }}
                />
                <button onClick={handleCreateGroup} className="setup-btn">Create Group</button>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input 
                  type="text" 
                  value={joinGroupId}
                  onChange={(e) => setJoinGroupId(e.target.value)}
                  placeholder="Playgroup ID to join..."
                  className="setup-input"
                  style={{ flex: 1 }}
                />
                <button onClick={handleJoinGroup} className="setup-btn" style={{ background: "#475569" }}>Join Group</button>
              </div>
            </div>
          </div>

          {activeGroup ? (
            <>
              {/* Playgroup Active View */}

              {/* Shared Group MPC Order Engine Section */}
              <div className="mpc-tracker-card">
                <div className="mpc-progress-header">
                  <div>
                    <h3 style={{ margin: "0", fontSize: "1.1rem" }}>📦 Shared Group MPC Order Engine</h3>
                    <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                      Bundles playgroup wishlists chronologically. Optimal bulk bracket target: <strong>612 cards</strong>.
                    </p>
                  </div>

                  <span className={`mpc-alert-badge ${isFloorMet ? "met" : "unmet"}`}>
                    {isFloorMet ? "✅ Minimum Floor Met (108+ Cards)" : "⚠️ Below Minimum Floor (Need 108 Cards)"}
                  </span>
                </div>

                {/* Progress bar metrics */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div className="progress-bar-container" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: "700" }}>
                    {mpcListCount} / 612 Cards
                  </span>
                </div>

                {/* Download and actions */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="setup-btn" onClick={handleDownloadMpcJson} disabled={mpcListCount === 0}>
                    🛠️ Generate MPCfill JSON Manifest
                  </button>
                </div>

                {/* Split list display: Active queue vs Overflow queue */}
                <div className="queue-panel-split">
                  {/* Active Queue */}
                  <div className="queue-column">
                    <h3>
                      <span>🚀 Active Print Queue</span>
                      <span className="queue-badge active">First 612 Copies</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {groupWishlist.slice(0, 612).map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="queue-list-item">
                          <span>{idx + 1}. <strong>{c.card_name}</strong> ({c.username})</span>
                          <span style={{ color: "#64748b" }}>{c.set_code?.toUpperCase()}</span>
                        </div>
                      ))}
                      {groupWishlist.slice(0, 612).length === 0 && (
                        <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>Queue is empty.</p>
                      )}
                    </div>
                  </div>

                  {/* Overflow Queue */}
                  <div className="queue-column">
                    <h3>
                      <span>⏳ Overflow / Deferred Queue</span>
                      <span className="queue-badge overflow">Deferred to Next Manifest</span>
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {groupWishlist.slice(612).map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="queue-list-item">
                          <span>{idx + 1}. <strong>{c.card_name}</strong> ({c.username})</span>
                          <span style={{ color: "#64748b" }}>{c.set_code?.toUpperCase()}</span>
                        </div>
                      ))}
                      {groupWishlist.slice(612).length === 0 && (
                        <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>No overflow cards in queue.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Venmo Calculator & receipts */}
                <div className="venmo-calculator-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: "0", fontSize: "1rem" }}>💸 Venmo Reimbursement Calculator</h4>
                      <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                        Costs split proportionally according to card count percentage in the active 612 manifest.
                      </p>
                    </div>
                    
                    {/* Cost config */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>Cost per print card:</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={mpcUnitCost} 
                        onChange={(e) => setMpcUnitCost(parseFloat(e.target.value) || 0)} 
                        className="setup-input" 
                        style={{ width: "70px", padding: "0.3rem" }}
                      />
                    </div>
                  </div>

                  <div className="venmo-grid">
                    {Object.entries(venmoUserCounts).map(([username, count]) => {
                      const pct = (count / mpcActiveCards.length) * 100;
                      const shareVal = (pct / 100) * totalEstimateCost;
                      return (
                        <div key={username} className="venmo-user-card">
                          <div>
                            <span className="venmo-user-name">{username}</span>
                            <div className="venmo-user-stats">{count} cards ({pct.toFixed(1)}% of manifest)</div>
                          </div>
                          <span className="venmo-price-share">${shareVal.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Trade Matrix Screen Section */}
              <div className="mpc-tracker-card" style={{ background: "rgba(30,41,59,0.2)" }}>
                <h3 style={{ margin: "0", fontSize: "1.1rem" }}>🤝 Playgroup Trade Matrix</h3>
                <p style={{ margin: "0.15rem 0 1rem 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                  Match wishlists with group physical inventory. Recommends financially balanced configurations at 85% market price value.
                </p>

                <div className="matrix-pair-container">
                  {tradeMatches.map(({ peer, cardsIWant, cardsPeerWants }) => {
                    // Monetary Balancing Engine recommendation
                    const valueIWant = cardsIWant.reduce((sum, c) => sum + Number(c.market_price || 0), 0) * 0.85;
                    const valuePeerWants = cardsPeerWants.reduce((sum, c) => sum + Number(c.market_price || 0), 0) * 0.85;
                    const tradeDiff = Math.abs(valueIWant - valuePeerWants);
                    
                    return (
                      <div key={peer.id} className="matrix-pair-card">
                        <div className="matrix-pair-header">
                          <span style={{ fontWeight: "700", fontSize: "1rem" }}>Trade Pair: You & {peer.username}</span>
                          <span className="mpc-alert-badge met" style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd" }}>
                            Value Balance Diff: ${tradeDiff.toFixed(2)}
                          </span>
                        </div>

                        <div className="matrix-columns-split">
                          {/* Peer owns cards you want */}
                          <div className="matrix-sub-column">
                            <h4>🎁 Peer Owned Cards You Want ({cardsIWant.length})</h4>
                            {cardsIWant.map(c => (
                              <div key={c.id} className="matrix-item">
                                <span>{c.card_name}</span>
                                <span className="matrix-price">${(Number(c.market_price || 0) * 0.85).toFixed(2)}</span>
                              </div>
                            ))}
                            {cardsIWant.length === 0 && <p style={{ fontSize: "0.8rem", color: "#64748b" }}>None</p>}
                          </div>

                          {/* You own cards peer wants */}
                          <div className="matrix-sub-column">
                            <h4>🎒 Your Owned Cards Peer Wants ({cardsPeerWants.length})</h4>
                            {cardsPeerWants.map(c => (
                              <div key={c.id} className="matrix-item">
                                <span>{c.card_name}</span>
                                <span className="matrix-price">${(Number(c.market_price || 0) * 0.85).toFixed(2)}</span>
                              </div>
                            ))}
                            {cardsPeerWants.length === 0 && <p style={{ fontSize: "0.8rem", color: "#64748b" }}>None</p>}
                          </div>
                        </div>

                        {/* Balancing recommendations & Non-binding requests */}
                        <div className="balancing-engine-panel">
                          <span className="balance-text">
                            ⚖️ <strong>Engine:</strong> Recommends trading {cardsPeerWants.length > 0 ? `[${cardsPeerWants[0].card_name}]` : "No cards"} for {cardsIWant.length > 0 ? `[${cardsIWant[0].card_name}]` : "No cards"} to offset balances.
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="trade-matrix-btn"
                              onClick={() => window.location.href = `/trade?partner=${peer.id}`}
                            > Build Trade in Hub
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {tradeMatches.length === 0 && (
                    <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>
                      No wishlist matches or trade targets available in this playgroup yet. Encourage members to upload inventories and add to their Proxy Wishlists.
                    </p>
                  )}
                </div>
              </div>

              {/* Group Members inventories details */}
              <div className="mpc-tracker-card">
                <h3>👥 Group Members physical inventories ({groupInventory.length} cards total)</h3>
                <div className="csv-table-wrapper" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <table className="csv-table">
                    <thead>
                      <tr>
                        <th>Card Name</th>
                        <th>Owner</th>
                        <th>Set / Print</th>
                        <th>Market Price</th>
                        <th>Safety Warning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupInventory.map(card => {
                        const isAlert = card.market_price && card.max_price_threshold && Number(card.market_price) >= Number(card.max_price_threshold);
                        return (
                          <tr key={card.id}>
                            <td className="font-bold">{card.card_name}</td>
                            <td>{card.owner_username}</td>
                            <td>{card.set_code?.toUpperCase()} #{card.collector_number}</td>
                            <td>${Number(card.market_price || 0).toFixed(2)}</td>
                            <td>
                              {isAlert ? (
                                <span className="high-value-warning" title="Flagged as safety asset (Safety limit exceeded)">⚠️ Flagged</span>
                              ) : (
                                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Clear</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {groupInventory.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "#64748b" }}>
                            No physical collections loaded in this playgroup yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </>
          ) : (
            <div className="empty-wishlist-box">
              Please create or join a playgroup to access the Playgroup Nexus tools!
            </div>
          )}
        </div>
      )}

    </div>
  );
}
