import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve metas
app.get("/api/metas", (req, res) => {
    const metaDir = path.join(__dirname, "data/metas");
    const metas = fs.readdirSync(metaDir)
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    res.json(metas);
});

app.get("/api/metas/:name", (req, res) => {
    const file = path.join(__dirname, `data/metas/${req.params.name}.json`);
    if (!fs.existsSync(file)) return res.status(404).send("Meta not found");
    res.sendFile(file);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
