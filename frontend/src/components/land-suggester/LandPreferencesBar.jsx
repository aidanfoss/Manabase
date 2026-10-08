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
                onClick={() => onQuickChangeBudget(tier.id, tier.maxPrice)}
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
          {preferences?.excludeReservedList && (
            <span className="pref-badge emerald" title="Reserved List lands ($500+ ABU Duals) excluded">
              <ShieldCheckIcon className="icon-xs" /> No Reserved List
            </span>
          )}

          {likedCount > 0 && (
            <span className="pref-badge cyan" title={`${likedCount} cycles explicitly favored`}>
              <HeartIcon className="icon-xs" /> +{likedCount} Liked
            </span>
          )}

          {dislikedCount > 0 && (
            <span className="pref-badge rose" title={`${dislikedCount} cycles explicitly excluded`}>
              <NoSymbolIcon className="icon-xs" /> -{dislikedCount} Excluded
            </span>
          )}
        </div>

        <button
          className="btn-tune-preferences"
          onClick={onOpenConfigModal}
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
