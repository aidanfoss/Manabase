import React, { useState, useEffect, useRef, useMemo } from "react";
import PlaygroupNexus from "./wishlist/PlaygroupNexus";
import OrderHistory from "./wishlist/OrderHistory";
import ProxySettings from "./wishlist/ProxySettings";
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  LinkIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  TrophyIcon,
  ArrowsRightLeftIcon,
  PaintBrushIcon,
  SparklesIcon,
  PrinterIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  InboxIcon,
  TagIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  LockClosedIcon,
  ArrowRightOnRectangleIcon,
  RocketLaunchIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  HandRaisedIcon,
  ClockIcon,
  ShoppingBagIcon,
  InformationCircleIcon,
  PhotoIcon,
  EyeIcon
} from "@heroicons/react/24/solid";

import { api } from "../api/client";
import { parseImportInput } from "../utils/csvImporter";
import { isDoubleFacedCard, getCardFrontName, getCardBackName, formatMpcTextList } from "../utils/cardHelpers";
import {
  getPrintVariantLabel,
  getUniqueSetsFromPrints,
  getFinishVersionOptions,
  getCardImageUrl,
  generateManaPoolCheckoutUrl
} from "../utils/WishlistHelpers";
import MarketplacePriceDrawer from "./MarketplacePriceDrawer";
import ProxyArtSettings from "./ProxyArtSettings";
import { useToast } from "../context/ToastContext";
import { useWishlist } from "../context/WishlistProvider";
import "../styles/wishlist.css";

export default function WishlistHub() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("lists"); // "lists", "nexus", "trades"
  const [selectedList, setSelectedList] = useState("proxy_wishlist");
  const [showMarketplaceDrawer, setShowMarketplaceDrawer] = useState(false);
  const [drawerCardName, setDrawerCardName] = useState("");
  const [drawerCardList, setDrawerCardList] = useState([]);

  // Card Hover Preview & Card Detail Modal states
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [modalCard, setModalCard] = useState(null);

  // Retail provider toggle states & retail price cache (defaulting to both true)
  const [showLotusColumn, setShowLotusColumn] = useState(true);
  const [showManaPoolColumn, setShowManaPoolColumn] = useState(true);
  const { retailPrices, setRetailPrices, loadingRetail, setLoadingRetail } = useWishlist();
  const [activeTrades, setActiveTrades] = useState([]);
  const [counterTrade, setCounterTrade] = useState(null);
  const [counterOffer, setCounterOffer] = useState([]);
  const [counterDemand, setCounterDemand] = useState([]);
  // Lists data states
  const { wishlist, setWishlist, optionalProxies, setOptionalProxies, loading, setLoading } = useWishlist();

  // Bulk import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // User Proxy Arts
  const { userProxyArts, setUserProxyArts } = useWishlist();
  const [missingArtsCount, setMissingArtsCount] = useState(0);

  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Playgroups states
  const {
    playgroups, setPlaygroups,
    activeGroup, setActiveGroup,
    groupMembers, setGroupMembers,
    groupWishlist, setGroupWishlist
  } = useWishlist();
  const [newGroupName, setNewGroupName] = useState("");

  // Print view state
  const [showPrintMode, setShowPrintMode] = useState(false);

  // Remove Cheap Cards modal states
  const [showCheapModal, setShowCheapModal] = useState(false);
  const [cheapThreshold, setCheapThreshold] = useState(1.00);
  const [deletingCheap, setDeletingCheap] = useState(false);

  // Prints resolution cache
  const { printsCache, setPrintsCache, selectedPrints, setSelectedPrints } = useWishlist();

  // MPC print cost config (default $0.25)
  const [mpcUnitCost, setMpcUnitCost] = useState(0.25);

  // Playgroup Decks Resync Lock
  const [hasResyncedGroupDecks, setHasResyncedGroupDecks] = useState(false);
  const [resyncingGroupDecks, setResyncingGroupDecks] = useState(false);

  // Manifest opt-out state (off by default  user must explicitly opt IN)
  const [manifestOptedOut, setManifestOptedOut] = useState(true);
  const [togglingOptOut, setTogglingOptOut] = useState(false);

  // Order History & Order Confirmation States
  const { orderHistory, setOrderHistory, loadingHistory, setLoadingHistory } = useWishlist();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmTargetScope, setConfirmTargetScope] = useState("playgroup"); // "playgroup" or "personal"
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const loadOrderHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/proxy-orders/history", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrderHistory(data || []);
      }
    } catch (err) {
      console.error("Failed to load order history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadOrderHistory();
  }, []);

  const handleConfirmOrderSubmit = async () => {
    if (!confirmChecked) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setConfirmingOrder(true);
    try {
      const res = await fetch("/api/proxy-orders/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          playgroup_id: confirmTargetScope === "playgroup" ? activeGroup?.id : null,
          unit_cost: mpcUnitCost
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast("Success! Order confirmed and saved to Order History.", "success");
        setShowConfirmModal(false);
        setConfirmChecked(false);
        await loadLists();
        if (activeGroup) await loadPlaygroupDetails(activeGroup.id);
        await loadOrderHistory();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to confirm order.");
      }
    } catch (err) {
      console.error("Error confirming order:", err);
      alert("Failed to confirm order.");
    } finally {
      setConfirmingOrder(false);
    }
  };

  const handleRestoreOrder = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/proxy-orders/${orderId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Order restored to wishlist!", "success");
        await loadLists();
        if (activeGroup) await loadPlaygroupDetails(activeGroup.id);
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to restore order.");
      }
    } catch (e) {
      console.error("Restore order error:", e);
      alert("Failed to restore order.");
    }
  };

  const handleMoveToTradelist = async (orderId) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/proxy-orders/${orderId}/move-to-tradelist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || "Added cards from order to tradelist!", "success");
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to move cards to tradelist.");
      }
    } catch (e) {
      console.error("Move to tradelist error:", e);
      alert("Failed to move cards to tradelist.");
    }
  };

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
          body: JSON.stringify({ cards: chunk, list_kind: selectedList === "optional_proxies" ? "optional_proxies" : "proxy_wishlist" }),
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
      window.dispatchEvent(new Event("refreshAlerts"));

      alert(` Successfully imported ${totalAdded} total cards into your ${selectedList === "optional_proxies" ? "Optional Proxies" : "Proxy Wishlist"}!`);
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
  const { defaultCardBack, setDefaultCardBack } = useWishlist();
  //   return localStorage.getItem("manabase_default_card_back") || "b:black lotus";
  // });

  // Prebuilt cardbacks list loaded from webserver
  const { prebuiltCardbacks, setPrebuiltCardbacks } = useWishlist();

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

    fetchProxyArts();
  }, []);

  const fetchProxyArts = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch("/api/user/proxy-arts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserProxyArts(data);
      }
    } catch (err) {
      console.error("Failed to load proxy arts:", err);
    }
  };

  // Pre-fetch missing arts info
  useEffect(() => {
    if (!wishlist || wishlist.length === 0) {
      setMissingArtsCount(0);
      return;
    }
    const savedNames = new Set(userProxyArts.map(a => a.card_name.toLowerCase()));
    const missingUniqueNames = new Set();
    wishlist.forEach(c => {
      const meta = printsCache[c.card_name];
      const isDfc = isDoubleFacedCard(c, meta);

      let frontName = c.card_name.toLowerCase();
      let backName = null;
      
      if (isDfc && c.card_name.includes(" // ")) {
        const faces = c.card_name.split(" // ");
        frontName = faces[0].toLowerCase();
        backName = faces.length > 1 ? faces[1].toLowerCase() : null;
      }

      if (!savedNames.has(frontName)) {
        missingUniqueNames.add(frontName);
      }
      
      if (isDfc && backName && !savedNames.has(backName)) {
        missingUniqueNames.add(backName);
      }
    });
    setMissingArtsCount(missingUniqueNames.size);
  }, [wishlist, userProxyArts, printsCache]);

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
      const resWish = await fetch("/api/lists/proxy_wishlist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resWish.ok) {
        newWishlist = await resWish.json() || [];
        setWishlist(newWishlist);
        window.dispatchEvent(new Event("refreshAlerts"));
      }

      // Fetch Optional Proxies
      let newOptionalProxies = [];
      const resOpt = await fetch("/api/lists/optional_proxies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resOpt.ok) {
        newOptionalProxies = await resOpt.json() || [];
        setOptionalProxies(newOptionalProxies);
      }

      const uniqueNames = [...new Set([
        ...newWishlist.map(c => c.card_name),
        ...newOptionalProxies.map(c => c.card_name)
      ])];

      if (uniqueNames.length > 0) {
        fetchPrintsBatch(uniqueNames, [...newWishlist, ...newOptionalProxies]);
        fetchRetailPrices([...newWishlist, ...newOptionalProxies]);
      }

    } catch (e) {
      console.error("Failed to load lists:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrintsBatch = async (cardNames, wList) => {
    const namesToFetch = cardNames.filter(name => !printsCache[name]);
    console.log("[WishlistHub] fetchPrintsBatch requested for:", cardNames, "Uncached to fetch:", namesToFetch);
    if (namesToFetch.length === 0) return;

    try {
      const batchResult = await api.getCardDetailsBatch(namesToFetch);
      console.log(" [WishlistHub] getCardDetailsBatch result keys:", Object.keys(batchResult || {}), batchResult);

      setPrintsCache(prev => {
        const next = { ...prev, ...batchResult };
        console.log(" [WishlistHub] Updated printsCache size:", Object.keys(next).length);
        return next;
      });

      setSelectedPrints(prev => {
        const next = { ...prev };
        const currentList = [...(wList || wishlist)];

        namesToFetch.forEach(cardName => {
          const cardData = batchResult[cardName];
          if (!cardData) {
            console.warn(` [WishlistHub] No cardData returned for "${cardName}" in batch response!`);
          } else if (!cardData.prints || cardData.prints.length === 0) {
            console.warn(` [WishlistHub] cardData for "${cardName}" has EMPTY prints array!`, cardData);
          } else {
            console.log(`[WishlistHub] "${cardName}" has ${cardData.prints.length} printings.`);
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
      console.error("[WishlistHub] Failed to fetch card prints batch:", err);
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
        list_kind: selectedList === "optional_proxies" ? "optional_proxies" : "proxy_wishlist",
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
        window.dispatchEvent(new Event("refreshAlerts"));
      }
    } catch (e) {
      console.error("Failed to add card:", e);
    }
  };

  // Update card in list
  const updateCardDetails = async (card, updates, targetListKind = null) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      if (targetListKind && targetListKind !== card.list_type && targetListKind !== (card.list_type === "wishlist" ? "proxy_wishlist" : "")) {
        // We are moving the card to a different list. Delete old card first to avoid duplicates.
        await fetch(`/api/lists/${card.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      const payload = {
        card_name: card.card_name,
        list_kind: targetListKind || (card.list_type === "optional_proxies" ? "optional_proxies" : "proxy_wishlist"),
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
        window.dispatchEvent(new Event("refreshAlerts"));
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
      window.dispatchEvent(new Event("refreshAlerts"));
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
        window.dispatchEvent(new Event("refreshAlerts"));
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
        alert(` Successfully removed ${data.count || cheapCardsList.length} cheap cards ( $${parseFloat(cheapThreshold || 0).toFixed(2)}) from your Proxy Wishlist!`);
        setShowCheapModal(false);
        await loadLists();
        window.dispatchEvent(new Event("refreshAlerts"));
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
      alert(`No cheap cards match your current threshold of  $${parseFloat(cheapThreshold || 0).toFixed(2)}.`);
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
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setGroupMembers(membersData);
        // Sync the local opted-out state from the server response for the current user
        const token2 = localStorage.getItem("token");
        try {
          // Decode user id from JWT payload
          const payload = JSON.parse(atob(token2.split(".")[1]));
          const myMembership = membersData.find(m => m.id === payload.id || m.id === payload.userId || m.id === payload.sub);
          if (myMembership) {
            setManifestOptedOut(!!myMembership.opted_out_of_manifest);
          }
        } catch (_) { /* ignore decode errors */ }
      }

      // Fetch group bundled wishlists
      const wishlistRes = await fetch(`/api/playgroups/${groupId}/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (wishlistRes.ok) setGroupWishlist(await wishlistRes.json());

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

  const handleToggleManifestOptOut = async () => {
    if (!activeGroup) return;
    const newOptedOut = !manifestOptedOut;
    setTogglingOptOut(true);
    try {
      await api.toggleManifestOptOut(activeGroup.id, newOptedOut);
      setManifestOptedOut(newOptedOut);
      // Re-fetch group wishlist so the manifest card count updates immediately
      await loadPlaygroupDetails(activeGroup.id);
      showToast(
        newOptedOut
          ? "You've opted OUT of the proxy manifest. Your cards won't be included in the next print order."
          : "You've opted IN to the proxy manifest. Your cards will be included in the next print order.",
        newOptedOut ? "warning" : "success"
      );
    } catch (e) {
      showToast("Failed to update manifest opt-out setting.", "error");
    } finally {
      setTogglingOptOut(false);
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
        showToast(`Playgroup invite link copied to clipboard!`, "success");
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
      alert(`${res.message}\nAdded: ${res.stats.added}, Removed: ${res.stats.removed}, Ignored: ${res.stats.ignored}`);
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
        console.warn(" [WishlistHub] Could not fetch latest group wishlist prior to XML export:", e);
      }
    }

    const printQueue = latestQueue.slice(0, 612);

    // 2. Fetch/verify printsCache metadata for all cards in the manifest
    if (printQueue.length > 0) {
      const cardNames = Array.from(new Set(printQueue.map((c) => c.card_name)));
      try {
        await fetchPrintsBatch(cardNames, latestQueue);
      } catch (e) {
        console.warn(" [WishlistHub] Could not refresh prints cache prior to XML export:", e);
      }
    }

    return printQueue;
  };

  const handleCopyMpcTextList = async () => {
    if (groupWishlist.length === 0) return;
    showToast("Verifying latest manifest data...", "info");

    const printQueue = await verifyAndGetManifest();
    if (printQueue.length === 0) {
      showToast("No cards in print queue.", "warning");
      return;
    }

    const textList = formatMpcTextList(printQueue, printsCache, defaultCardBack);
    await navigator.clipboard.writeText(textList);
    showToast("Copied MPCfill formatted card list to clipboard!", "success");
  };

  const handleDownloadMpcXml = async () => {
    if (groupWishlist.length === 0) return;
    showToast("Verifying latest manifest data...", "info");

    const printQueue = await verifyAndGetManifest();
    if (printQueue.length === 0) {
      showToast("No cards in print queue to generate XML.", "warning");
      return;
    }

    // Group cards by card_name + set_code + collector_number + mpcfill_id to combine slot indices
    const cardGroups = new Map();

    printQueue.forEach((c, slotIndex) => {
      const meta = printsCache[c.card_name];
      const isDfc = isDoubleFacedCard(c, meta);
      const name = isDfc ? getCardFrontName(c, meta) : (c.card_name || c.name || "Unknown Card");
      
      const mpcfillId = c.mpcfill_id || "";
      const mpcfileName = c.mpcfill_name || (name.match(/\.(png|jpg|jpeg)$/i) ? name : `${name}.png`);
      const mpcfillQuery = c.mpcfill_query || name;
      
      const key = `${name}__${c.set_code || ""}__${c.collector_number || ""}__${mpcfillId}`;
      if (!cardGroups.has(key)) {
        cardGroups.set(key, {
          name: name,
          set_code: c.set_code || "",
          collector_number: c.collector_number || "",
          mpcfillId,
          mpcfileName,
          mpcfillQuery,
          slots: [slotIndex]
        });
      } else {
        cardGroups.get(key).slots.push(slotIndex);
      }
      
      console.log(`[WishlistHub Export] Card: "${name}", User: "${c.username}", MPCFill ID: "${mpcfillId}", MPCFill Name: "${mpcfileName}"`);
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
      xml += `        <card>\n`;
      xml += `            <id>${escapeXml(group.mpcfillId)}</id>\n`;
      xml += `            <slots>${group.slots.join(",")}</slots>\n`;
      xml += `            <name>${escapeXml(group.mpcfileName)}</name>\n`;
      xml += `            <query>${escapeXml(group.mpcfillQuery)}</query>\n`;
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
          cardId: c.mpcfill_back_id || "",
          queryVal: c.mpcfill_back_query || backName,
          fileName: c.mpcfill_back_name || `${backName}.png`,
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
    console.group(" [MPCfill XML Generator] Verbose Debug Log");
    console.log(` Active Group: "${activeGroup?.name || "group"}"`);
    console.log(`Total Cards in Print Queue: ${printQueue.length}`);
    printQueue.forEach((c, idx) => {
      const isDfc = isDoubleFacedCard(c);
      console.log(
        `  Slot [${idx}]: "${c.card_name}" | DFC=${isDfc} | Owner="${c.username}" | Cardback="${c.user_card_back || "(none)"}"`
      );
    });
    console.log(`Primary Default <cardback>: "${globalCardbackVal}" (used by ${maxCount} cards)`);
    console.log(`Override Cardbacks / DFC Backs Count: ${overrideBacksMap.size}`);

    xml += `    </fronts>\n`;
    xml += `    <backs>\n`;

    for (const backGroup of overrideBacksMap.values()) {
      console.log(`Exporting <backs> entry (DFC / Override):`, {
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
    showToast("Verified manifest data & downloaded XML!", "success");
  };

  const verifyAndGetMyManifest = async () => {
    // 1. Flatten wishlist and attach mpcfill fields from userProxyArts
    const flatQueue = [];
    const proxyArts = userProxyArts || [];

    // Combine wishlist and optionalProxies (just like playgroup does)
    const currentList = [...wishlist, ...optionalProxies].sort((a, b) => {
      return new Date(a.created_at) - new Date(b.created_at);
    });

    currentList.forEach((item) => {
      const meta = printsCache[item.card_name];
      const isDfc = isDoubleFacedCard(item, meta);

      let frontName = item.card_name;
      let backName = null;

      if (isDfc && item.card_name.includes(" // ")) {
        const faces = item.card_name.split(" // ");
        frontName = faces[0];
        backName = faces.length > 1 ? faces[1] : null;
      }

      const frontArt = proxyArts.find(a => a.card_name.toLowerCase() === frontName.toLowerCase());
      const backArt = backName ? proxyArts.find(a => a.card_name.toLowerCase() === backName.toLowerCase()) : null;

      for (let i = 0; i < item.quantity; i++) {
        flatQueue.push({
          ...item,
          username: "Me",
          mpcfill_id: frontArt?.mpcfill_id || null,
          mpcfill_name: frontArt?.mpcfill_name || null,
          mpcfill_query: frontArt?.mpcfill_query || null,
          mpcfill_back_id: backArt?.mpcfill_id || null,
          mpcfill_back_name: backArt?.mpcfill_name || null,
          mpcfill_back_query: backArt?.mpcfill_query || null,
          user_card_back: item.user_card_back || defaultCardBack || "b:black lotus",
        });
      }
    });

    const printQueue = flatQueue.slice(0, 612);

    if (printQueue.length > 0) {
      const cardNames = Array.from(new Set(printQueue.map((c) => c.card_name)));
      try {
        await fetchPrintsBatch(cardNames, currentList);
      } catch (e) {
        console.warn(" [WishlistHub] Could not refresh prints cache prior to XML export:", e);
      }
    }

    return printQueue;
  };

  const handleDownloadMyMpcXml = async () => {
    if (wishlist.length === 0 && optionalProxies.length === 0) return;
    showToast("Verifying your manifest data...", "info");

    const printQueue = await verifyAndGetMyManifest();
    if (printQueue.length === 0) {
      showToast("No cards in print queue to generate XML.", "warning");
      return;
    }

    // Group cards by card_name + set_code + collector_number + mpcfill_id to combine slot indices
    const cardGroups = new Map();

    printQueue.forEach((c, slotIndex) => {
      const meta = printsCache[c.card_name];
      const isDfc = isDoubleFacedCard(c, meta);
      const name = isDfc ? getCardFrontName(c, meta) : (c.card_name || c.name || "Unknown Card");
      
      const mpcfillId = c.mpcfill_id || "";
      const mpcfileName = c.mpcfill_name || (name.match(/\.(png|jpg|jpeg)$/i) ? name : `${name}.png`);
      const mpcfillQuery = c.mpcfill_query || name;
      
      const key = `${name}__${c.set_code || ""}__${c.collector_number || ""}__${mpcfillId}`;
      if (!cardGroups.has(key)) {
        cardGroups.set(key, {
          name: name,
          set_code: c.set_code || "",
          collector_number: c.collector_number || "",
          mpcfillId,
          mpcfileName,
          mpcfillQuery,
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
      xml += `        <card>\n`;
      xml += `            <id>${escapeXml(group.mpcfillId)}</id>\n`;
      xml += `            <slots>${group.slots.join(",")}</slots>\n`;
      xml += `            <name>${escapeXml(group.mpcfileName)}</name>\n`;
      xml += `            <query>${escapeXml(group.mpcfillQuery)}</query>\n`;
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
          cardId: c.mpcfill_back_id || "",
          queryVal: c.mpcfill_back_query || backName,
          fileName: c.mpcfill_back_name || `${backName}.png`,
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

    xml += `    </fronts>\n`;
    xml += `    <backs>\n`;

    for (const backGroup of overrideBacksMap.values()) {
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
    link.download = `my_mpcfill_manifest.xml`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Verified manifest data & downloaded XML!", "success");
  };

  const handleDownloadMissingArtsXml = async () => {
    if (wishlist.length === 0) return;

    const savedNames = new Set(userProxyArts.map(a => a.card_name.toLowerCase()));
    
    // Filter out cards that ALREADY have an art selected BY THIS USER
    // And deduplicate so we only ask for exactly 1 of each missing card
    const uniqueMissingCards = new Map();

    wishlist.forEach(c => {
      const meta = printsCache[c.card_name];
      const isDfc = isDoubleFacedCard(c, meta);
      
      let frontName = c.card_name;
      let backName = null;
      
      if (isDfc && c.card_name.includes(" // ")) {
        const faces = c.card_name.split(" // ");
        frontName = faces[0];
        backName = faces.length > 1 ? faces[1] : null;
      }
      
      const isFrontMissing = !savedNames.has(frontName.toLowerCase());
      const isBackMissing = isDfc && backName && !savedNames.has(backName.toLowerCase());
      
      if (isFrontMissing || isBackMissing) {
        if (!uniqueMissingCards.has(c.card_name.toLowerCase())) {
          uniqueMissingCards.set(c.card_name.toLowerCase(), {
            name: c.card_name, // e.g. "Boggart Trawler // Boggart Bog"
            frontName: frontName,
            backName: backName,
            isDfc: isDfc,
            set_code: c.set_code || "",
            collector_number: c.collector_number || ""
          });
        }
      }
    });
    
    if (uniqueMissingCards.size === 0) {
      showToast("All cards already have a selected art!", "success");
      return;
    }

    const escapeXml = (str) => {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<order>\n`;
    xml += `    <details>\n`;
    xml += `        <quantity>${uniqueMissingCards.size}</quantity>\n`;
    xml += `        <stock>(S30) Standard Smooth</stock>\n`;
    xml += `        <foil>false</foil>\n`;
    xml += `    </details>\n`;
    
    let slotIdx = 0;
    
    // Generate Fronts
    xml += `    <fronts>\n`;
    for (const group of uniqueMissingCards.values()) {
      const fileName = group.frontName.match(/\.(png|jpg|jpeg)$/i) ? group.frontName : `${group.frontName}.png`;
      xml += `        <card>\n`;
      xml += `            <id></id>\n`;
      xml += `            <slots>${slotIdx}</slots>\n`;
      xml += `            <name>${escapeXml(fileName)}</name>\n`;
      xml += `            <query>${escapeXml(group.frontName)}</query>\n`;
      xml += `        </card>\n`;
      slotIdx++;
    }
    xml += `    </fronts>\n`;
    
    // Generate Backs
    let hasBacks = false;
    let backsXml = `    <backs>\n`;
    let backSlotIdx = 0;
    for (const group of uniqueMissingCards.values()) {
      if (group.isDfc && group.backName) {
        hasBacks = true;
        const fileName = group.backName.match(/\.(png|jpg|jpeg)$/i) ? group.backName : `${group.backName}.png`;
        backsXml += `        <card>\n`;
        backsXml += `            <id></id>\n`;
        backsXml += `            <slots>${backSlotIdx}</slots>\n`;
        backsXml += `            <name>${escapeXml(fileName)}</name>\n`;
        backsXml += `            <query>${escapeXml(group.backName)}</query>\n`;
        backsXml += `        </card>\n`;
      }
      backSlotIdx++;
    }
    backsXml += `    </backs>\n`;
    
    if (hasBacks) {
      xml += backsXml;
    }
    
    xml += `    <cardback>b:black lotus</cardback>\n`;
    xml += `</order>\n`;

    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `missing_arts_mpcfill.xml`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded XML of cards missing art!", "success");
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
          <h2><PrinterIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Printable Proxy Sheets Layout</h2>
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
          <h1 className="wishlist-title"><SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Wishlist & Proxy Hub</h1>
          <p className="wishlist-subtitle">Manage proxy lists, chronological MakePlayingCards queues, and local playgroup trades.</p>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === "lists" ? "active" : ""}`}
          onClick={() => setActiveTab("lists")}
        >
          <ClipboardDocumentListIcon className="inline-icon" /> My Lists
        </button>
        <button
          className={`tab-btn ${activeTab === "nexus" ? "active" : ""}`}
          onClick={() => setActiveTab("nexus")}
        >
          <UserGroupIcon className="inline-icon" /> Playgroup Nexus
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("history");
            loadOrderHistory();
          }}
        >
          <ClockIcon className="inline-icon" /> Order History
          {orderHistory.length > 0 && <span className="tab-badge">{orderHistory.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Cog6ToothIcon className="inline-icon" /> Proxy Settings
        </button>
      </div>


      {/* VIEW 1: MY THREE LISTS */}
      {activeTab === "lists" && (
        <ListManager
          selectedList={selectedList}
          setSelectedList={setSelectedList}
          wishlist={wishlist}
          optionalProxies={optionalProxies}
          userProxyArts={userProxyArts}
          missingArtsCount={missingArtsCount}
          fetchProxyArts={fetchProxyArts}
          handleDownloadMissingArtsXml={handleDownloadMissingArtsXml}
          searchQuery={searchQuery}
          handleSearchChange={handleSearchChange}
          searching={searching}
          searchResults={searchResults}
          addCard={addCard}
          loading={loading}
          setShowImportModal={setShowImportModal}
          setShowCheapModal={setShowCheapModal}
          handleCopyMoxfield={handleCopyMoxfield}
          handleDownloadMpcCsv={handleDownloadMpcCsv}
          handleDownloadMyMpcXml={handleDownloadMyMpcXml}
          setShowPrintMode={setShowPrintMode}
          handleSetAllAnyPrinting={handleSetAllAnyPrinting}
          setConfirmTargetScope={setConfirmTargetScope}
          setConfirmChecked={setConfirmChecked}
          setShowConfirmModal={setShowConfirmModal}
          handleClearAll={handleClearAll}
          showLotusColumn={showLotusColumn}
          setShowLotusColumn={setShowLotusColumn}
          showManaPoolColumn={showManaPoolColumn}
          setShowManaPoolColumn={setShowManaPoolColumn}
          handleBuyCheapCardsOnManaPool={handleBuyCheapCardsOnManaPool}
          cheapCardsList={cheapCardsList}
          printsCache={printsCache}
          retailPrices={retailPrices}
          setHoveredCard={setHoveredCard}
          setHoverPosition={setHoverPosition}
          setModalCard={setModalCard}
          updateCardDetails={updateCardDetails}
          loadingRetail={loadingRetail}
          deleteCard={deleteCard}
          setDrawerCardName={setDrawerCardName}
          setDrawerCardList={setDrawerCardList}
          setShowMarketplaceDrawer={setShowMarketplaceDrawer}
          loadLists={loadLists}
        />
      )}

      {/* VIEW 2: PLAYGROUP NEXUS */}
      {activeTab === "nexus" && (
        <PlaygroupNexus
          activeGroup={activeGroup}
          setActiveGroup={setActiveGroup}
          playgroups={playgroups}
          loadPlaygroups={loadPlaygroups}
          printQueue={groupWishlist}
          mpcUnitCost={mpcUnitCost}
          setMpcUnitCost={setMpcUnitCost}
          defaultCardBack={defaultCardBack}
          handleSaveCardBack={handleSaveCardBack}
        />
      )}

      {/* VIEW 3: PROXY SETTINGS */}
      {activeTab === "settings" && <ProxySettings />}

      {/* VIEW 4: ORDER HISTORY */}
      {activeTab === "history" && <OrderHistory />}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal-container bulk-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h2><InboxIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Bulk Import to Proxy Wishlist</h2>
                <p>Paste decklists or drop CSV/text files (Moxfield, ManaBox, Scryfall CSV, Archidekt, etc.)</p>
              </div>
              <button className="modal-close-btn" onClick={() => !importing && setShowImportModal(false)}></button>
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
                <span className="dropzone-icon"><DocumentTextIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /></span>
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
                    <span><CheckCircleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Detected <strong>{parsedPreviewCards.length}</strong> unique cards ({parsedPreviewCards.reduce((s, c) => s + c.quantity, 0)} total items)</span>
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
                            <td>{c.is_foil ? "Foil" : "Normal"}</td>
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
                  <span className="spinner"></span> {importStatus}
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
                <h2><TagIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Remove Cheap Cards from Proxy List</h2>
                <p>Purge cards from your proxy wishlist if their purchase price is at or below your set threshold.</p>
              </div>
              <button className="modal-close-btn" onClick={() => !deletingCheap && setShowCheapModal(false)}></button>
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
                      <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault ($0 Local)
                    </label>
                    <label style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={showManaPoolColumn}
                        onChange={(e) => setShowManaPoolColumn(e.target.checked)}
                        disabled={deletingCheap}
                      />
                      <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool Market
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
                            <td>{c.is_foil ? "Foil" : "Normal"}</td>
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
                  <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Bulk Buy {cheapCardsList.length} Cards on ManaPool 
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
      {/* CONFIRM ORDER MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => !confirmingOrder && setShowConfirmModal(false)}>
          <div className="modal-container" style={{ maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h2>
                  <CheckCircleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '6px', color: "#10b981" }} />
                  Confirm Proxy Order
                </h2>
                <p>Verify and save your order into Order History</p>
              </div>
              <button className="modal-close-btn" onClick={() => !confirmingOrder && setShowConfirmModal(false)}></button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "0.85rem", color: "#34d399", fontSize: "0.85rem" }}>
                <p style={{ margin: 0, fontWeight: "600" }}>
                  Confirming this order will save it to your Order History and clear the ordered cards from the proxy wishlist.
                </p>
                <p style={{ margin: "0.3rem 0 0 0", color: "#a7f3d0", fontSize: "0.78rem" }}>
                   Any overflow/deferred cards beyond the 612 cap will <strong>NOT</strong> be cleared and will remain in wishlists for future orders.
                </p>
              </div>

              <div style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                  <span style={{ color: "#94a3b8" }}>Order Scope:</span>
                  <strong style={{ color: "#f8fafc" }}>{confirmTargetScope === "playgroup" && activeGroup ? `Playgroup (${activeGroup.name})` : "Personal Wishlist"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                  <span style={{ color: "#94a3b8" }}>Active Cards to Clear:</span>
                  <strong style={{ color: "#34d399" }}>
                    {confirmTargetScope === "playgroup" ? Math.min(612, groupWishlist.length) : (selectedList === "optional_proxies" ? optionalProxies : wishlist).reduce((s, c) => s + c.quantity, 0)} cards
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                  <span style={{ color: "#94a3b8" }}>Est. Total Cost:</span>
                  <strong style={{ color: "#f8fafc" }}>
                    ${(
                      (confirmTargetScope === "playgroup" ? Math.min(612, groupWishlist.length) : (selectedList === "optional_proxies" ? optionalProxies : wishlist).reduce((s, c) => s + c.quantity, 0)) * mpcUnitCost
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.88rem", color: "#f8fafc", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#10b981" }}
                />
                <span>I confirm that I have ordered these cards on MakePlayingCards / MPCfill.</span>
              </label>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={confirmingOrder}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #059669, #10b981)", borderColor: "#34d399" }}
                onClick={handleConfirmOrderSubmit}
                disabled={confirmingOrder || !confirmChecked}
              >
                {confirmingOrder ? "Confirming..." : "Confirm & Clear Wishlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Card Hover Preview Tooltip */}
      {hoveredCard && (
        <div
          className="floating-card-preview"
          style={{
            left: `${Math.min(window.innerWidth - 270, hoverPosition.x)}px`,
            top: `${Math.min(window.innerHeight - 380, hoverPosition.y)}px`
          }}
        >
          {(() => {
            const cardMeta = printsCache[hoveredCard.card_name];
            const imgUrl = getCardImageUrl(hoveredCard, cardMeta);
            const price = resolveWishlistCardPrice(hoveredCard);
            return (
              <>
                {imgUrl ? (
                  <img src={imgUrl} alt={hoveredCard.card_name} />
                ) : (
                  <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                    No Image Available
                  </div>
                )}
                <div className="floating-preview-info">
                  <div className="floating-preview-name">{hoveredCard.card_name}</div>
                  {cardMeta?.type_line && <div className="floating-preview-type">{cardMeta.type_line}</div>}
                  <div className="floating-preview-price-row">
                    <span style={{ color: "#94a3b8" }}>Est. Price:</span>
                    <strong style={{ color: "#34d399" }}>${price > 0 ? price.toFixed(2) : "N/A"}</strong>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Rich Card Detail & Configuration Modal */}
      {modalCard && (
        <div className="modal-overlay" onClick={() => setModalCard(null)}>
          <div className="modal-container card-detail-modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const cardMeta = printsCache[modalCard.card_name];
              const prints = cardMeta?.prints || [];
              const imgUrl = getCardImageUrl(modalCard, cardMeta);
              const uniqueSets = getUniqueSetsFromPrints(prints);
              const finishOptions = getFinishVersionOptions(cardMeta, modalCard.set_code);
              const setPrints = modalCard.set_code
                ? prints.filter(p => p.set?.toUpperCase() === modalCard.set_code.toUpperCase())
                : prints;
              const activePrint = setPrints.length > 0
                ? (setPrints.find(p => modalCard.collector_number ? p.collector_number === modalCard.collector_number : true) || setPrints[0])
                : (prints[0] || cardMeta);
              const currentSelectedFinishKey = `${activePrint?.collector_number || modalCard.collector_number || ""}:${modalCard.is_foil ? "foil" : "normal"}`;
              const price = resolveWishlistCardPrice(modalCard);
              const rData = retailPrices[modalCard.card_name];

              return (
                <>
                  <div className="modal-header">
                    <div className="modal-header-title">
                      <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {modalCard.card_name}
                        {cardMeta?.mana_cost && <span style={{ fontSize: "0.9rem", color: "#94a3b8", fontWeight: "normal" }}>({cardMeta.mana_cost})</span>}
                      </h2>
                      <p>{cardMeta?.type_line || "Magic: The Gathering Card"}</p>
                    </div>
                    <button className="modal-close-btn" onClick={() => setModalCard(null)}></button>
                  </div>

                  <div className="card-detail-grid">
                    {/* Left: Card Art */}
                    <div className="card-detail-art-col">
                      {imgUrl ? (
                        <img src={imgUrl} alt={modalCard.card_name} className="card-detail-large-img" />
                      ) : (
                        <div style={{ width: "240px", height: "336px", background: "#1e293b", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                          No Art Available
                        </div>
                      )}
                    </div>

                    {/* Right: Info & Controls */}
                    <div className="card-detail-info-col">
                      {cardMeta?.oracle_text && (
                        <div>
                          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Oracle Rules Text:</span>
                          <div className="card-detail-oracle-box">
                            {cardMeta.oracle_text}
                          </div>
                        </div>
                      )}

                      {/* Price & Retail Breakdown */}
                      <div>
                        <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Market Pricing & Availability:</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.4rem" }}>
                          <div style={{ background: "rgba(15,23,42,0.6)", padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Scryfall Market</div>
                            <div style={{ fontSize: "1rem", fontWeight: "700", color: "#34d399" }}>${price > 0 ? price.toFixed(2) : "N/A"}</div>
                          </div>
                          <div style={{ background: "rgba(15,23,42,0.6)", padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ fontSize: "0.75rem", color: "#f472b6" }}>LotusVault (Local)</div>
                            <div style={{ fontSize: "1rem", fontWeight: "700", color: rData?.lotusInStock ? "#34d399" : "#f87171" }}>
                              {rData?.lotusInStock ? `$${rData.lotusPrice?.toFixed(2)}` : "Out of Stock"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto", paddingTop: "0.75rem" }}>
                        <button
                          className="btn-secondary"
                          style={{ background: "rgba(236,72,153,0.15)", borderColor: "rgba(236,72,153,0.3)", color: "#f472b6" }}
                          onClick={() => {
                            setDrawerCardName(modalCard.card_name);
                            setDrawerCardList([]);
                            setShowMarketplaceDrawer(true);
                          }}
                        >
                          <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Retail Deals
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ background: "rgba(234,179,8,0.15)", borderColor: "rgba(234,179,8,0.3)", color: "#facc15" }}
                          onClick={() => {
                            const targetKind = modalCard.list_type === "wishlist" ? "optional_proxies" : "proxy_wishlist";
                            updateCardDetails(modalCard, {}, targetKind).then(() => {
                              loadLists();
                              setModalCard(null);
                            });
                          }}
                        >
                          <ArrowsRightLeftIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Move to {modalCard.list_type === "wishlist" ? "Optional" : "Required"}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)", color: "#f87171", marginLeft: "auto" }}
                          onClick={() => {
                            deleteCard(modalCard);
                            setModalCard(null);
                          }}
                        >
                          <TrashIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <MarketplacePriceDrawer
        isOpen={showMarketplaceDrawer}
        onClose={() => setShowMarketplaceDrawer(false)}
        cardName={drawerCardName}
        cardList={drawerCardList}
      />

    </div>
  );
}
