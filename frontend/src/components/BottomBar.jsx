import React, { useMemo } from "react";
import { CurrencyDollarIcon, GlobeAmericasIcon, PuzzlePieceIcon, ArchiveBoxIcon, ClipboardDocumentIcon, DocumentArrowDownIcon } from "@heroicons/react/24/solid";

import { resolveDisplayPrice } from "../utils/pricing";


export default function BottomBar({ data }) {
  const [adding, setAdding] = React.useState(false);
  const all = [...(data.lands || []), ...(data.nonlands || [])];

  const totals = useMemo(() => {
    const landCount = data.lands?.length || 0;
    const nonLandCount = data.nonlands?.length || 0;

    const totalValue = all.reduce((sum, c) => {
      const pr = resolveDisplayPrice(c);
      return sum + (pr ? pr.amount : 0);
    }, 0);

    return {
      landCount,
      nonLandCount,
      totalCount: landCount + nonLandCount,
      totalValue,
    };
  }, [data, all.length]);

  function copyShareLink() {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    alert("Share link copied to clipboard!");
  }


  return (
    <div className="bottom-bar">
      <div className="bottom-bar-content">
        <span><CurrencyDollarIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> <b>Total Value:</b> ${totals.totalValue.toFixed(2)}</span>
        <span></span>
        <span><GlobeAmericasIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> <b>Lands:</b> {totals.landCount}</span>
        <span></span>
        <span><PuzzlePieceIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> <b>Non-Lands:</b> {totals.nonLandCount}</span>
        <span></span>
        <span><ArchiveBoxIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> <b>Total:</b> {totals.totalCount}</span>

        {/* Inline Share button directly after totals */}
        <button
          className="share-btn"
          onClick={copyShareLink}
          title="Copy share link"
          aria-label="Share"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>

        <button
          className="copy-btn"
          onClick={() => {
            if (!all.length) return;
            const text = all.map(c => {
              const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
              const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
              if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
              if (setCode) return `1 ${c.name} (${setCode})`;
              return `1 ${c.name}`;
            }).join('\n');
            navigator.clipboard.writeText(text);
            alert("Copied entire decklist to clipboard!");
          }}
          title="Copy entire decklist to clipboard"
          aria-label="Copy All"
        >
          <ClipboardDocumentIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Copy
        </button>

        <button
          className="export-btn"
          onClick={() => {
            if (!all.length) return;
            const text = all.map(c => {
              const setCode = (c.set || c.prints?.[0]?.set || "").toUpperCase();
              const collector = c.collector_number || c.prints?.[0]?.collector_number || "";
              if (setCode && collector) return `1 ${c.name} (${setCode}) ${collector}`;
              if (setCode) return `1 ${c.name} (${setCode})`;
              return `1 ${c.name}`;
            }).join('\n');
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Manabase-Deck.txt`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          title="Export entire decklist as a text file"
          aria-label="Export All"
        >
          <DocumentArrowDownIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Export
        </button>


      </div>
    </div>
  );
}