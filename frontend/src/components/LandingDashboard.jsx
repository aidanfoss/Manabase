import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SparklesIcon,
  CubeIcon,
  FolderIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowTopRightOnSquareIcon,
  BookmarkIcon,
  CheckBadgeIcon,
  CircleStackIcon,
  FireIcon,
  GlobeAltIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SwatchIcon,
  TagIcon,
  QueueListIcon
} from "@heroicons/react/24/solid";

// Curated sample showcase cards from Commander staples & land cycles
const SAMPLE_LANDS = [
  {
    name: "Polluted Delta",
    type: "Land — Island Swamp",
    cycle: "Fetchlands",
    colors: ["U", "B"],
    price: "$14.50",
    image: "https://cards.scryfall.io/normal/front/b/a/ba2f03d8-307b-4e3d-8517-99e697409341.jpg",
    foil: false,
    tag: "Mana Fetcher"
  },
  {
    name: "Breeding Pool",
    type: "Land — Forest Island",
    cycle: "Shocklands",
    colors: ["G", "U"],
    price: "$12.25",
    image: "https://cards.scryfall.io/normal/front/b/b/bb54233c-0844-4965-9cde-e8a4ef3e11b8.jpg",
    foil: true,
    tag: "Typed Dual"
  },
  {
    name: "Command Tower",
    type: "Land",
    cycle: "Staples",
    colors: ["W", "U", "B", "R", "G"],
    price: "$0.45",
    image: "https://cards.scryfall.io/normal/front/c/c/cc76b3db-6d73-455b-80df-594ffc897f22.jpg",
    foil: false,
    tag: "All Commander Colors"
  },
  {
    name: "Ancient Tomb",
    type: "Land",
    cycle: "Utility & Fast Mana",
    colors: ["C"],
    price: "$89.00",
    image: "https://cards.scryfall.io/normal/front/b/d/bd3d4b4b-cf31-4f89-8140-9650edb03c7b.jpg",
    foil: true,
    tag: "+2 Colorless Mana"
  },
  {
    name: "Sacred Foundry",
    type: "Land — Mountain Plains",
    cycle: "Shocklands",
    colors: ["R", "W"],
    price: "$18.50",
    image: "https://cards.scryfall.io/normal/front/8/0/8076f84a-5802-4289-a318-7b22b03987da.jpg",
    foil: false,
    tag: "Boros Dual"
  },
  {
    name: "Zagoth Triome",
    type: "Land — Swamp Forest Island",
    cycle: "Triomes",
    colors: ["B", "G", "U"],
    price: "$21.00",
    image: "https://cards.scryfall.io/normal/front/c/c/cc520518-2053-4b39-83e4-080859864441.jpg",
    foil: false,
    tag: "3-Color Cycling"
  }
];

const MANA_PIPS = [
  { id: "W", name: "White (Plains)", color: "#fef08a", bg: "rgba(254, 240, 138, 0.15)", border: "#facc15" },
  { id: "U", name: "Blue (Island)", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)", border: "#3b82f6" },
  { id: "B", name: "Black (Swamp)", color: "#c084fc", bg: "rgba(192, 132, 252, 0.15)", border: "#a855f7" },
  { id: "R", name: "Red (Mountain)", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)", border: "#ef4444" },
  { id: "G", name: "Green (Forest)", color: "#4ade80", bg: "rgba(74, 222, 128, 0.15)", border: "#22c55e" },
  { id: "C", name: "Colorless", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", border: "#64748b" }
];

export default function LandingDashboard({ onSelectPreset }) {
  const navigate = useNavigate();
  const [selectedColors, setSelectedColors] = useState(new Set(["W", "U", "B", "R", "G"]));
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const toggleColor = (colorId) => {
    setSelectedColors((prev) => {
      const next = new Set(prev);
      if (next.has(colorId)) {
        if (next.size > 1) next.delete(colorId);
      } else {
        next.add(colorId);
      }
      return next;
    });
  };

  const launchBuilderWithColors = () => {
    const colorsArray = Array.from(selectedColors);
    const hash = `c=${colorsArray.join(",")}`;
    navigate(`/builder#${hash}`);
  };

  return (
    <div className="landing-forge">
      {/* Background Arcane Leylines Ambient Aura */}
      <div className="arcane-aura-bg" aria-hidden="true">
        <div className="aura-orb aura-orb-violet"></div>
        <div className="aura-orb aura-orb-cyan"></div>
        <div className="aura-orb aura-orb-amber"></div>
      </div>

      {/* Main Hero Header */}
      <section className="forge-hero">
        <div className="hero-arcane-pill">
          <SparklesIcon className="hero-pill-icon" />
          <span>The Commander Mana Matrix & Collection Forge</span>
        </div>

        <h1 className="hero-mythic-title">
          Architect the Perfect <span className="title-gradient-mana">Manabase</span>
        </h1>

        <p className="hero-description-prose">
          Synthesize optimal land curves across 32 color identities, synchronize live Archidekt & Moxfield grimoires, forge MPCFill proxy orders, and orchestrate playgroup trade ledgers.
        </p>

        {/* Interactive Mana Pip Filter Bar */}
        <div className="mana-pips-selector-wrapper">
          <div className="mana-pips-label">Select Color Identity:</div>
          <div className="mana-pips-cluster">
            {MANA_PIPS.map((pip) => {
              const active = selectedColors.has(pip.id);
              return (
                <button
                  key={pip.id}
                  type="button"
                  className={`mana-pip-btn ${active ? "active" : ""}`}
                  style={{
                    "--pip-color": pip.color,
                    "--pip-bg": pip.bg,
                    "--pip-border": pip.border
                  }}
                  onClick={() => toggleColor(pip.id)}
                  title={pip.name}
                >
                  <span className="mana-pip-letter">{pip.id}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="hero-primary-forge-btn"
            onClick={launchBuilderWithColors}
          >
            <RocketLaunchIcon className="btn-icon" />
            <span>Launch Builder ({selectedColors.size === 6 ? "5-Color + C" : `${selectedColors.size} Color`})</span>
          </button>
        </div>
      </section>

      {/* Sample Card Showcase: Interactive Leyline Lands Carousel */}
      <section className="sample-showcase-section">
        <div className="section-header-row">
          <div>
            <div className="section-eyebrow">
              <SwatchIcon className="eyebrow-icon" />
              <span>Real-Time Scryfall & Land Cycle Previews</span>
            </div>
            <h2 className="section-heading">Leyline Land Arsenal</h2>
          </div>
          <button
            type="button"
            className="section-link-btn"
            onClick={() => navigate("/presets")}
          >
            <span>Explore All Land Presets</span>
            <ArrowTopRightOnSquareIcon className="link-icon" />
          </button>
        </div>

        <div className="sample-cards-grid">
          {SAMPLE_LANDS.map((card, idx) => (
            <div
              key={card.name}
              className={`sample-card-frame ${activeCardIndex === idx ? "featured" : ""}`}
              onMouseEnter={() => setActiveCardIndex(idx)}
              onClick={() => navigate("/builder")}
            >
              <div className="sample-card-media">
                <img
                  src={card.image}
                  alt={card.name}
                  loading="lazy"
                  className="sample-card-img"
                  onError={(e) => {
                    // Graceful fallback visual if image cannot be loaded
                    e.currentTarget.style.display = "none";
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = "flex";
                    }
                  }}
                />
                <div className="sample-card-fallback" style={{ display: "none" }}>
                  <div className="fallback-land-name">{card.name}</div>
                  <div className="fallback-land-cycle">{card.cycle}</div>
                </div>

                {card.foil && (
                  <div className="sample-foil-shimmer" title="Foil Printing"></div>
                )}

                <div className="sample-card-tag-badge">
                  {card.tag}
                </div>
              </div>

              <div className="sample-card-details">
                <div className="sample-card-topline">
                  <span className="sample-card-title">{card.name}</span>
                  <span className="sample-card-price">{card.price}</span>
                </div>
                <div className="sample-card-subline">
                  <span className="sample-card-type">{card.type}</span>
                  <span className="sample-card-cycle-pill">{card.cycle}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main 4 Clean Feature Boxes with Sample Visual Previews */}
      <section className="clean-modules-grid">
        {/* Box 1: Manabase Architecture & Presets */}
        <div className="clean-box" onClick={() => navigate("/builder")}>
          <div className="box-glass-accent"></div>

          <div className="box-header">
            <div className="box-icon-gem gem-indigo">
              <CubeIcon className="gem-icon" />
            </div>
            <div className="box-meta">
              <span className="box-category">Deckbuilder Matrix</span>
              <h3 className="box-title">Manabase Architecture & Presets</h3>
            </div>
          </div>

          <p className="box-summary">
            Synthesize balanced land curves with 1-click presets: Fetchland matrices, Typed Shocklands, Battlebond multiplayer duals, and Triome packages with live Scryfall pricing.
          </p>

          {/* Embedded Sample Imagery Mockup */}
          <div className="box-visual-mockup">
            <div className="mockup-land-stack">
              <div className="mockup-chip chip-cyan">Fetchlands (10)</div>
              <div className="mockup-chip chip-emerald">Shocklands (10)</div>
              <div className="mockup-chip chip-amber">Triomes & Duals</div>
            </div>
            <div className="mockup-stat-strip">
              <div className="stat-unit">
                <span className="stat-val">32</span>
                <span className="stat-lbl">Identities</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">100%</span>
                <span className="stat-lbl">EDH Ready</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">Live</span>
                <span className="stat-lbl">Pricing</span>
              </div>
            </div>
          </div>

          <div className="box-action-bar" onClick={(e) => e.stopPropagation()}>
            <button className="box-cta-btn btn-primary" onClick={() => navigate("/builder")}>
              <span>Launch Builder</span>
              <RocketLaunchIcon className="btn-icon-sm" />
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/presets")}>
              <span>Land Presets</span>
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/packages")}>
              <span>Custom Packages</span>
            </button>
          </div>
        </div>

        {/* Box 2: Collection Forge & MPC Proxy Vault */}
        <div className="clean-box" onClick={() => navigate("/wishlist")}>
          <div className="box-glass-accent"></div>

          <div className="box-header">
            <div className="box-icon-gem gem-emerald">
              <FolderIcon className="gem-icon" />
            </div>
            <div className="box-meta">
              <span className="box-category">Inventory & Print Forge</span>
              <h3 className="box-title">Collection Vault & Proxy Orders</h3>
            </div>
          </div>

          <p className="box-summary">
            Catalog your physical collection with conditions and foil flags. Configure high-res MPCFill proxy art, custom card backs, and compile automated XML print manifests.
          </p>

          {/* Embedded Sample Imagery Mockup */}
          <div className="box-visual-mockup">
            <div className="mockup-proxy-row">
              <div className="proxy-card-badge">
                <CheckBadgeIcon className="badge-icon-sm" />
                <span>Auto DFC Split (`Wear // Tear`)</span>
              </div>
              <div className="proxy-card-badge badge-amber">
                <SparklesIcon className="badge-icon-sm" />
                <span>Custom Card Backs</span>
              </div>
            </div>
            <div className="mockup-stat-strip">
              <div className="stat-unit">
                <span className="stat-val">CSV</span>
                <span className="stat-lbl">Bulk Import</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">MPCFill</span>
                <span className="stat-lbl">XML Engine</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">Queue</span>
                <span className="stat-lbl">Wishlist</span>
              </div>
            </div>
          </div>

          <div className="box-action-bar" onClick={(e) => e.stopPropagation()}>
            <button className="box-cta-btn btn-primary" onClick={() => navigate("/wishlist")}>
              <span>Proxy Forge Hub</span>
              <RocketLaunchIcon className="btn-icon-sm" />
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/collection")}>
              <span>Owned Binder</span>
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/alerts/wishlist-overlap")}>
              <span>Wishlist Overlap</span>
            </button>
          </div>
        </div>

        {/* Box 3: Synchronized Grimoire */}
        <div className="clean-box" onClick={() => navigate("/decks")}>
          <div className="box-glass-accent"></div>

          <div className="box-header">
            <div className="box-icon-gem gem-cyan">
              <ArrowPathIcon className="gem-icon" />
            </div>
            <div className="box-meta">
              <span className="box-category">Two-Way Integration</span>
              <h3 className="box-title">Archidekt & Moxfield Deck Sync</h3>
            </div>
          </div>

          <p className="box-summary">
            Pull and track your Commander lists live. Map custom color tags directly to your Collection, Wishlist, or Proxy Queues and automatically detect deck upgrades.
          </p>

          {/* Embedded Sample Imagery Mockup */}
          <div className="box-visual-mockup">
            <div className="mockup-tag-pills">
              <span className="tag-sync-pill pill-blue">#Archidekt Sync</span>
              <span className="tag-sync-pill pill-purple">#Moxfield Sync</span>
              <span className="tag-sync-pill pill-green">#Auto Tagged</span>
            </div>
            <div className="mockup-stat-strip">
              <div className="stat-unit">
                <span className="stat-val">Auto</span>
                <span className="stat-lbl">Diff Engine</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">1-Click</span>
                <span className="stat-lbl">Refresh</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">Upgrades</span>
                <span className="stat-lbl">Deck Updater</span>
              </div>
            </div>
          </div>

          <div className="box-action-bar" onClick={(e) => e.stopPropagation()}>
            <button className="box-cta-btn btn-primary" onClick={() => navigate("/decks")}>
              <span>Saved Decks</span>
              <RocketLaunchIcon className="btn-icon-sm" />
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/updater")}>
              <span>Deck Updater</span>
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/decks")}>
              <span>Import URL</span>
            </button>
          </div>
        </div>

        {/* Box 4: Playgroup Trade Ledger */}
        <div className="clean-box" onClick={() => navigate("/trade")}>
          <div className="box-glass-accent"></div>

          <div className="box-header">
            <div className="box-icon-gem gem-amber">
              <ArrowsRightLeftIcon className="gem-icon" />
            </div>
            <div className="box-meta">
              <span className="box-category">Peer-To-Peer Matchmaker</span>
              <h3 className="box-title">Playgroup Trade Ledger</h3>
            </div>
          </div>

          <p className="box-summary">
            Trade with your local pod seamlessly. Automatically match your tradelist against friends' wishlists with zero-sum fair market price valuation and trade confirmation tracking.
          </p>

          {/* Embedded Sample Imagery Mockup */}
          <div className="box-visual-mockup">
            <div className="mockup-trade-balance">
              <div className="trade-party">
                <span className="party-name">You Offer</span>
                <span className="party-val">$64.50</span>
              </div>
              <ArrowsRightLeftIcon className="trade-arrow-icon" />
              <div className="trade-party">
                <span className="party-name">You Receive</span>
                <span className="party-val">$65.00</span>
              </div>
            </div>
            <div className="mockup-stat-strip">
              <div className="stat-unit">
                <span className="stat-val">Fair</span>
                <span className="stat-lbl">Market Value</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">Instant</span>
                <span className="stat-lbl">Overlap Match</span>
              </div>
              <div className="stat-unit">
                <span className="stat-val">Ledger</span>
                <span className="stat-lbl">History</span>
              </div>
            </div>
          </div>

          <div className="box-action-bar" onClick={(e) => e.stopPropagation()}>
            <button className="box-cta-btn btn-primary" onClick={() => navigate("/trade")}>
              <span>Trade Matchmaker</span>
              <RocketLaunchIcon className="btn-icon-sm" />
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/trade")}>
              <span>Manage Tradelist</span>
            </button>
            <button className="box-cta-btn btn-secondary" onClick={() => navigate("/trade")}>
              <span>Active Trades</span>
            </button>
          </div>
        </div>
      </section>

      {/* Trust & Architecture Matrix Footnote */}
      <section className="forge-footer-matrix">
        <div className="matrix-badge">
          <ShieldCheckIcon className="matrix-icon" />
          <span>Local SQLite Performance & Zero-Lag In-Memory Scryfall Indexing</span>
        </div>
        <div className="matrix-badge">
          <CircleStackIcon className="matrix-icon" />
          <span>Single Multi-Stage Container Architecture</span>
        </div>
        <div className="matrix-badge">
          <GlobeAltIcon className="matrix-icon" />
          <span>MPC Ready Manifests with Custom Backs</span>
        </div>
      </section>
    </div>
  );
}
