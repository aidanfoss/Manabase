import React, { useState, useEffect, useRef, useMemo } from "react";
import { api } from "../api/client";
import { parseImportInput } from "../utils/csvImporter";
import { isDoubleFacedCard, getCardFrontName, getCardBackName, formatMpcTextList } from "../utils/cardHelpers";
import MarketplacePriceDrawer from "./MarketplacePriceDrawer";
import { useToast } from "../context/ToastContext";
import "../styles/wishlist.css";

function generateManaPoolCheckoutUrl(items) {
  if (!items || items.length === 0) return "https://manapool.com/add-deck";

  const deckLines = items.map(item => {
    const qty = typeof item === "object" ? (item.quantity || item.qty || item.count || 1) : 1;
    const name = typeof item === "string" ? item : (item.card_name || item.name || item.title || "");
    const set = typeof item === "object" ? (item.set_code || item.setCode || item.set || "") : "";
    const collector = typeof item === "object" ? (item.collector_number || item.collector || "") : "";
    if (set && collector) {
      return `${qty} ${name} [${set.toLowerCase()}] ${collector}`;
    }
    return `${qty} ${name}`;
  }).filter(line => line.trim().length > 0);

  const deckText = deckLines.join("\n");
  const base64Deck = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(deckText)))
    : Buffer.from(deckText).toString("base64");

  return `https://manapool.com/add-deck?ref=scm&tap_s=5258590-8677e0&deck=${encodeURIComponent(base64Deck)}&ref_meta=referrer:manabase-bulkBuy`;
}

export default function WishlistHub() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("lists"); // "lists", "nexus", "trades"
  const [selectedList, setSelectedList] = useState("proxy_wishlist");
  const [showMarketplaceDrawer, setShowMarketplaceDrawer] = useState(false);
  const [drawerCardName, setDrawerCardName] = useState("");
  const [drawerCardList, setDrawerCardList] = useState([]);

  // Retail provider toggle states & retail price cache (defaulting to both true)
  const [showLotusColumn, setShowLotusColumn] = useState(true);
  const [showManaPoolColumn, setShowManaPoolColumn] = useState(true);
  const [retailPrices, setRetailPrices] = useState({});
  const [loadingRetail, setLoadingRetail] = useState(false);
  const [activeTrades, setActiveTrades] = useState([]);
  const [counterTrade, setCounterTrade] = useState(null);
  const [counterOffer, setCounterOffer] = useState([]);
  const [counterDemand, setCounterDemand] = useState([]);
  // Lists data states
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

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

  // Print view state
  const [showPrintMode, setShowPrintMode] = useState(false);

  // Remove Cheap Cards modal states
  const [showCheapModal, setShowCheapModal] = useState(false);
  const [cheapThreshold, setCheapThreshold] = useState(1.00);
  const [deletingCheap, setDeletingCheap] = useState(false);

  // Prints resolution cache
  const [printsCache, setPrintsCache] = useState({});
  const [selectedPrints, setSelectedPrints] = useState({}); // cardName -> print index

  // MPC print cost config (default $0.25)
  const [mpcUnitCost, setMpcUnitCost] = useState(0.25);

  // Playgroup Decks Resync Lock
  const [hasResyncedGroupDecks, setHasResyncedGroupDecks] = useState(false);
  const [resyncingGroupDecks, setResyncingGroupDecks] = useState(false);
  // Live parsed preview of import cards
  const parsedPreviewCards = useMemo(() => {
    if (!importText.trim()) return [];
    return parseImportInput(importText);
  }, [importText]);

  // Bulk import submit handler
  const handleImportCards = async () => {
    if (!importText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to bulk import cards.");
      return;
    }

    setImporting(true);
    setImportStatus("Parsing input...");

    try {
      const parsedCards = parseImportInput(importText);
      if (parsedCards.length === 0) {
        alert("No valid cards found in the provided input.");
        setImporting(false);
        setImportStatus("");
        return;
      }

      setImportStatus(`Found ${parsedCards.length} cards. Starting batch import...`);

      const CHUNK_SIZE = 500;
      let totalAdded = 0;

      for (let i = 0; i < parsedCards.length; i += CHUNK_SIZE) {
        const chunk = parsedCards.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(parsedCards.length / CHUNK_SIZE);

        setImportStatus(`Importing batch ${batchNum} of ${totalBatches} (${chunk.length} cards)...`);

        const res = await fetch("/api/lists/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cards: chunk, list_kind: "proxy_wishlist" }),
        });

        if (res.ok) {
          const data = await res.json();
          totalAdded += data.count || chunk.length;
        } else {
          console.error("Batch list import chunk failed:", res.status);
        }
      }

      setImportText("");
      setShowImportModal(false);
      setImportStatus("");
      await loadLists();

      const uniqueNames = [...new Set(parsedCards.map((c) => c.card_name))];
      fetchPrintsBatch(uniqueNames);

      alert(`🎉 Successfully imported ${totalAdded} total cards into your Proxy Wishlist!`);
    } catch (err) {
      console.error("Failed importing cards into list:", err);
      alert("An error occurred during import. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleFileRead = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportText(e.target.result || "");
    };
    reader.readAsText(file);
  };

  // Default Proxy Card Back preference (defaulting to Black Lotus)
  const [defaultCardBack, setDefaultCardBack] = useState(() => {
    return localStorage.getItem("manabase_default_card_back") || "b:black lotus";
  });

  // Prebuilt cardbacks list loaded from webserver
  const [prebuiltCardbacks, setPrebuiltCardbacks] = useState([]);

  useEffect(() => {
    loadLists();
    loadPlaygroups();

    // Fetch prebuilt cardbacks from backend
    fetch("/api/cardbacks")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPrebuiltCardbacks(data);
        }
      })
      .catch(() => { });

    // Fetch user default card back preference
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.default_card_back !== undefined) {
            const backVal = data.default_card_back || "b:black lotus";
            setDefaultCardBack(backVal);
            localStorage.setItem("manabase_default_card_back", backVal);
          }
        })
        .catch(() => { });
    }
  }, []);

  const handleSaveCardBack = async (newVal) => {
    setDefaultCardBack(newVal);
    localStorage.setItem("manabase_default_card_back", newVal);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await fetch("/api/users/me/card-back", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ default_card_back: newVal })
      });
    } catch (e) {
      console.error("Failed to save default card back:", e);
    }
  };

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
        fetchRetailPrices(newWishlist);
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

  const fetchRetailPrices = async (cards) => {
    if (!cards || cards.length === 0) return;
    const names = [...new Set(cards.map(c => c.card_name).filter(Boolean))];
    if (names.length === 0) return;

    setLoadingRetail(true);
    try {
      const lotusBatch = await api.batchLotusVault(names).catch(() => ({}));

      const manaMap = {};
      await Promise.all(names.map(async (name) => {
        try {
          const res = await api.optimizeManaPool([{ name, quantity: 1, isFoil: false }]);
          if (res && res.success && res.subtotal) {
            manaMap[name] = parseFloat(res.subtotal);
          } else {
            manaMap[name] = null;
          }
        } catch (e) {
          manaMap[name] = null;
        }
      }));

      const newPrices = {};
      names.forEach(name => {
        const lotus = lotusBatch[name];
        newPrices[name] = {
          lotusPrice: lotus?.cheapestPrice || null,
          lotusInStock: (lotus?.inStockCount || 0) > 0,
          manaPrice: manaMap[name] !== undefined ? manaMap[name] : null
        };
      });

      setRetailPrices(prev => ({ ...prev, ...newPrices }));
    } catch (err) {
      console.error("Failed to fetch retail prices:", err);
    } finally {
      setLoadingRetail(false);
    }
  };

  // Helper to resolve card price based on finish and print selection
  const resolveWishlistCardPrice = (c) => {
    const rData = retailPrices[c.card_name];
    const availablePrices = [];

    if (showLotusColumn && rData && rData.lotusInStock && rData.lotusPrice !== null) {
      availablePrices.push(rData.lotusPrice);
    }

    if (showManaPoolColumn && rData && rData.manaPrice !== null) {
      availablePrices.push(rData.manaPrice);
    }

    if (availablePrices.length > 0) {
      return Math.min(...availablePrices);
    }

    // Fallback to Scryfall market price if no active retail provider price is available
    const cardMeta = printsCache[c.card_name];
    const prints = cardMeta?.prints || [];
    const activePrintIdx = selectedPrints[c.card_name] || 0;
    const activePrint = prints[activePrintIdx] || cardMeta;

    let price = 0;
    if (activePrint && activePrint.prices) {
      if (c.is_foil) {
        price = parseFloat(activePrint.prices.usd_foil) || parseFloat(activePrint.prices.usd_etched) || parseFloat(activePrint.prices.usd) || 0;
      } else {
        price = parseFloat(activePrint.prices.usd) || parseFloat(activePrint.prices.usd_foil) || 0;
      }
    }
    if (!price && cardMeta && cardMeta.prices) {
      if (c.is_foil) {
        price = parseFloat(cardMeta.prices.usd_foil) || parseFloat(cardMeta.prices.usd_etched) || parseFloat(cardMeta.prices.usd) || 0;
      } else {
        price = parseFloat(cardMeta.prices.usd) || parseFloat(cardMeta.prices.usd_foil) || 0;
      }
    }
    if (!price) {
      price = parseFloat(c.market_price) || 0;
    }
    return price;
  };

  // Calculate matching cheap cards based on current threshold
  const cheapCardsList = useMemo(() => {
    const thresholdNum = parseFloat(cheapThreshold) || 0;
    return wishlist.map(c => {
      const price = resolveWishlistCardPrice(c);
      return { ...c, price };
    }).filter(c => c.price > 0 && c.price <= thresholdNum);
  }, [wishlist, printsCache, selectedPrints, cheapThreshold, retailPrices, showLotusColumn, showManaPoolColumn]);

  // Bulk remove cheap cards handler
  const handleRemoveCheapCards = async () => {
    if (cheapCardsList.length === 0) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setDeletingCheap(true);
    try {
      const ids = cheapCardsList.map((c) => c.id);
      const res = await fetch("/api/lists/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`🎉 Successfully removed ${data.count || cheapCardsList.length} cheap cards (≤ $${parseFloat(cheapThreshold || 0).toFixed(2)}) from your Proxy Wishlist!`);
        setShowCheapModal(false);
        await loadLists();
      } else {
        alert("Failed to remove cheap cards. Please try again.");
      }
    } catch (err) {
      console.error("Failed to remove cheap cards:", err);
      alert("An error occurred while removing cheap cards.");
    } finally {
      setDeletingCheap(false);
    }
  };

  const handleClearAll = async () => {
    if (wishlist.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all cards from your Proxy Wishlist? This action cannot be undone.")) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const ids = wishlist.map((c) => c.id);
      const res = await fetch("/api/lists/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        showToast("Successfully cleared all cards from your Proxy Wishlist!", "success");
        await loadLists();
      } else {
        alert("Failed to clear wishlist. Please try again.");
      }
    } catch (err) {
      console.error("Failed to clear wishlist:", err);
      alert("An error occurred while clearing the wishlist.");
    }
  };

  // Bulk buy cheap cards on ManaPool handler
  const handleBuyCheapCardsOnManaPool = () => {
    if (cheapCardsList.length === 0) {
      alert(`No cheap cards match your current threshold of ≤ $${parseFloat(cheapThreshold || 0).toFixed(2)}.`);
      return;
    }

    const url = generateManaPoolCheckoutUrl(cheapCardsList);
    window.open(url, "_blank");
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

  const handleGenerateInviteLink = async () => {
    if (!activeGroup) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/playgroups/${activeGroup.id}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/invite/${data.token}`;
        await navigator.clipboard.writeText(url);
        showToast(`🔗 Playgroup invite link copied to clipboard!`, "success");
      } else {
        const err = await res.json();
        showToast(`Failed to generate invite link: ${err.error}`, "error");
      }
    } catch (e) {
      console.error("Failed to generate invite link:", e);
      showToast("Failed to generate invite link.", "error");
    }
  };

  const handleResyncGroupDecks = async () => {
    if (!activeGroup) return;
    setResyncingGroupDecks(true);
    try {
      const res = await api.resyncPlaygroupDecks(activeGroup.id);
      alert(`✅ ${res.message}\nAdded: ${res.stats.added}, Removed: ${res.stats.removed}, Ignored: ${res.stats.ignored}`);
      setHasResyncedGroupDecks(true);
      // Reload wishlist to reflect any changes from synced decks
      loadPlaygroupDetails(activeGroup.id);
    } catch (err) {
      alert("Failed to resync playgroup decks: " + err.message);
    } finally {
      setResyncingGroupDecks(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/playgroups/${activeGroup.id}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Left playgroup "${activeGroup.name}"`, "info");
        const remaining = playgroups.filter(g => g.id !== activeGroup.id);
        setPlaygroups(remaining);
        setActiveGroup(remaining.length > 0 ? remaining[0] : null);
        loadPlaygroups();
      } else {
        const err = await res.json();
        showToast(`Failed to leave playgroup: ${err.error}`, "error");
      }
    } catch (e) {
      console.error("Failed to leave playgroup:", e);
      showToast("Failed to leave playgroup.", "error");
    }
  };

  const verifyAndGetManifest = async () => {
    let latestQueue = groupWishlist;

    // 1. Fetch latest wishlist data from server if in an active group
    if (activeGroup?.id) {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const res = await fetch(`/api/playgroups/${activeGroup.id}/wishlist`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            latestQueue = data;
            setGroupWishlist(data);
          }
        }
      } catch (e) {
        console.warn("⚠️ [WishlistHub] Could not fetch latest group wishlist prior to XML export:", e);
      }
    }

    const printQueue = latestQueue.slice(0, 612);

    // 2. Fetch/verify printsCache metadata for all cards in the manifest
    if (printQueue.length > 0) {
      const cardNames = Array.from(new Set(printQueue.map((c) => c.card_name)));
      try {
        await fetchPrintsBatch(cardNames, latestQueue);
      } catch (e) {
        console.warn("⚠️ [WishlistHub] Could not refresh prints cache prior to XML export:", e);
      }
    }

    return printQueue;
  };

  const handleCopyMpcTextList = async () => {
    if (groupWishlist.length === 0) return;
    showToast("🔄 Verifying latest manifest data...", "info");

    const printQueue = await verifyAndGetManifest();
    if (printQueue.length === 0) {
      showToast("No cards in print queue.", "warning");
      return;
    }

    const textList = formatMpcTextList(printQueue, printsCache, defaultCardBack);
    await navigator.clipboard.writeText(textList);
    showToast("📋 Copied MPCfill formatted card list to clipboard!", "success");
  };

  const handleDownloadMpcXml = async () => {
    if (groupWishlist.length === 0) return;
    showToast("🔄 Verifying latest manifest data...", "info");

    const printQueue = await verifyAndGetManifest();
    if (printQueue.length === 0) {
      showToast("No cards in print queue to generate XML.", "warning");
      return;
    }

    // Group cards by card_name + set_code + collector_number to combine slot indices
    const cardGroups = new Map();

    printQueue.forEach((c, slotIndex) => {
      const meta = printsCache[c.card_name];
      const isDfc = isDoubleFacedCard(c, meta);
      const name = isDfc ? getCardFrontName(c, meta) : (c.card_name || c.name || "Unknown Card");
      const key = `${name}__${c.set_code || ""}__${c.collector_number || ""}`;
      if (!cardGroups.has(key)) {
        cardGroups.set(key, {
          name: name,
          set_code: c.set_code || "",
          collector_number: c.collector_number || "",
          slots: [slotIndex]
        });
      } else {
        cardGroups.get(key).slots.push(slotIndex);
      }
    });

    const escapeXml = (str) => {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<order>\n`;
    xml += `    <details>\n`;
    xml += `        <quantity>${printQueue.length}</quantity>\n`;
    xml += `        <stock>(S30) Standard Smooth</stock>\n`;
    xml += `        <foil>false</foil>\n`;
    xml += `    </details>\n`;
    xml += `    <fronts>\n`;

    for (const group of cardGroups.values()) {
      const fileName = group.name.match(/\.(png|jpg|jpeg)$/i)
        ? group.name
        : `${group.name}.png`;
      const query = group.name;

      xml += `        <card>\n`;
      xml += `            <id></id>\n`;
      xml += `            <slots>${group.slots.join(",")}</slots>\n`;
      xml += `            <name>${escapeXml(fileName)}</name>\n`;
      xml += `            <query>${escapeXml(query)}</query>\n`;
      xml += `        </card>\n`;
    }

    // Helper to resolve cardback details canonically
    const resolveCardbackDetails = (rawVal, username) => {
      const val = (rawVal || "").trim();
      if (!val) return null;

      const match = prebuiltCardbacks.find(
        (pb) => pb.driveId === val || pb.query === val || pb.id === val || pb.name === val
      );

      let cardId = "";
      let queryVal = "";
      let fileName = `${username || "User"} Card Back.png`;

      if (match) {
        cardId = match.driveId || "";
        queryVal = match.query || match.name || "";
        fileName = match.name.match(/\.(png|jpg|jpeg)$/i) ? match.name : `${match.name}.png`;
      } else if (/^[1-9a-zA-Z_-]{20,}$/.test(val)) {
        cardId = val;
        queryVal = ""; // Leave query empty when exact Drive ID is provided to prevent search failure
        fileName = "Card Back.png";
      } else {
        cardId = "";
        queryVal = val;
        fileName = "Card Back.png";
      }

      const canonicalKey = cardId ? `id:${cardId}` : `query:${queryVal.toLowerCase()}`;
      return { rawVal, canonicalKey, cardId, queryVal, fileName, matchName: match ? match.name : null, username };
    };

    // 1. Resolve cardback or DFC status for every slot in the print queue
    const slotCardbacks = printQueue.map((c) => {
      const meta = printsCache[c.card_name];
      if (isDoubleFacedCard(c, meta)) {
        const backName = getCardBackName(c, meta) || getCardFrontName(c, meta) || "Unknown Card";
        return {
          isDfc: true,
          rawVal: backName,
          canonicalKey: `dfc:${backName.toLowerCase()}`,
          cardId: "",
          queryVal: backName,
          fileName: `${backName}.png`,
          matchName: "DFC Back Face",
          username: c.username
        };
      }
      const raw = (c.user_card_back || defaultCardBack || "b:black lotus").trim();
      const resolved = resolveCardbackDetails(raw, c.username);
      return {
        isDfc: false,
        ...resolved
      };
    });

    // 2. Count frequency of non-DFC canonical cardbacks to determine primary default <cardback>
    const frequencyMap = new Map(); // canonicalKey -> { count, details }
    slotCardbacks.forEach((cb) => {
      if (cb && !cb.isDfc) {
        if (!frequencyMap.has(cb.canonicalKey)) {
          frequencyMap.set(cb.canonicalKey, { count: 1, details: cb });
        } else {
          frequencyMap.get(cb.canonicalKey).count++;
        }
      }
    });

    let primaryCardbackDetails = null;
    let maxCount = 0;
    for (const entry of frequencyMap.values()) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
        primaryCardbackDetails = entry.details;
      }
    }

    const globalCardbackVal = primaryCardbackDetails
      ? (primaryCardbackDetails.cardId || primaryCardbackDetails.queryVal || primaryCardbackDetails.rawVal)
      : (defaultCardBack || "b:black lotus").trim();

    // 3. Group slots by canonical key for any DFC backs OR cardbacks that OVERRIDE the primary <cardback>
    const overrideBacksMap = new Map(); // canonicalKey -> { ...details, slots: [] }

    slotCardbacks.forEach((cb, slotIndex) => {
      if (cb) {
        if (cb.isDfc) {
          if (!overrideBacksMap.has(cb.canonicalKey)) {
            overrideBacksMap.set(cb.canonicalKey, {
              ...cb,
              slots: [slotIndex]
            });
          } else {
            overrideBacksMap.get(cb.canonicalKey).slots.push(slotIndex);
          }
        } else {
          const matchesPrimary = primaryCardbackDetails && cb.canonicalKey === primaryCardbackDetails.canonicalKey;
          if (!matchesPrimary) {
            if (!overrideBacksMap.has(cb.canonicalKey)) {
              overrideBacksMap.set(cb.canonicalKey, {
                ...cb,
                slots: [slotIndex]
              });
            } else {
              overrideBacksMap.get(cb.canonicalKey).slots.push(slotIndex);
            }
          }
        }
      }
    });

    // Verbose debug logging for user cardbacks & DFCs
    console.group("🛠️ [MPCfill XML Generator] Verbose Debug Log");
    console.log(`📦 Active Group: "${activeGroup?.name || "group"}"`);
    console.log(`📋 Total Cards in Print Queue: ${printQueue.length}`);
    printQueue.forEach((c, idx) => {
      const isDfc = isDoubleFacedCard(c);
      console.log(
        `  Slot [${idx}]: "${c.card_name}" | DFC=${isDfc} | Owner="${c.username}" | Cardback="${c.user_card_back || "(none)"}"`
      );
    });
    console.log(`🏆 Primary Default <cardback>: "${globalCardbackVal}" (used by ${maxCount} cards)`);
    console.log(`🔀 Override Cardbacks / DFC Backs Count: ${overrideBacksMap.size}`);

    xml += `    </fronts>\n`;
    xml += `    <backs>\n`;

    for (const backGroup of overrideBacksMap.values()) {
      console.log(`🎨 Exporting <backs> entry (DFC / Override):`, {
        canonicalKey: backGroup.canonicalKey,
        isDfc: backGroup.isDfc,
        resolvedDriveId: backGroup.cardId,
        resolvedQuery: backGroup.queryVal,
        fileName: backGroup.fileName,
        assignedSlots: backGroup.slots.join(",")
      });

      xml += `        <card>\n`;
      xml += `            <id>${escapeXml(backGroup.cardId)}</id>\n`;
      xml += `            <slots>${backGroup.slots.join(",")}</slots>\n`;
      xml += `            <name>${escapeXml(backGroup.fileName)}</name>\n`;
      xml += `            <query>${escapeXml(backGroup.queryVal)}</query>\n`;
      xml += `        </card>\n`;
    }

    xml += `    </backs>\n`;
    xml += `    <cardback>${escapeXml(globalCardbackVal)}</cardback>\n`;
    xml += `</order>\n`;

    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeGroup?.name || "group"}_mpcfill_manifest.xml`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("✨ Verified manifest data & downloaded XML!", "success");
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
        <button
          className={`nexus-tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Proxy Settings
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
            <button
              className="sub-tab-btn"
              style={{
                background: "linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(99, 102, 241, 0.15))",
                border: "1px solid rgba(236, 72, 153, 0.4)",
                color: "#f472b6",
                fontWeight: "700"
              }}
              onClick={() => {
                setDrawerCardName("");
                setDrawerCardList(wishlist);
                setShowMarketplaceDrawer(true);
              }}
              title="Compare LotusVault local store stock vs ManaPool live cart shipping estimates"
            >
              🌸 Retail Deals & Live Shipping ⚡
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
                <button className="proxy-btn import" onClick={() => setShowImportModal(true)}>
                  📥 Bulk Import
                </button>
                <button className="proxy-btn remove-cheap" onClick={() => setShowCheapModal(true)} disabled={wishlist.length === 0} title="Purge cards cheap enough to buy directly">
                  🏷️ Remove Cheap Cards
                </button>
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
                <button className="proxy-btn remove-cheap" onClick={handleClearAll} disabled={wishlist.length === 0} title="Clear all cards from your proxy wishlist">
                  🗑️ Clear All
                </button>
              </div>
            </div>

            {/* Retail Provider Toggles Bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", background: "rgba(15,23,42,0.7)", padding: "0.6rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Retail Providers:
                </span>
                <label style={{ fontSize: "0.85rem", color: "#f472b6", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showLotusColumn}
                    onChange={(e) => setShowLotusColumn(e.target.checked)}
                  />
                  🌸 LotusVault
                </label>
                <label style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showManaPoolColumn}
                    onChange={(e) => setShowManaPoolColumn(e.target.checked)}
                  />
                  ⚡ ManaPool Market
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
                <button
                  className="proxy-btn"
                  style={{ background: "rgba(99,102,241,0.2)", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8", padding: "0.4rem 0.85rem", fontSize: "0.8rem", fontWeight: "700" }}
                  onClick={handleBuyCheapCardsOnManaPool}
                  disabled={wishlist.length === 0 || cheapCardsList.length === 0}
                  title="Export cheap cards (≤ threshold) directly into ManaPool cart"
                >
                  ⚡ Buy Cheap Cards ({cheapCardsList.length})
                </button>

                <button
                  className="proxy-btn"
                  style={{ background: "rgba(225,29,72,0.15)", borderColor: "rgba(225,29,72,0.3)", color: "#fb7185", padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                  onClick={() => setShowCheapModal(true)}
                  disabled={wishlist.length === 0}
                >
                  🧹 Purge Cheap Cards
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
                      {showLotusColumn && <th className="col-lotus" style={{ background: "rgba(236,72,153,0.1)", color: "#f472b6" }}>🌸 LotusVault</th>}
                      {showManaPoolColumn && <th className="col-manapool" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>⚡ ManaPool</th>}
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlist.map((c) => {
                      const cardMeta = printsCache[c.card_name];
                      const prints = cardMeta?.prints || [];
                      const activePrintIdx = selectedPrints[c.card_name] || 0;
                      const rData = retailPrices[c.card_name];

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

                          {showLotusColumn && (
                            <td className="col-lotus" style={{ textAlign: "center" }}>
                              {rData?.lotusInStock ? (
                                <span style={{ color: "#34d399", fontWeight: "700" }}>
                                  ${rData.lotusPrice?.toFixed(2)}
                                </span>
                              ) : rData ? (
                                <span style={{ color: "#f87171", fontSize: "0.75rem" }}>Out of Stock</span>
                              ) : (
                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{loadingRetail ? "..." : "--"}</span>
                              )}
                            </td>
                          )}

                          {showManaPoolColumn && (
                            <td className="col-manapool" style={{ textAlign: "center" }}>
                              {rData?.manaPrice !== null && rData?.manaPrice !== undefined ? (
                                <span style={{ color: "#818cf8", fontWeight: "700" }}>
                                  ${rData.manaPrice?.toFixed(2)}
                                </span>
                              ) : (
                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{loadingRetail ? "..." : "--"}</span>
                              )}
                            </td>
                          )}
                          <td className="col-actions">
                            <button
                              className="table-action-btn"
                              style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.3)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", marginRight: "6px", cursor: "pointer" }}
                              onClick={() => {
                                setDrawerCardName(c.card_name);
                                setDrawerCardList([]);
                                setShowMarketplaceDrawer(true);
                              }}
                              title="Check LotusVault stock & ManaPool shipping for this card"
                            >
                              🌸 Retail Check
                            </button>
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

          {/* Active Playgroup selector & invite/create actions */}
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
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              ) : (
                <p style={{ color: "#64748b", margin: "0", fontSize: "0.85rem" }}>You are not in any playgroups yet.</p>
              )}

              {activeGroup && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                    Active members: <strong>{groupMembers.length}</strong> 🔒 Private
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={handleGenerateInviteLink}
                      className="setup-btn"
                      style={{ background: "#3b82f6", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                    >
                      🔗 Invite Link
                    </button>
                    <button
                      onClick={handleLeaveGroup}
                      className="setup-btn"
                      style={{ background: "transparent", border: "1px solid #ef4444", color: "#f87171", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                      title="Leave this playgroup"
                    >
                      🚪 Leave
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Group */}
            <div className="setup-card" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: "1.5rem" }}>
              <label className="playgroup-label">✨ Create Private Playgroup:</label>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
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

                {/* Default Card Back Preference Input */}
                <div style={{ margin: "0.75rem 0", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "600", whiteSpace: "nowrap" }}>
                    🎨 Default Card Back ID / Query:
                  </label>
                  <input
                    type="text"
                    className="setup-input"
                    style={{ flex: 1, minWidth: "220px", fontSize: "0.85rem", padding: "0.35rem 0.6rem" }}
                    placeholder="e.g. Google Drive ID, image URL, or cardback query"
                    value={defaultCardBack}
                    onChange={(e) => handleSaveCardBack(e.target.value)}
                  />
                </div>

                {/* Download and actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button 
                    className="setup-btn" 
                    onClick={handleResyncGroupDecks} 
                    disabled={resyncingGroupDecks}
                    style={{ background: "#3b82f6" }}
                  >
                    {resyncingGroupDecks ? "Syncing..." : "🔄 Resync All Playgroup Decks"}
                  </button>
                  <button className="setup-btn" onClick={handleDownloadMpcXml} disabled={mpcListCount === 0}>
                    🛠️ Generate MPCfill XML Manifest
                  </button>
                  <button
                    className="setup-btn"
                    onClick={handleCopyMpcTextList}
                    disabled={mpcListCount === 0}
                    style={{ background: "rgba(59, 130, 246, 0.2)", borderColor: "rgba(59, 130, 246, 0.4)", color: "#93c5fd" }}
                    title="Copy card names in MPCfill text format (e.g. 2x Card Name)"
                  >
                    📋 Copy MPCfill Quick List
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

      {/* VIEW 3: PROXY SETTINGS */}
      {activeTab === "settings" && (
        <div className="proxy-settings-container">

          {/* Card 1: Active Playgroup Selection */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">👥 Active Playgroup Selection</h3>
              {activeGroup && (
                <span className="mpc-alert-badge met">
                  Current: {activeGroup.name}
                </span>
              )}
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
              Select which playgroup is currently active for shared wishlist calculation and proxy manifests.
            </p>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Active Playgroup:</label>
              <select
                className="setup-input"
                style={{ minWidth: "220px" }}
                value={activeGroup?.id || ""}
                onChange={(e) => {
                  const sel = playgroups.find((g) => g.id === e.target.value);
                  if (sel) setActiveGroup(sel);
                }}
              >
                {playgroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count || 1} members)
                  </option>
                ))}
                {playgroups.length === 0 && <option value="">No playgroups joined</option>}
              </select>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#e2e8f0" }}>Create New Playgroup</h4>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New playgroup name..."
                    className="setup-input"
                    style={{ flex: 1 }}
                  />
                  <button onClick={handleCreateGroup} className="setup-btn">Create</button>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: "240px" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#e2e8f0" }}>Manage Group Access</h4>
                <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                  Invite friends via link or leave this playgroup.
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleGenerateInviteLink}
                    className="setup-btn"
                    style={{ background: "#3b82f6", flex: 1 }}
                    disabled={!activeGroup}
                  >
                    🔗 Copy Invite Link
                  </button>
                  <button
                    onClick={handleLeaveGroup}
                    className="setup-btn"
                    style={{ background: "transparent", border: "1px solid #ef4444", color: "#f87171" }}
                    disabled={!activeGroup}
                  >
                    🚪 Leave Group
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Playgroup Cost Per Proxy */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">💲 Playgroup Cost per Proxy</h3>
              <span className="mpc-alert-badge met" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#93c5fd" }}>
                Estimated Cost: ${(mpcActiveCards.length * mpcUnitCost).toFixed(2)}
              </span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
              Set your target per-card print cost for MakePlayingCards orders (default is $0.25/card).
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Cost Per Proxy ($):</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={mpcUnitCost}
                onChange={(e) => setMpcUnitCost(parseFloat(e.target.value) || 0)}
                className="setup-input"
                style={{ width: "120px" }}
              />
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                (Calculates individual member cost splitting for {mpcListCount} total cards)
              </span>
            </div>
          </div>

          {/* Card 3: Individual Cardback Options & Prebuilt Defaults */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3 className="settings-card-title">🎨 Individual Cardback Preferences</h3>
              {defaultCardBack && (
                <span className="mpc-alert-badge met" style={{ background: "rgba(16, 185, 129, 0.15)" }}>
                  Active Cardback Selected
                </span>
              )}
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 0 }}>
              Choose your default cardback for proxy orders. Pick from prebuilt defaults below or input a custom Google Drive ID / search query string.
            </p>

            {/* Custom Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                Custom ID / Query String:
              </label>
              <input
                type="text"
                className="setup-input"
                style={{ flex: 1, minWidth: "260px" }}
                placeholder="e.g. Google Drive ID, image URL, or search query (e.g. b:black lotus)"
                value={defaultCardBack}
                onChange={(e) => handleSaveCardBack(e.target.value)}
              />
              {defaultCardBack && (
                <button
                  className="btn-secondary"
                  onClick={() => handleSaveCardBack("")}
                  style={{ padding: "0.4rem 0.75rem" }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Prebuilt Cardbacks Grid */}
            <h4 style={{ margin: "1rem 0 0.5rem 0", fontSize: "0.95rem", color: "#f1f5f9" }}>
              Prebuilt Cardback Defaults ({prebuiltCardbacks.length}):
            </h4>
            <div className="cardback-grid">
              {prebuiltCardbacks.map((cb) => {
                const isSelected =
                  (cb.driveId && defaultCardBack === cb.driveId) ||
                  (cb.query && defaultCardBack === cb.query) ||
                  (cb.id && defaultCardBack === cb.id);

                return (
                  <div
                    key={cb.id}
                    className={`cardback-option-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSaveCardBack(cb.driveId || cb.query || cb.name)}
                  >
                    {isSelected && <span className="cardback-selected-badge">✓ Active</span>}
                    <div className="cardback-preview-wrapper">
                      <img
                        src={cb.previewUrl || "https://cards.scryfall.io/card_back.png"}
                        alt={cb.name}
                        className="cardback-preview-img"
                        onError={(e) => { e.target.src = "https://cards.scryfall.io/card_back.png"; }}
                      />
                    </div>
                    <div className="cardback-name">{cb.name}</div>
                    <div className="cardback-author">{cb.author || "Community"}</div>
                    <div className="cardback-dpi">{cb.dpi || "800 DPI"}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal-container bulk-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h2>📥 Bulk Import to Proxy Wishlist</h2>
                <p>Paste decklists or drop CSV/text files (Moxfield, ManaBox, Scryfall CSV, Archidekt, etc.)</p>
              </div>
              <button className="modal-close-btn" onClick={() => !importing && setShowImportModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div
                className={`import-dropzone ${isDragging ? "dragging" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileRead(e.dataTransfer.files[0]);
                  }
                }}
              >
                <span className="dropzone-icon">📄</span>
                <span className="dropzone-text">Drag & drop decklist or CSV file here, or</span>
                <label className="file-browse-btn">
                  Browse File
                  <input
                    type="file"
                    accept=".csv,.txt,.json"
                    onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
                    hidden
                  />
                </label>
              </div>

              <div className="textarea-wrapper">
                <label className="input-label">Paste Decklist or Raw CSV Data:</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Example Moxfield / Text format:\n4 Brainstorm\n1 Sol Ring (C21) 255 *F*\n1 Watery Grave\n\nOr CSV with headers:\nQuantity,Name,Set,Collector Number,Foil\n1,"Cyclonic Rift",RTR,35,true`}
                  rows={7}
                  className="import-textarea"
                  disabled={importing}
                />
              </div>

              {parsedPreviewCards.length > 0 && (
                <div className="import-preview-box">
                  <div className="preview-header">
                    <span>✅ Detected <strong>{parsedPreviewCards.length}</strong> unique cards ({parsedPreviewCards.reduce((s, c) => s + c.quantity, 0)} total items)</span>
                  </div>
                  <div className="preview-list-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Qty</th>
                          <th>Card Name</th>
                          <th>Set</th>
                          <th>#</th>
                          <th>Foil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedPreviewCards.slice(0, 15).map((c, idx) => (
                          <tr key={idx}>
                            <td>{c.quantity}x</td>
                            <td>{c.card_name}</td>
                            <td>{c.set_code || "Auto"}</td>
                            <td>{c.collector_number || "-"}</td>
                            <td>{c.is_foil ? "✨ Foil" : "Normal"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedPreviewCards.length > 15 && (
                      <div className="preview-more">... and {parsedPreviewCards.length - 15} more cards</div>
                    )}
                  </div>
                </div>
              )}

              {importStatus && (
                <div className="import-status-banner">
                  <span className="spinner">⏳</span> {importStatus}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => { setImportText(""); setImportStatus(""); }}
                disabled={importing || !importText}
              >
                Clear
              </button>
              <div className="right-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleImportCards}
                  disabled={importing || parsedPreviewCards.length === 0}
                >
                  {importing ? "Importing..." : `Import ${parsedPreviewCards.reduce((s, c) => s + c.quantity, 0)} Cards`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Cheap Cards Modal */}
      {showCheapModal && (
        <div className="modal-overlay" onClick={() => !deletingCheap && setShowCheapModal(false)}>
          <div className="modal-container cheap-cards-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h2>🏷️ Remove Cheap Cards from Proxy List</h2>
                <p>Purge cards from your proxy wishlist if their purchase price is at or below your set threshold.</p>
              </div>
              <button className="modal-close-btn" onClick={() => !deletingCheap && setShowCheapModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="threshold-setting-box">
                <label className="input-label">Max Price Threshold ($):</label>
                <div className="threshold-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0.01"
                    value={cheapThreshold}
                    onChange={(e) => setCheapThreshold(e.target.value)}
                    className="setup-input threshold-input"
                    disabled={deletingCheap}
                  />
                </div>
                <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
                    Active Retail Providers:
                  </span>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <label style={{ fontSize: "0.85rem", color: "#f472b6", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={showLotusColumn}
                        onChange={(e) => setShowLotusColumn(e.target.checked)}
                        disabled={deletingCheap}
                      />
                      🌸 LotusVault ($0 Local)
                    </label>
                    <label style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={showManaPoolColumn}
                        onChange={(e) => setShowManaPoolColumn(e.target.checked)}
                        disabled={deletingCheap}
                      />
                      ⚡ ManaPool Market
                    </label>
                  </div>
                </div>
                <p className="threshold-hint" style={{ marginTop: "0.5rem" }}>
                  Cards with an active retail price <strong>&le; ${parseFloat(cheapThreshold || 0).toFixed(2)}</strong> across selected providers will be purged.
                </p>
              </div>

              <div className="cheap-preview-box">
                <div className="preview-header">
                  <span>
                    Matches: <strong>{cheapCardsList.length}</strong> of {wishlist.length} unique cards ({cheapCardsList.reduce((s, c) => s + c.quantity, 0)} total copies)
                  </span>
                </div>

                {cheapCardsList.length > 0 ? (
                  <div className="preview-list-scroll">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Qty</th>
                          <th>Card Name</th>
                          <th>Finish</th>
                          <th>Retail Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cheapCardsList.map((c) => (
                          <tr key={c.id}>
                            <td>{c.quantity}x</td>
                            <td className="font-bold">{c.card_name}</td>
                            <td>{c.is_foil ? "✨ Foil" : "Normal"}</td>
                            <td className="cheap-price-tag">${c.price.toFixed(2)}</td>
                            <td><span className="purge-badge">Purge</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-preview-notice">
                    No cards in your wishlist match the threshold of &le; ${parseFloat(cheapThreshold || 0).toFixed(2)}.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn-secondary"
                onClick={() => setShowCheapModal(false)}
                disabled={deletingCheap}
              >
                Cancel
              </button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-primary"
                  style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                  onClick={handleBuyCheapCardsOnManaPool}
                  disabled={cheapCardsList.length === 0}
                >
                  ⚡ Bulk Buy {cheapCardsList.length} Cards on ManaPool ↗
                </button>
                <button
                  className="btn-primary btn-danger-action"
                  onClick={handleRemoveCheapCards}
                  disabled={deletingCheap || cheapCardsList.length === 0}
                >
                  {deletingCheap ? "Removing..." : `Purge ${cheapCardsList.length} Cheap Cards`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LotusVault & ManaPool Price & Shipping Drawer */}
      <MarketplacePriceDrawer
        isOpen={showMarketplaceDrawer}
        onClose={() => setShowMarketplaceDrawer(false)}
        cardName={drawerCardName}
        cardList={drawerCardList}
      />

    </div>
  );
}
