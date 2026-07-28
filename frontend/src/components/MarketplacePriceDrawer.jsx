import React, { useState, useEffect } from "react";
import { MagnifyingGlassIcon, SparklesIcon, BoltIcon, LightBulbIcon } from "@heroicons/react/24/solid";



import { api } from "../api/client";

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

export default function MarketplacePriceDrawer({ isOpen, onClose, cardName = "", cardList = [] }) {
  const [activeTab, setActiveTab] = useState("lotus"); // "lotus" | "manapool"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // LotusVault State
  const [lotusResult, setLotusResult] = useState(null);

  // ManaPool State
  const [manaPoolResult, setManaPoolResult] = useState(null);

  // Search input state for single card lookup
  const [searchTerm, setSearchTerm] = useState(cardName);

  useEffect(() => {
    if (cardName) setSearchTerm(cardName);
  }, [cardName]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setLotusResult(null);
      setManaPoolResult(null);

      if (cardList && cardList.length > 0) {
        fetchBatchData(cardList);
      } else if (cardName || searchTerm) {
        const query = cardName || searchTerm;
        if (query.trim()) {
          fetchCardData(query.trim());
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, cardName, cardList]);

  const fetchCardData = async (name) => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const [lotus, mana] = await Promise.all([
        api.searchLotusVault(name).catch(err => ({ cardName: name, totalFound: 0, items: [], inStockCount: 0, error: err.message })),
        api.optimizeManaPool(
          [{ name, quantity: 1, isFoil: false }],
          { model: "lowest_price", destinationCountry: "US" }
        ).catch(err => ({ error: err.message, totals: null }))
      ]);

      setLotusResult(lotus || { cardName: name, totalFound: 0, items: [], inStockCount: 0 });
      setManaPoolResult(mana || { error: "ManaPool API unavailable", totals: null });
    } catch (err) {
      console.error("Error fetching marketplace prices:", err);
      setLotusResult({ cardName: name, totalFound: 0, items: [], inStockCount: 0, error: err.message });
      setManaPoolResult({ error: "Marketplace price request failed.", totals: null });
    } finally {
      setLoading(false);
    }
  };

  const extractName = (item) => {
    if (typeof item === "string") return item;
    if (!item) return "";
    return item.card_name || item.name || item.title || "";
  };

  const fetchBatchData = async (list) => {
    if (!list || list.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const names = list.map(extractName).map(n => n.trim()).filter(Boolean);

      const manaItems = list.map(item => ({
        name: extractName(item).trim(),
        quantity: typeof item === "object" ? (item.quantity || item.qty || item.count || 1) : 1,
        isFoil: typeof item === "object" ? Boolean(item.is_foil || item.isFoil || item.finish === "foil") : false
      })).filter(it => Boolean(it.name));

      const [lotusBatch, mana] = await Promise.all([
        api.batchLotusVault(names).catch(err => ({})),
        api.optimizeManaPool(manaItems, { model: "lowest_price", destinationCountry: "US" }).catch(err => ({ error: err.message, totals: null }))
      ]);

      setLotusResult(lotusBatch || {});
      setManaPoolResult(mana || { error: "ManaPool optimization unavailable", totals: null });
    } catch (err) {
      console.error("Error fetching batch marketplace prices:", err);
      setLotusResult({});
      setManaPoolResult({ error: "Batch marketplace optimization failed.", totals: null });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isBatchMode = cardList && cardList.length > 0;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* Header Bar */}
        <div style={headerStyle}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: "800", color: "#f8fafc" }}>
                Marketplace & Shipping Finder
              </span>
              <span style={badgeStyle}>Live Data</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0.25rem 0 0 0" }}>
              Compare <strong style={{ color: "#ec4899" }}>LotusVault.com</strong> ($0 Local Pickup) vs <strong style={{ color: "#818cf8" }}>ManaPool API</strong> (Cart Optimizer).
            </p>
          </div>
          <button style={closeBtnStyle} onClick={onClose} title="Close drawer"></button>
        </div>

        {/* Single Card Search Bar */}
        {!isBatchMode && (
          <div style={searchRowStyle}>
            <input
              type="text"
              style={searchInputStyle}
              placeholder="Search card name on LotusVault & ManaPool..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchCardData(searchTerm)}
            />
            <button style={searchBtnStyle} onClick={() => fetchCardData(searchTerm)}>
              <MagnifyingGlassIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Search
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={tabsRowStyle}>
          <button
            onClick={() => setActiveTab("lotus")}
            style={{
              ...tabBtnStyle,
              borderColor: activeTab === "lotus" ? "#ec4899" : "transparent",
              color: activeTab === "lotus" ? "#f472b6" : "#94a3b8",
              background: activeTab === "lotus" ? "rgba(236, 72, 153, 0.1)" : "transparent"
            }}
          >
            <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault Local ($0 Shipping)
          </button>
          <button
            onClick={() => setActiveTab("manapool")}
            style={{
              ...tabBtnStyle,
              borderColor: activeTab === "manapool" ? "#6366f1" : "transparent",
              color: activeTab === "manapool" ? "#818cf8" : "#94a3b8",
              background: activeTab === "manapool" ? "rgba(99, 102, 241, 0.1)" : "transparent"
            }}
          >
            <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool Cart & Shipping
          </button>
        </div>

        {/* Main Content Area */}
        <div style={contentStyle}>
          {loading && (
            <div style={spinnerContainerStyle}>
              <div style={spinnerStyle}></div>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Querying live marketplace inventory & calculating shipping...</p>
            </div>
          )}

          {error && !loading && (
            <div style={errorBoxStyle}>{error}</div>
          )}

          {/* TAB 1: LOTUS VAULT */}
          {activeTab === "lotus" && !loading && (
            <div>
              {!isBatchMode && lotusResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  
                  {/* Summary Card */}
                  <div style={summaryCardStyle}>
                    <div>
                      <div style={summaryLabelStyle}>Cheapest In-Stock</div>
                      <div style={summaryValueStyle}>
                        {typeof lotusResult?.cheapestPrice === "number" ? `$${lotusResult.cheapestPrice.toFixed(2)}` : "Out of Stock"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={summaryLabelStyle}>Local Pickup (MN Store)</div>
                      <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#34d399", marginTop: "2px" }}>
                         $0.00 Shipping
                      </div>
                    </div>
                  </div>

                  {/* Listings Grid */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={sectionTitleStyle}>
                      LotusVault Listings ({lotusResult.totalFound || 0} found, {lotusResult.inStockCount || 0} in stock)
                    </div>

                    {lotusResult.items && lotusResult.items.length > 0 ? (
                      lotusResult.items.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            ...itemRowStyle,
                            opacity: item.inStock ? 1 : 0.55,
                            borderColor: item.inStock ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {item.image ? (
                              <img src={item.image} alt="" style={thumbnailStyle} />
                            ) : (
                              <div style={noThumbnailStyle}>🃏</div>
                            )}
                            <div>
                              <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "#f8fafc", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {item.title}
                                {item.isFoil && <span style={foilBadgeStyle}>FOIL</span>}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>
                                Status:{" "}
                                {item.inStock ? (
                                  <span style={{ color: "#34d399", fontWeight: "600" }}>In Stock</span>
                                ) : (
                                  <span style={{ color: "#f87171", fontWeight: "600" }}>Out of Stock</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#ffffff" }}>
                              {typeof item?.price === "number" ? `$${item.price.toFixed(2)}` : "--"}
                            </span>
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                style={buyBtnStyle}
                              >
                                View / Buy ↗
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "2rem 0" }}>
                        No LotusVault listings found for "{searchTerm}".
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isBatchMode && lotusResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={infoBannerStyle}>
                    Checking LotusVault inventory for <strong>{cardList.length} cards</strong>...
                  </div>
                  {Object.entries(lotusResult).map(([cardNameKey, data], idx) => (
                    <div key={idx} style={itemRowStyle}>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "0.9rem", color: "#f8fafc" }}>{cardNameKey}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                          {data.inStockCount > 0 ? (
                            <span style={{ color: "#34d399", fontWeight: "600" }}>{data.inStockCount} in stock</span>
                          ) : (
                            <span style={{ color: "#f87171", fontWeight: "600" }}>Out of stock</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "1rem", fontWeight: "800", color: "#34d399" }}>
                          {typeof data?.cheapestPrice === "number" ? `$${data.cheapestPrice.toFixed(2)}` : "N/A"}
                        </span>
                        {data.cheapestItem?.link && (
                          <a href={data.cheapestItem.link} target="_blank" rel="noreferrer" style={buyBtnStyle}>
                            Buy ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANAPOOL */}
          {activeTab === "manapool" && !loading && (
            <div>
              {manaPoolResult && manaPoolResult.success ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Total Cost Box */}
                  <div style={manaPoolCardStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          ManaPool Optimized Cart
                        </div>
                        <div style={{ fontSize: "1.75rem", fontWeight: "900", color: "#ffffff", marginTop: "2px" }}>
                          ${manaPoolResult.total} <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal" }}>USD total</span>
                        </div>
                      </div>
                      <div style={packageBadgeStyle}>
                         {manaPoolResult.sellerCount} {manaPoolResult.sellerCount === 1 ? "Package" : "Packages"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", textAlign: "center" }}>
                      <div style={subMetricStyle}>
                        <div style={subMetricLabelStyle}>Items Subtotal</div>
                        <div style={subMetricValueStyle}>${manaPoolResult.subtotal}</div>
                      </div>
                      <div style={{ ...subMetricStyle, background: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                        <div style={{ ...subMetricLabelStyle, color: "#34d399" }}>Live Shipping</div>
                        <div style={{ ...subMetricValueStyle, color: "#34d399" }}>${manaPoolResult.shipping}</div>
                      </div>
                      <div style={subMetricStyle}>
                        <div style={subMetricLabelStyle}>Platform Fee</div>
                        <div style={subMetricValueStyle}>${manaPoolResult.fees}</div>
                      </div>
                    </div>

                    <a
                      href={generateManaPoolCheckoutUrl(isBatchMode ? cardList : [{ name: searchTerm, quantity: 1 }])}
                      target="_blank"
                      rel="noreferrer"
                      style={manaPoolCheckoutBtnStyle}
                    >
                      Build & Checkout Cart on ManaPool ↗
                    </a>
                  </div>

                  {/* Information Box */}
                  <div style={infoBannerStyle}>
                    <p style={{ fontWeight: "700", color: "#818cf8", margin: "0 0 0.25rem 0" }}><LightBulbIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> How ManaPool Cart Optimization Works:</p>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#94a3b8", fontSize: "0.8rem", lineHeight: "1.4" }}>
                      <li>Uses live market optimization algorithms across ManaPool sellers.</li>
                      <li>Minimizes total price by balancing item costs against package shipping thresholds.</li>
                      <li>Computes live shipping costs and package breakdown before checkout.</li>
                    </ul>
                  </div>

                </div>
              ) : (
                <div style={errorBoxStyle}>
                  {manaPoolResult?.error || "No cart optimization available for this request."}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span>Manabase Retail & Shipping Aggregator</span>
          <button style={closeFooterBtnStyle} onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
}

// --- Inline Styles for Perfect Scoped Aesthetics ---
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  justifyContent: "flex-end",
  background: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(6px)"
};

const drawerStyle = {
  width: "100%",
  maxWidth: "600px",
  height: "100%",
  background: "#0f172a",
  color: "#f8fafc",
  boxShadow: "-8px 0 25px rgba(0,0,0,0.5)",
  display: "flex",
  flexDirection: "column",
  borderLeft: "1px solid rgba(255, 255, 255, 0.08)"
};

const headerStyle = {
  padding: "1.25rem 1.5rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start"
};

const badgeStyle = {
  fontSize: "0.7rem",
  fontWeight: "700",
  padding: "2px 8px",
  borderRadius: "12px",
  background: "rgba(16, 185, 129, 0.15)",
  color: "#34d399",
  border: "1px solid rgba(16, 185, 129, 0.3)"
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#94a3b8",
  fontSize: "1.25rem",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "6px",
  transition: "all 0.2s"
};

const searchRowStyle = {
  padding: "1rem 1.5rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  background: "#1e293b",
  display: "flex",
  gap: "0.5rem"
};

const searchInputStyle = {
  flex: 1,
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  padding: "0.6rem 0.85rem",
  fontSize: "0.85rem",
  color: "#ffffff",
  outline: "none"
};

const searchBtnStyle = {
  background: "#4f46e5",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "0.6rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "600",
  cursor: "pointer"
};

const tabsRowStyle = {
  display: "flex",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  background: "#090d16"
};

const tabBtnStyle = {
  flex: 1,
  padding: "0.85rem 1rem",
  fontSize: "0.85rem",
  fontWeight: "700",
  border: "none",
  borderBottom: "2px solid transparent",
  cursor: "pointer",
  transition: "all 0.2s"
};

const contentStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "1.5rem"
};

const spinnerContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "4rem 0"
};

const spinnerStyle = {
  width: "32px",
  height: "32px",
  border: "3px solid #6366f1",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: "1rem"
};

const errorBoxStyle = {
  padding: "1rem",
  background: "rgba(225, 29, 72, 0.15)",
  border: "1px solid rgba(225, 29, 72, 0.3)",
  borderRadius: "8px",
  color: "#f87171",
  fontSize: "0.85rem"
};

const summaryCardStyle = {
  padding: "1.25rem",
  background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const summaryLabelStyle = {
  fontSize: "0.7rem",
  color: "#94a3b8",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};

const summaryValueStyle = {
  fontSize: "1.5rem",
  fontWeight: "900",
  color: "#34d399",
  marginTop: "2px"
};

const sectionTitleStyle = {
  fontSize: "0.75rem",
  fontWeight: "700",
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0.5rem 0"
};

const itemRowStyle = {
  padding: "0.85rem 1rem",
  background: "#1e293b",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  transition: "all 0.2s"
};

const thumbnailStyle = {
  width: "36px",
  height: "50px",
  objectFit: "cover",
  borderRadius: "4px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.4)"
};

const noThumbnailStyle = {
  width: "36px",
  height: "50px",
  background: "#0f172a",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.25rem"
};

const foilBadgeStyle = {
  fontSize: "0.65rem",
  fontWeight: "700",
  padding: "1px 5px",
  background: "rgba(245, 158, 11, 0.2)",
  color: "#fbbf24",
  border: "1px solid rgba(245, 158, 11, 0.3)",
  borderRadius: "4px"
};

const buyBtnStyle = {
  padding: "0.4rem 0.85rem",
  background: "#db2777",
  color: "#ffffff",
  fontSize: "0.75rem",
  fontWeight: "700",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  transition: "all 0.2s"
};

const infoBannerStyle = {
  padding: "0.85rem 1rem",
  background: "rgba(30, 41, 59, 0.6)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "8px",
  fontSize: "0.8rem",
  color: "#cbd5e1"
};

const manaPoolCardStyle = {
  padding: "1.5rem",
  background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
  border: "1px solid rgba(99, 102, 241, 0.3)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "1rem"
};

const packageBadgeStyle = {
  padding: "0.35rem 0.75rem",
  background: "rgba(99, 102, 241, 0.2)",
  color: "#a5b4fc",
  border: "1px solid rgba(99, 102, 241, 0.4)",
  borderRadius: "8px",
  fontSize: "0.75rem",
  fontWeight: "700"
};

const subMetricStyle = {
  padding: "0.6rem 0.5rem",
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "8px"
};

const subMetricLabelStyle = {
  fontSize: "0.65rem",
  color: "#94a3b8",
  fontWeight: "700"
};

const subMetricValueStyle = {
  fontSize: "1rem",
  fontWeight: "800",
  color: "#f8fafc",
  marginTop: "2px"
};

const manaPoolCheckoutBtnStyle = {
  padding: "0.75rem",
  background: "#4f46e5",
  color: "#ffffff",
  fontSize: "0.85rem",
  fontWeight: "700",
  borderRadius: "8px",
  textAlign: "center",
  textDecoration: "none",
  display: "block"
};

const footerStyle = {
  padding: "1rem 1.5rem",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  background: "#090d16",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.75rem",
  color: "#64748b"
};

const closeFooterBtnStyle = {
  background: "#1e293b",
  color: "#cbd5e1",
  border: "none",
  padding: "0.4rem 0.85rem",
  borderRadius: "6px",
  fontSize: "0.75rem",
  fontWeight: "600",
  cursor: "pointer"
};
