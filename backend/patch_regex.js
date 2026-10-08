import fs from "fs";

const file = "../frontend/src/pages/DeckUpdater.jsx";
let content = fs.readFileSync(file, "utf-8");

// Add Lands tab after Strictly Better tab
const tabRegex = /<button[\s\S]*?onClick=\{\(\) => setActiveTab\("upgrades"\)\}[\s\S]*?<\/button>/;
const match = content.match(tabRegex);

if (match) {
  const newTab = `
          <button
            className={\`mode-tab \${activeTab === "lands" ? "active" : ""}\`}
            onClick={() => setActiveTab("lands")}
          >
            <AdjustmentsHorizontalIcon className="icon-sm" />
            <span>Land Base</span>
          </button>`;
  content = content.replace(match[0], match[0] + "\n" + newTab);
}

// Render the lands section after synergy
const synergyRegex = /\{activeTab === "synergy"[\s\S]*?<\/div>\s*\)\}/;
const match2 = content.match(synergyRegex);

if (match2) {
  const newSection = `
                {activeTab === "lands" && deck.landUpgrades && (
                  <div className="land-upgrades-container" style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                    <div className="land-cuts" style={{ flex: 1 }}>
                      <h4 style={{ color: '#f87171', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Suggested Cuts</h4>
                      {deck.landUpgrades.cuts.length === 0 ? (
                        <div className="empty-state">No suggested cuts. Your land base is solid!</div>
                      ) : (
                        <div className="card-grid">
                          {deck.landUpgrades.cuts.map((card) =>
                            renderSuggestionCard({...card, price: card.reason || "Cut"}, deck.deck_id, "land_cut")
                          )}
                        </div>
                      )}
                    </div>

                    <div className="land-adds" style={{ flex: 1 }}>
                      <h4 style={{ color: '#4ade80', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Better Alternatives</h4>
                      {deck.landUpgrades.adds.length === 0 ? (
                        <div className="empty-state">No adds suggested.</div>
                      ) : (
                        <div className="card-grid">
                          {deck.landUpgrades.adds.map((card) =>
                            renderSuggestionCard({...card, price: \`\${card.cycle} (\${card.tier})\`}, deck.deck_id, "land_add")
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}`;
  content = content.replace(match2[0], match2[0] + "\n" + newSection);
}

// Add animate-in class
content = content.replace('className="deck-updater-wrapper"', 'className="deck-updater-wrapper animate-in"');

fs.writeFileSync(file, content);
