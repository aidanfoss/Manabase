import fs from "fs";

const file = "../frontend/src/pages/DeckUpdater.jsx";
let content = fs.readFileSync(file, "utf-8");

// Add Tab
const findTabs = `<div className="mode-tabs">
          <button
            className={\`mode-tab \${activeTab === "new" ? "active" : ""}\`}
            onClick={() => setActiveTab("new")}
          >
            <SparklesIcon className="icon-sm" />
            New Additions
          </button>
          <button
            className={\`mode-tab \${activeTab === "upgrades" ? "active" : ""}\`}
            onClick={() => setActiveTab("upgrades")}
          >
            <ArrowPathIcon className="icon-sm" />
            Strictly Better
          </button>
          <button
            className={\`mode-tab \${activeTab === "synergy" ? "active" : ""}\`}
            onClick={() => setActiveTab("synergy")}
          >
            <FireIcon className="icon-sm" />
            High Synergy
          </button>
        </div>`;

const replaceTabs = `<div className="mode-tabs">
          <button
            className={\`mode-tab \${activeTab === "new" ? "active" : ""}\`}
            onClick={() => setActiveTab("new")}
          >
            <SparklesIcon className="icon-sm" />
            New Additions
          </button>
          <button
            className={\`mode-tab \${activeTab === "upgrades" ? "active" : ""}\`}
            onClick={() => setActiveTab("upgrades")}
          >
            <ArrowPathIcon className="icon-sm" />
            Strictly Better
          </button>
          <button
            className={\`mode-tab \${activeTab === "lands" ? "active" : ""}\`}
            onClick={() => setActiveTab("lands")}
          >
            <AdjustmentsHorizontalIcon className="icon-sm" />
            Land Base
          </button>
          <button
            className={\`mode-tab \${activeTab === "synergy" ? "active" : ""}\`}
            onClick={() => setActiveTab("synergy")}
          >
            <FireIcon className="icon-sm" />
            High Synergy
          </button>
        </div>`;

content = content.replace(findTabs, replaceTabs);
if (content.indexOf(replaceTabs) === -1) {
    console.error("Failed to replace tabs");
}

const findSectionRender = `{activeTab === "synergy" && deck.edhrec?.highSynergy?.length > 0 && (
                  <div className="card-grid">
                    {deck.edhrec.highSynergy.map((card) =>
                      renderSuggestionCard(card, deck.deck_id, "edhrec_synergy")
                    )}
                  </div>
                )}`;

const replaceSectionRender = `{activeTab === "synergy" && deck.edhrec?.highSynergy?.length > 0 && (
                  <div className="card-grid">
                    {deck.edhrec.highSynergy.map((card) =>
                      renderSuggestionCard(card, deck.deck_id, "edhrec_synergy")
                    )}
                  </div>
                )}

                {activeTab === "lands" && deck.landUpgrades && (
                  <div className="land-upgrades-container" style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                    <div className="land-cuts" style={{ flex: 1 }}>
                      <h4 style={{ color: '#f87171', marginBottom: '1rem' }}>Suggested Cuts</h4>
                      {deck.landUpgrades.cuts.length === 0 ? (
                        <div className="empty-state">No suggested cuts. Your land base is solid!</div>
                      ) : (
                        <div className="card-grid">
                          {deck.landUpgrades.cuts.map((card) =>
                            renderSuggestionCard({...card, reason: card.reason || "Underperforming proxy"}, deck.deck_id, "land_cut")
                          )}
                        </div>
                      )}
                    </div>

                    <div className="land-adds" style={{ flex: 1 }}>
                      <h4 style={{ color: '#4ade80', marginBottom: '1rem' }}>Slightly Better Adds</h4>
                      {deck.landUpgrades.adds.length === 0 ? (
                        <div className="empty-state">No adds suggested.</div>
                      ) : (
                        <div className="card-grid">
                          {deck.landUpgrades.adds.map((card) =>
                            renderSuggestionCard({...card, reason: \`\${card.cycle} (\${card.tier})\`}, deck.deck_id, "land_add")
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}`;

content = content.replace(findSectionRender, replaceSectionRender);
if (content.indexOf(replaceSectionRender) === -1) {
    console.error("Failed to replace section render");
}

// Add CSS animate-in to main container if missing
content = content.replace('className="deck-updater-wrapper"', 'className="deck-updater-wrapper animate-in"');

fs.writeFileSync(file, content);
