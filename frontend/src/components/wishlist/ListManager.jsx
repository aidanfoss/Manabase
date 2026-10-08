import React, { useState, useRef, useEffect } from "react";
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
  HandRaisedIcon,
  ChevronDownIcon
} from "@heroicons/react/24/solid";

import { useWishlist } from "../../context/WishlistProvider";
import ProxyArtSettings from "../ProxyArtSettings";
import { getCardImageUrl } from "../../utils/WishlistHelpers";

const ProxyDropdown = ({ id, isOpen, toggleOpen, triggerLabel, triggerIcon: TriggerIcon, children, disabled }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        if (isOpen) toggleOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef, isOpen, toggleOpen]);

  return (
    <div className="proxy-dropdown-container" ref={containerRef}>
      <button
        className={`proxy-btn proxy-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => toggleOpen(isOpen ? null : id)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <TriggerIcon className="inline-icon" /> {triggerLabel}
        <ChevronDownIcon className={`inline-icon dropdown-chevron-icon ${isOpen ? "open" : ""}`} />
      </button>
      {isOpen && (
        <div className="proxy-dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
};

export default function ListManager({...props}) {
  let contextWishlist = [];
  let contextOptionalProxies = [];
  try {
    const context = useWishlist();
    if (context) {
      contextWishlist = context.wishlist || [];
      contextOptionalProxies = context.optionalProxies || [];
    }
  } catch (e) {
    // Context not available, fallback to props
  }

  const wishlist = props.wishlist ?? contextWishlist;
  const optionalProxies = props.optionalProxies ?? contextOptionalProxies;
  const activeList = props.selectedList === "optional_proxies" ? optionalProxies : wishlist;
  const cheapCardsList = props.cheapCardsList || [];

  const [isOpen, setIsOpen] = useState(null);

  const toggleOpen = (id) => setIsOpen(id);

  // ... rest of the code ...

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Sub-tabs Selection */}
      <div className="subtabs-segmented">
        <button
          className={`subtab-btn ${props.selectedList === "proxy_wishlist" ? "active" : ""}`}
          onClick={() => props.setSelectedList("proxy_wishlist")}
        >
          <PrinterIcon className="inline-icon" /> Required Proxies
          <span className="subtab-badge">{wishlist.length}</span>
        </button>
        <button
          className={`subtab-btn ${props.selectedList === "optional_proxies" ? "active" : ""}`}
          onClick={() => props.setSelectedList("optional_proxies")}
        >
          <PrinterIcon className="inline-icon" /> Optional Proxies
          <span className="subtab-badge">{optionalProxies.length}</span>
        </button>
        <button
          className={`subtab-btn ${props.selectedList === "proxy_arts" ? "active" : ""}`}
          onClick={() => props.setSelectedList("proxy_arts")}
        >
          <PaintBrushIcon className="inline-icon" /> Art Selections
          <span className="subtab-badge">{(props.userProxyArts || []).length}</span>
          {props.missingArtsCount > 0 && <span style={{ marginLeft: '4px', background: '#ef4444', color: 'white', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>{props.missingArtsCount} missing</span>}
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
            props.setDrawerCardName("");
            props.setDrawerCardList(wishlist);
            props.setShowMarketplaceDrawer(true);
          }}
          title="Compare LotusVault local store stock vs ManaPool live cart shipping estimates"
        >
          <SparklesIcon className="inline-icon" /> Retail Deals & Live Shipping <BoltIcon className="inline-icon" />
        </button>
      </div>

       {/* Search bar */}
      {(props.selectedList === "proxy_wishlist" || props.selectedList === "optional_proxies") && (
        <>
          <div className="search-bar-row">
            <div className="search-input-wrapper">
              <span className="search-icon"><MagnifyingGlassIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /></span>
              <input
                type="text"
                value={props.searchQuery}
                onChange={props.handleSearchChange}
                placeholder="Search card to add to proxy wishlist..."
                className="collection-search-input"
              />
              {props.searching && <span className="search-spinner-inline">Searching...</span>}
            </div>

            {props.searchResults.length > 0 && (
              <div className="search-suggestions-overlay">
                {props.searchResults.map((card) => (
                  <div
                    key={card.id}
                    className="suggestion-row"
                    onClick={() => props.addCard(card)}
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
                <ProxyDropdown
                  id="export"
                  isOpen={isOpen === "export"}
                  toggleOpen={toggleOpen}
                  triggerLabel="Export"
                  triggerIcon={DocumentArrowDownIcon}
                  disabled={activeList.length === 0}
                >
                  <button className="proxy-dropdown-item" onClick={props.handleCopyMoxfield}><ClipboardDocumentListIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Copy Decklist</span></button>
                  <button className="proxy-dropdown-item" onClick={props.handleDownloadMpcCsv}><DocumentArrowDownIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Download CSV</span></button>
                  <button className="proxy-dropdown-item" onClick={props.handleDownloadMyMpcXml}><WrenchScrewdriverIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Download XML</span></button>
                </ProxyDropdown>

                <ProxyDropdown
                  id="actions"
                  isOpen={isOpen === "actions"}
                  toggleOpen={toggleOpen}
                  triggerLabel="Actions"
                  triggerIcon={WrenchScrewdriverIcon}
                >
                  <button className="proxy-dropdown-item" onClick={() => props.setShowImportModal(true)}><InboxIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Bulk Import</span></button>
                  <button className="proxy-dropdown-item" onClick={() => props.setShowPrintMode(true)} disabled={activeList.length === 0}><PrinterIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Print Sheets</span></button>
                  <button className="proxy-dropdown-item" onClick={props.handleSetAllAnyPrinting} disabled={activeList.length === 0}><ArrowPathIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Clear Printing Rules</span></button>
                </ProxyDropdown>

                <ProxyDropdown
                  id="manage"
                  isOpen={isOpen === "manage"}
                  toggleOpen={toggleOpen}
                  triggerLabel="Manage"
                  triggerIcon={TagIcon}
                  disabled={activeList.length === 0}
                >
                  <button className="proxy-dropdown-item" style={{ color: "#34d399" }} onClick={() => {props.setConfirmTargetScope("personal"); props.setConfirmChecked(false); props.setShowConfirmModal(true);}}><CheckCircleIcon className="dropdown-item-icon" /> <span className="dropdown-item-title" style={{ color: "#34d399" }}>Confirm Order</span></button>
                  <button className="proxy-dropdown-item" onClick={() => props.setShowCheapModal(true)}><TagIcon className="dropdown-item-icon" /> <span className="dropdown-item-title">Remove Cheap</span></button>
                  <div className="proxy-dropdown-divider" />
                  <button className="proxy-dropdown-item danger" onClick={props.handleClearAll}><TrashIcon className="dropdown-item-icon" /> <span className="dropdown-item-title danger-text">Clear All</span></button>
                </ProxyDropdown>
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
                    checked={props.showLotusColumn}
                    onChange={(e) => props.setShowLotusColumn(e.target.checked)}
                  />
                  <SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault
                </label>
                <label style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={props.showManaPoolColumn}
                    onChange={(e) => props.setShowManaPoolColumn(e.target.checked)}
                  />
                  <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool Market
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
                <button
                  className="proxy-btn"
                  style={{ background: "rgba(99,102,241,0.2)", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8", padding: "0.4rem 0.85rem", fontSize: "0.8rem", fontWeight: "700" }}
                  onClick={props.handleBuyCheapCardsOnManaPool}
                  disabled={wishlist.length === 0 || cheapCardsList.length === 0}
                  title="Export cheap cards ( threshold) directly into ManaPool cart"
                >
                  <BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Buy Cheap Cards ({cheapCardsList.length})
                </button>

                <button
                  className="proxy-btn"
                  style={{ background: "rgba(225,29,72,0.15)", borderColor: "rgba(225,29,72,0.3)", color: "#fb7185", padding: "0.4rem 0.85rem", fontSize: "0.8rem" }}
                  onClick={() => props.setShowCheapModal(true)}
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
                      {props.showLotusColumn && <th className="col-lotus" style={{ background: "rgba(236,72,153,0.1)", color: "#f472b6" }}><SparklesIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> LotusVault</th>}
                      {props.showManaPoolColumn && <th className="col-manapool" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}><BoltIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> ManaPool</th>}
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.map((c) => {
                      const cardMeta = props.printsCache[c.card_name];
                      const rData = props.retailPrices[c.card_name];
                      const thumbUrl = getCardImageUrl(c, cardMeta);

                      return (
                        <tr key={c.id}>
                          <td className="col-qty">
                            <div className="qty-picker-compact">
                              <button onClick={() => props.updateCardDetails(c, { quantity: Math.max(1, c.quantity - 1) })}>-</button>
                              <span>{c.quantity}</span>
                              <button onClick={() => props.updateCardDetails(c, { quantity: c.quantity + 1 })}>+</button>
                            </div>
                          </td>
                          <td className="col-name font-bold">
                            <div
                              className="proxy-card-cell"
                              onMouseEnter={(e) => {
                                props.setHoveredCard(c);
                                props.setHoverPosition({ x: e.clientX + 16, y: e.clientY - 120 });
                              }}
                              onMouseMove={(e) => {
                                props.setHoverPosition({ x: e.clientX + 16, y: e.clientY - 120 });
                              }}
                              onMouseLeave={() => props.setHoveredCard(null)}
                              onClick={() => props.setModalCard(c)}
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

                          {props.showLotusColumn && (
                            <td className="col-lotus" style={{ textAlign: "center" }}>
                              {rData?.lotusInStock ? (
                                <span style={{ color: "#34d399", fontWeight: "700" }}>
                                  ${rData.lotusPrice !== null && rData.lotusPrice !== undefined && !isNaN(Number(rData.lotusPrice)) ? Number(rData.lotusPrice).toFixed(2) : "0.00"}
                                </span>
                              ) : rData ? (
                                <span style={{ color: "#f87171", fontSize: "0.75rem" }}>Out of Stock</span>
                              ) : (
                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{props.loadingRetail ? "..." : "--"}</span>
                              )}
                            </td>
                          )}

                          {props.showManaPoolColumn && (
                            <td className="col-manapool" style={{ textAlign: "center" }}>
                              {rData?.manaPrice !== null && rData?.manaPrice !== undefined ? (
                                <span style={{ color: "#818cf8", fontWeight: "700" }}>
                                  ${!isNaN(Number(rData.manaPrice)) ? Number(rData.manaPrice).toFixed(2) : "0.00"}
                                </span>
                              ) : (
                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{props.loadingRetail ? "..." : "--"}</span>
                              )}
                            </td>
                          )}
                          <td className="col-actions">
                            <div className="table-actions-group">
                              <button
                                className="table-action-icon-btn retail"
                                onClick={() => {
                                  props.setDrawerCardName(c.card_name);
                                  props.setDrawerCardList([]);
                                  props.setShowMarketplaceDrawer(true);
                                }}
                                title="Retail Check (LotusVault & ManaPool)"
                              >
                                <SparklesIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn move"
                                onClick={() => {
                                  props.updateCardDetails(c, {}, c.list_type === "wishlist" ? "optional_proxies" : "proxy_wishlist")
                                    .then(() => props.loadLists()); // Assumed loadLists passed in props, check WishlistHub if missing
                                }}
                                title={`Move to ${c.list_type === "wishlist" ? "Optional Proxies" : "Required Proxies"}`}
                              >
                                <ArrowsRightLeftIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn info"
                                onClick={() => props.setModalCard(c)}
                                title="Card Details & Visual Preview"
                              >
                                <InformationCircleIcon className="action-icon" />
                              </button>
                              <button
                                className="table-action-icon-btn delete"
                                onClick={() => props.deleteCard(c)}
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

      {props.selectedList === "proxy_arts" && (
        <ProxyArtSettings
          userProxyArts={props.userProxyArts}
          fetchProxyArts={props.fetchProxyArts}
          missingArtsCount={props.missingArtsCount}
          onDownloadMissingArts={props.handleDownloadMissingArtsXml}
        />
      )}
    </div>
  );
}
