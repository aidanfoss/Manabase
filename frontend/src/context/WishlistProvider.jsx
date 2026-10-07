import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);
  const [optionalProxies, setOptionalProxies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printsCache, setPrintsCache] = useState({});
  const [selectedPrints, setSelectedPrints] = useState({});
  const [retailPrices, setRetailPrices] = useState({});
  const [loadingRetail, setLoadingRetail] = useState(false);
  const [playgroups, setPlaygroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupWishlist, setGroupWishlist] = useState([]);
  const [mpcUnitCost, setMpcUnitCost] = useState(0.25);
  const [defaultCardBack, setDefaultCardBack] = useState(() => {
    return localStorage.getItem("manabase_default_card_back") || "b:black lotus";
  });
  const [prebuiltCardbacks, setPrebuiltCardbacks] = useState([]);
  const [userProxyArts, setUserProxyArts] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Helper function to load lists (lifted from WishlistHub)
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
    } catch (e) {
      console.error("Failed to load lists:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        setWishlist,
        optionalProxies,
        setOptionalProxies,
        loading,
        setLoading,
        printsCache,
        setPrintsCache,
        selectedPrints,
        setSelectedPrints,
        retailPrices,
        setRetailPrices,
        loadingRetail,
        setLoadingRetail,
        playgroups,
        setPlaygroups,
        activeGroup,
        setActiveGroup,
        groupMembers,
        setGroupMembers,
        groupWishlist,
        setGroupWishlist,
        mpcUnitCost,
        setMpcUnitCost,
        defaultCardBack,
        setDefaultCardBack,
        prebuiltCardbacks,
        setPrebuiltCardbacks,
        userProxyArts,
        setUserProxyArts,
        orderHistory,
        setOrderHistory,
        loadingHistory,
        setLoadingHistory,
        loadLists,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
