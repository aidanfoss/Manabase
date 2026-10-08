import React, { useState, useEffect } from "react";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { parseImportInput } from "../utils/csvImporter";
import "../styles/onboarding.css";

const SLIDES = [
  { img: "/onboarding/step1.png", text: "1. Click on Collection on the bottom middle." },
  { img: "/onboarding/step2.png", text: "2. Click on the 3 dots on the top right." },
  { img: "/onboarding/step3.png", text: "3. Click export." },
  { img: "/onboarding/step4.png", text: "4. Wait for export preparation." },
  { img: "/onboarding/step5.png", text: "5. Hit Export to CSV and copy it!" }
];

export default function OnboardingModal({ user, onClose }) {
  const [step, setStep] = useState("ask"); // "ask", "tutorial", "importing"
  const [currentSlide, setCurrentSlide] = useState(0);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // Cycle through animation slides
  useEffect(() => {
    let interval;
    if (step === "tutorial") {
      interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [step]);

  const handleSkip = () => {
    localStorage.setItem(`onboarding_seen_${user.id || user.username}`, "true");
    onClose();
  };

  const handleYes = () => {
    setStep("tutorial");
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to import cards.");
      return;
    }

    setImporting(true);
    setImportStatus("Parsing Manabox export...");

    try {
      const parsedCards = parseImportInput(importText);
      if (parsedCards.length === 0) {
        alert("No valid cards found in the provided CSV text.");
        setImporting(false);
        setImportStatus("");
        return;
      }

      setImportStatus(`Found ${parsedCards.length} cards. Starting batch import...`);

      // Mark all as going to "owned" collection
      const processedCards = parsedCards.map(c => ({
        ...c,
        list_type: "owned",
        is_proxy: false
      }));

      const CHUNK_SIZE = 500;
      let totalAdded = 0;

      for (let i = 0; i < processedCards.length; i += CHUNK_SIZE) {
        const chunk = processedCards.slice(i, i + CHUNK_SIZE);
        const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
        const totalBatches = Math.ceil(processedCards.length / CHUNK_SIZE);

        setImportStatus(`Importing batch ${batchNum} of ${totalBatches}...`);

        const res = await fetch("/api/collection/owned/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cards: chunk }),
        });

        if (res.ok) {
          const data = await res.json();
          totalAdded += data.count || chunk.length;
        }
      }

      alert(`Successfully imported ${totalAdded} cards into your collection! Welcome to Manabase.`);
      handleSkip(); // Finish onboarding
    } catch (err) {
      console.error("Failed importing onboarding cards:", err);
      alert("An error occurred during import. Please try again or skip for now.");
    } finally {
      setImporting(false);
      setImportStatus("");
    }
  };

  return (
    <div className="onboarding-modal-overlay">
      <div className="onboarding-modal-content">
        <button
          onClick={handleSkip}
          style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", color: "#cbd5e1", cursor: "pointer" }}
          title="Skip"
        >
          <XMarkIcon style={{ width: "1.5rem", height: "1.5rem" }} />
        </button>

        {step === "ask" && (
          <>
            <h1 className="onboarding-title">Welcome to Manabase</h1>
            <p style={{ fontSize: "1.2rem", color: "#cbd5e1" }}>Do you currently use Manabox?</p>
            <div className="onboarding-buttons">
              <button className="onboarding-btn primary" onClick={handleYes}>
                Yes, I do!
              </button>
              <button className="onboarding-btn secondary" onClick={handleSkip}>
                No, skip this
              </button>
            </div>
          </>
        )}

        {step === "tutorial" && (
          <>
            <h2 className="onboarding-title" style={{ fontSize: "2rem" }}>Import your Collection</h2>

            <div className="onboarding-animation-container">
              {SLIDES.map((slide, idx) => (
                <div key={idx} className={`onboarding-slide ${idx === currentSlide ? "active" : ""}`}>
                  <img src={slide.img} alt={`Step ${idx + 1}`} className="onboarding-image" />
                  <div className="onboarding-caption">{slide.text}</div>
                </div>
              ))}
            </div>

            <div className="onboarding-import-zone">
              <label>Paste your exported CSV text here:</label>
              <textarea
                className="onboarding-textarea"
                placeholder="Name,Set code,Collector number,Foil,Quantity,Condition,Language..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                disabled={importing}
              ></textarea>

              {importStatus && <div className="onboarding-status">{importStatus}</div>}

              <button
                className="onboarding-import-btn"
                onClick={handleImport}
                disabled={importing || !importText.trim()}
              >
                {importing ? "Importing..." : "Complete Import"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
