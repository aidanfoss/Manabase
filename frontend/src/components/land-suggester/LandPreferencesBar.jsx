import React from "react";
import {
  AdjustmentsHorizontalIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  HeartIcon,
  NoSymbolIcon,
  SparklesIcon
} from "@heroicons/react/24/solid";
import { BUDGET_TIERS } from "../../data/landCyclesConfig";

export default function LandPreferencesBar({
  preferences,
  onOpenConfigModal,
  onQuickChangeBudget,
  isLoading
}) {
  const currentTierId = preferences?.budgetTier || "all";
  const currentTierObj = BUDGET_TIERS.find(t => t.id === currentTierId);
  const likedCount = preferences?.likedCycles?.length || 0;
  const dislikedCount = preferences?.dislikedCycles?.length || 0;

  const handleQuickBudgetClick = (tierId, maxPrice) => {
    console.log(`[LandPreferencesBar] Quick budget pill clicked: tier='${tierId}', maxPrice=${maxPrice}`);
    onQuickChangeBudget(tierId, maxPrice);
  };

  const handleOpenTuneModal = (tab = "budget") => {
    console.log("[LandPreferencesBar] Opening config modal with tab:", tab, {
      budgetTier: currentTierId,
      maxPricePerLand: preferences?.maxPricePerLand,
      suggestCheapestLikedAlternative: preferences?.suggestCheapestLikedAlternative,
      preferHighestTierLiked: preferences?.preferHighestTierLiked,
      likedCount,
      likedCycles: preferences?.likedCycles,
      dislikedCount,
      dislikedCycles: preferences?.dislikedCycles,
      excludeReservedList: preferences?.excludeReservedList,
      excludeTapped: preferences?.excludeTapped
    });
    onOpenConfigModal(tab);
  };

  return (
    <div className="land-preferences-bar">
      <div className="pref-bar-left">
        <div className="pref-heading">
          <AdjustmentsHorizontalIcon className="icon-sm text-cyan" />
          <span className="pref-title">Land Suggestion Profile:</span>
        </div>

        {/* Quick Budget Switcher */}
        <div className="quick-budget-pills">
          {BUDGET_TIERS.map(tier => {
            const isActive = currentTierId === tier.id;
            return (
              <button
                key={tier.id}
                className={`quick-budget-pill ${isActive ? "active" : ""}`}
                onClick={() => handleQuickBudgetClick(tier.id, tier.maxPrice)}
                disabled={isLoading}
                title={tier.description}
              >
                <CurrencyDollarIcon className="icon-xs" />
                <span>{tier.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pref-bar-right">
        {/* Status badges */}
        <div className="pref-status-tags">
          {preferences?.preferHighestTierLiked && (
            <button
              type="button"
              className="pref-badge emerald clickable"
              onClick={() => handleOpenTuneModal("budget")}
              title="Prioritizes highest tier in liked cycles (always untapped > conditionally untapped > always tapped)"
            >
              <SparklesIcon className="icon-xs" />
              <span>Highest Tier Liked</span>
            </button>
          )}

          {preferences?.suggestCheapestLikedAlternative && (
            <button
              type="button"
              className="pref-badge amber clickable"
              onClick={() => handleOpenTuneModal("budget")}
              title="Suggests cheapest liked alternative when multiple cycles match"
            >
              <CurrencyDollarIcon className="icon-xs" />
              <span>Cheapest Liked</span>
            </button>
          )}

          {likedCount > 0 ? (
            <button
              type="button"
              className="pref-badge cyan clickable"
              onClick={() => handleOpenTuneModal("cycles")}
              title={`${likedCount} cycles favored for upgrades. Click to manage liked cycles.`}
            >
              <HeartIcon className="icon-xs" />
              <span>+{likedCount} Liked Cycles</span>
            </button>
          ) : (
            <button
              type="button"
              className="pref-badge warning clickable"
              onClick={() => handleOpenTuneModal("cycles")}
              title="Click to select your preferred land cycles to base upgrades on"
            >
              <HeartIcon className="icon-xs text-rose" />
              <span>Pick Liked Cycles</span>
            </button>
          )}

          {dislikedCount > 0 && (
            <button
              type="button"
              className="pref-badge rose clickable"
              onClick={() => handleOpenTuneModal("cycles")}
              title={`${dislikedCount} cycles explicitly excluded. Click to manage.`}
            >
              <NoSymbolIcon className="icon-xs" />
              <span>-{dislikedCount} Excluded</span>
            </button>
          )}
        </div>

        <button
          className="btn-tune-preferences"
          onClick={() => handleOpenTuneModal("budget")}
          disabled={isLoading}
          title="Open full land base preferences & cycle customization"
        >
          <AdjustmentsHorizontalIcon className="icon-xs" />
          <span>Tune Preferences</span>
        </button>
      </div>
    </div>
  );
}
