import express from "express";
import cors from "cors";
import scryfallRoutes from "./routes/scryfall.js";
import metasRoutes from "./routes/metas.js";
import landcycleRoutes from "./routes/landcycles.js";
import sideboardRoutes from "./routes/sideboard.js";

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/scryfall", scryfallRoutes);
app.use("/api/metas", metasRoutes);
app.use("/api/landcycles", landcycleRoutes);
app.use("/api/sideboard", sideboardRoutes);

app.listen(8080, () => console.log("✅ Server running on port 8080"));
