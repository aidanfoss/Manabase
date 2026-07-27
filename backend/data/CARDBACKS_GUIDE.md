# Webserver Cardback Management Guide

This guide explains how to easily add, customize, or update cardbacks on your Manabase webserver.

---

## 1. Quick Editing (`backend/data/cardbacks.json`)

To add a new prebuilt cardback default to your server, simply edit the JSON file at `backend/data/cardbacks.json`:

```json
[
  {
    "id": "my_custom_cardback",
    "name": "Custom Dragon Card Back",
    "author": "Community Creator [800 DPI]",
    "dpi": "800 DPI",
    "query": "b:dragon cardback",
    "driveId": "1-YOUR_GOOGLE_DRIVE_FILE_ID_HERE",
    "previewUrl": "https://yourserver.com/cardbacks/custom_dragon.jpg"
  }
]
```

### Field Definitions:
- `id`: Unique lowercase identifier string (e.g. `black_lotus`).
- `name`: Display title of the cardback shown in the UI.
- `author`: Creator name / credit line (e.g. `Chilli_Axe Cardbacks [800 DPI]`).
- `dpi`: Print resolution label (e.g. `800 DPI` or `810 DPI`).
- `query`: MPCfill search query (e.g. `b:black lotus`).
- `driveId`: Google Drive file ID for direct MPCfill image matching.
- `previewUrl`: URL of the image preview shown in the visual cardback selector grid. Can be a remote URL or a local webserver image (e.g. `/cardbacks/dragon.png`).

---

## 2. Hosting Custom Cardback Image Files on Your Server

If you want to host cardback images directly on your webserver:

1. Place image files (`.jpg` or `.png`) into the `backend/data/cardbacks/` directory.
2. The webserver automatically serves them at `/cardbacks/your_image_name.jpg`.
3. Set `previewUrl` in `cardbacks.json` to `/cardbacks/your_image_name.jpg`.

---

## 3. Adding Cardbacks via REST API

You can also dynamically add new cardbacks by sending an HTTP POST request to your webserver:

```bash
POST /api/cardbacks
Content-Type: application/json

{
  "name": "My New Card Back",
  "author": "Chilli_Axe [800 DPI]",
  "dpi": "800 DPI",
  "query": "b:my card back",
  "driveId": "1-GOOGLE_DRIVE_ID",
  "previewUrl": "https://cards.scryfall.io/card_back.png"
}
```

The webserver will save the new cardback to `backend/data/cardbacks.json` and immediately broadcast it to all connected frontend clients.
