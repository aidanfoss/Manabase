import React from "react";
import {
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  ArrowsRightLeftIcon,
  PaintBrushIcon,
  SparklesIcon,
  PrinterIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  InboxIcon,
  TagIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  DocumentTextIcon,
  PhotoIcon,
  InformationCircleIcon,
  HandRaisedIcon
} from "@heroicons/react/24/solid";

import ProxyArtSettings from "../ProxyArtSettings";
import { getCardImageUrl } from "../../utils/WishlistHelpers";

import React from "react";
// ... imports ...
import { useWishlist } from "../../context/WishlistProvider";
import ProxyArtSettings from "../ProxyArtSettings";
import { getCardImageUrl } from "../../utils/WishlistHelpers";

export default function ListManager({...props}) { // Keep props for now
  const {
    wishlist,
    optionalProxies,
    loading
  } = useWishlist();

  const activeList = props.selectedList === "optional_proxies" ? optionalProxies : wishlist;

  // ... rest of the code ...

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Sub-tabs Selection */}
      <div className="subtabs-segmented">
        <button
          className={`subtab-btn ${selectedList === "proxy_wishlist" ? "active" : ""}`}
          onClick={() => setSelectedList("proxy_wishlist")}
        >
          <PrinterIcon className="inline-icon" /> Required Proxies
          <span className="subtab-badge">{wishlist.length}</span>
        </button>
        <button
          className={`subtab-btn ${selectedList === "optional_proxies" ? "active" : ""}`}
          onClick={() => setSelectedList("optional_proxies")}
        >
          <PrinterIcon className="inline-icon" /> Optional Proxies
          <span className="subtab-badge">{optionalProxies.length}</span>
        </button>
        <button
          className={`subtab-btn ${selectedList === "proxy_arts" ? "active" : ""}`}
          onClick={() => setSelectedList("proxy_arts")}
        >
          <PaintBrushIcon className="inline-icon" /> Art Selections
          <span className="subtab-badge">{userProxyArts.length}</span>
          {missingArtsCount > 0 && <span style={{ marginLeft: '4px', background: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>{missingArtsCount} missing</span>}
        </button>
        <button
          className="subtab-btn"
          onClick={() => window.location.href = "/trade"}
        >
          <HandRaisedIcon className="inline-icon" /> Trade Hub
        </button>
        <button
          className="subtab-btn"
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
          <SparklesIcon className="inline-icon" /> Retail Deals & Live Shipping <BoltIcon className="inline-icon" />
        </button>
      </div>

       {/* Search bar */}
      {(selectedList === "proxy_wishlist" || selectedList === "optional_proxies") && (
        <>
          <div className="search-bar-row">
            <div className="search-input-wrapper">
              <span className="search-icon"><MagnifyingGlassIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /></span>
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

          <div className="wishlist-summary-bar">
              <div className="stat-cards-row">
                <div className="summary-stat-card">
                  <span className="label">Unique Cards</span>
                  <span className="val">{activeList.length}</span>
                </div>
                <div className="summary-stat-card">
                  <span className="label">Total Quantity</span>
                  <span className="val">
                    {activeList.reduce((sum, c) => sum + c.quantity, 0)}
                  </span>
                </div>
                <div className="summary-stat-card">
                  <span className="label">Est. Cost</span>
                  <span className="val">
                    ${(
                      activeList.reduce((sum, c) => sum + c.quantity, 0) * 0.25
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="proxy-actions-row">
                <button className="proxy-btn import" onClick={() => setShowImportModal(true)}>
                  <InboxIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Bulk Import
                </button>
                <button className="proxy-btn remove-cheap" onClick={() => setShowCheapModal(true)} disabled={activeList.length === 0} title="Purge cards cheap enough to buy directly">
                  <TagIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Remove Cheap Cards
                </button>
                <button className="proxy-btn" onClick={handleCopyMoxfield} disabled={activeList.length === 0}>
                  <ClipboardDocumentListIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Copy Decklist
                </button>
                <button className="proxy-btn" onClick={handleDownloadMpcCsv} disabled={activeList.length === 0}>
                  <DocumentArrowDownIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Download CSV
                </button>
                <button className="proxy-btn" onClick={handleDownloadMyMpcXml} disabled={activeList.length === 0}>
                  <WrenchScrewdriverIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Download XML
                </button>
                <button className="proxy-btn print" onClick={() => setShowPrintMode(true)} disabled={activeList.length === 0}>
                  <PrinterIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Print Sheets
                </button>
                <button className="proxy-btn any-print" onClick={handleSetAllAnyPrinting} disabled={activeList.length === 0}>
                  <ArrowPathIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Clear Specific Trade Printing Rules
                </button>
                <button
                  className="proxy-btn"
                  style={{ background: "linear-gradient(135deg, #059669, #10b981)", borderColor: "#34d399", color: "#ffffff", fontWeight: "700" }}
                  onClick={() => {
                    setConfirmTargetScope("personal");
                    setConfirmChecked(false);
                    setShowConfirmModal(true);
                  }}
                  disabled={activeList.length === 0}
                  title="Confirm that you ordered these cards and clear them from your wishlist"
                >
                  <CheckCircleIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Confirm Order
                </button>
                <button className="proxy-btn remove-cheap" onClick={handleClearAll} disabled={activeList.length === 0} title="Clear all cards from your proxy wishlist">
                  <TrashIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Clear All
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
                  <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault
                </label>
                <label style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showManaPoolColumn}
                    onChange={(e) => setShowManaPoolColumn(e.target.checked)}
                  />
                  <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool Market
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
                <button
                  className="proxy-btn"
                  style={{ background: "rgba(99,102,241,0.2)", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8", padding: "0.4rem 0.85rem", fontSize: "0.8rem", fontWeight: "700" }}
                  onClick={handleBuyCheapCardsOnManaPool}
                  disabled={wishlist.length === 0 || cheapCardsList.length === 0}
                  title="Export cheap cards ( threshold) directly into ManaPool cart"
                >
                  <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Buy Cheap Cards ({cheapCardsList.length})
                </button>

                <button
                  className="proxy-btn"
                  style={{ background: "rgba(225,29,72,0.15)", borderColor: "rgba(225,29,72,0.3)", color: "#fb7185", padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                  onClick={() => setShowCheapModal(true)}
                  disabled={wishlist.length === 0}
                >
                  <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Purge Cheap Cards
                </button>
              </div>
            </div>

            {/* Grid cards */}
            {activeList.length === 0 ? (
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
                      {showLotusColumn && <th className="col-lotus" style={{ background: "rgba(236,72,153,0.1)", color: "#f472b6" }}><SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault</th>}
                      {showManaPoolColumn && <th className="col-manapool" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}><BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool</th>}
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.map((c) => {
                      const cardMeta = printsCache[c.card_name];
                      const rData = retailPrices[c.card_name];
                      const thumbUrl = getCardImageUrl(c, cardMeta);

                      return (
                        <tr key={c.id}>
                          <td className="col-qty">
                            <div className="qty-picker-compact">
                              <button onClick={() => updateCardDetails(c, { quantity: Math.max(1, c.quantity - 1) })}>-</button>
                              <span>{c.quantity}</span>
                              <button onClick={() => updateCardDetails(c, { quantity: c.quantity + 1 })}>+</button>
                            </div>
                          </td>
                          <td className="col-name font-bold">
                            <div
                              className="proxy-card-cell"
                              onMouseEnter={(e) => {
                                setHoveredCard(c);
                                setHoverPosition({ x: e.clientX + 16, y: e.clientY - 120 });
                              }}
                              onMouseMove={(e) => {
                                setHoverPosition({ x: e.clientX + 16, y: e.clientY - 120 });
                              }}
                              onMouseLeave={() => setHoveredCard(null)}
                              onClick={() => setModalCard(c)}
                              style={{ cursor: "pointer" }}
                            >
                              {thumbUrl ? (
                                <img src={thumbUrl} alt={c.card_name} className="proxy-card-thumb" loading="lazy" />
                              ) : (
                                <div className="proxy-card-thumb-placeholder">
                                  <PhotoIcon style={{ width: "16px", height: "16px", color: "#64748b" }} />
                                </div>
                              )}
                              <div className="proxy-card-info">
                                <span className="proxy-card-name-text">{c.card_name}</span>
                                {cardMeta?.type_line && (
                                  <span className="proxy-card-type-subtext">{cardMeta.type_line}</span>
                                )}
                              </div>
                            </div>
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
                            <div className="table-actions-group">
                              <button
                                className="table-action-icon-btn retail"
                                onClick={() => {
                                  setDrawerCardName(c.card_name);
                                  setDrawerCardList([]);
                                  setShowMarketplaceDrawer(true);
                                }}
                                title="Retail Check (LotusVault & ManaPool)"
                              >
                                <SparklesIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn move"
                                onClick={() => {
                                  updateCardDetails(c, {}, c.list_type === "wishlist" ? "optional_proxies" : "proxy_wishlist")
                                    .then(() => loadLists());
                                }}
                                title={`Move to ${c.list_type === "wishlist" ? "Optional Proxies" : "Required Proxies"}`}
                              >
                                <ArrowsRightLeftIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn info"
                                onClick={() => setModalCard(c)}
                                title="Card Details & Visual Preview"
                              >
                                <InformationCircleIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn delete"
                                onClick={() => deleteCard(c)}
                                title="Remove Card"
                              >
                                <TrashIcon className="action-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {selectedList === "proxy_arts" && (
        <ProxyArtSettings
          userProxyArts={userProxyArts}
          fetchProxyArts={fetchProxyArts}
          missingArtsCount={missingArtsCount}
          onDownloadMissingArts={handleDownloadMissingArtsXml}
        />
      )}
    </div>
  );
}
