import React, { useState, useMemo } from "react";
import { ArrowPathIcon, ClipboardDocumentIcon } from "@heroicons/react/24/solid";

import { resolveDisplayPrice } from "../utils/pricing";


export default function Card({ item, userCollection = [] }) {
    const [showPrices, setShowPrices] = useState(false);
    const [hovering, setHovering] = useState(false);
    const [showBack, setShowBack] = useState(false);
    const displayPrice = useMemo(() => resolveDisplayPrice(item), [item]);

    if (!item) return null;

    // ---- Normalize fields for backend + scryfall compatibility ----
    const faces = item.card_faces || item.faces || [];
    const isMDFC = Array.isArray(faces) && faces.length > 1;

    const currentFace = isMDFC ? faces[showBack ? 1 : 0] : item;

    const image =
        item.image ||
        currentFace.image_uris?.normal ||
        item.image_uris?.normal ||
        null;

    const name = currentFace.name || item.name;
    const note = item.note || null;

    const isOwned = useMemo(() => {
        return (userCollection || []).some(
            (c) => c.card_name?.toLowerCase() === name?.toLowerCase() && c.list_type === "owned"
        );
    }, [userCollection, name]);

    const priceValue =
        item.price ??
        Number(item.prices?.usd ?? item.prices?.usd_foil ?? item.prices?.usd_etched ?? 0);
    const lowest =
        priceValue && !Number.isNaN(priceValue)
            ? `lowest $${Number(priceValue).toFixed(2)}`
            : "no price";

    const scryfall = item.scryfall_uri || item.related_uris?.scryfall || null;

    // ---- Print list ----
    const printList = Array.isArray(item.prints)
        ? item.prints
            .filter((p) => {
                const hasSet = p?.set_name || p?.set || "unknown";
                const hasPrice =
                    p?.prices?.usd || p?.prices?.usd_foil || p?.prices?.usd_etched || p?.price;
                return hasSet && hasPrice;
            })
            .slice(0, 15)
            .map((p, i) => {
                const foil =
                    (p.finishes && p.finishes.includes("foil")) || p?.isFoil
                        ? "(foil)"
                        : "(nonfoil)";
                const price =
                    p.price ??
                    p.prices?.usd ??
                    p.prices?.usd_foil ??
                    p.prices?.usd_etched ??
                    "—";
                const setName = p.set_name || p.set || "Unknown Set";
                return (
                    <div key={i} className="print-row">
                        {setName} {foil} $
                        {Number(price).toFixed
                            ? Number(price).toFixed(2)
                            : price}
                    </div>
                );
            })
        : item.price
            ? [
                <div key="single" className="print-row">
                    Lowest printing ${Number(item.price).toFixed(2)}
                </div>,
            ]
            : [];

    function copyPrintList() {
        const text = printList
            .map((row) => (typeof row === "string" ? row : row.props.children.join(" ")))
            .join("\n");
        navigator.clipboard.writeText(text);
    }

    // ---- Open card on click ----
    function handleCardClick() {
        if (scryfall) {
            window.open(scryfall, "_blank", "noopener,noreferrer");
        }
    }

    return (
        <div
            className={`card ${isMDFC ? "mdfc" : ""} ${isOwned ? "owned-highlight" : ""}`}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => {
                setHovering(false);
                setShowPrices(false);
            }}
            onClick={handleCardClick}
        >
            <div className="card-image">
                {isOwned && (
                    <span className="owned-card-badge"> Owned</span>
                )}
                {image ? (
                    <img
                        key={showBack ? "back" : "front"}
                        src={image}
                        alt={name}
                        className={`card-face ${showBack ? "back" : "front"}`}
                    />
                ) : (
                    <div className="no-image">No image</div>
                )}

                {/* Note banner */}
                {hovering && note && (
                    <div className="card-note-banner">
                        <div className="card-note-text">{note}</div>
                    </div>
                )}

                {/* Flip button for MDFCs */}
                {isMDFC && (
                    <button
                        className="swap-face-btn"
                        title={`Show ${showBack ? "front" : "back"} face`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowBack(!showBack);
                        }}
                    >
                        <ArrowPathIcon style={{ width: '1.2em', height: '1.2em' }} />
                    </button>
                )}
            </div>

            <div className="card-title">
              {name}
              {displayPrice && (
                <button
                  className="price-tag"
                  onMouseEnter={() => setShowPrices(true)}
                  onMouseLeave={() => setShowPrices(false)}
                >
                  ${displayPrice.amount.toFixed(2)}
                </button>
              )}
              {!displayPrice && (
                <button
                  className="price-tag"
                  disabled
                  title="No price data available"
                >
                  N/A
                </button>
              )}
            </div>


            {/* Popup for printings */}
            {showPrices && (
                <div className="popup" onClick={(e) => e.stopPropagation()}>
                    <div className="popup-title">
                        <strong>Printings ({printList.length})</strong>
                    </div>
                    <div className="popup-body">{printList}</div>
                    <button className="copy-btn" onClick={copyPrintList}>
                        <ClipboardDocumentIcon style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> Copy List
                    </button>
                </div>
            )}
        </div>
    );
}
