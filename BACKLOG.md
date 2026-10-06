# Manabase Engineering Backlog

This backlog tracks deferred and future architecture, UI, and domain expansion tasks.

---

### [PROXY-01] Integrate Proxy Art & Printing Selection Directly into Proxy Wishlist Table
- **Context**: Currently, proxy art, custom cardbacks, and high-resolution MPC render selections are configured within the dedicated `ProxyArtSettings.jsx` tab. The main proxy wishlist table (`WishlistHub.jsx`) is streamlined for fast queue management with implied normal non-foil finish.
- **Goal**: Bridge the MPCfill & Scryfall art selection engine directly into the proxy table rows, allowing users to preview and swap MPC proxy card art / frames inline without navigating away to the art settings tab.
- **Scope**:
  - Connect table thumbnail / card row actions to MPC render previews and Scryfall illustration variants.
  - Sync proxy art selections with MPC XML/text export manifests.
  - Maintain distinction between proxy printing (MPCfill custom visual renders) and trade wishlist printing rules (official MTG booster set editions and collector numbers in `TradelistManager.jsx`).
