import express from "express";
const router = express.Router();

// Example placeholder route
router.get("/", (req, res) => {
    res.json({
        message: "Sideboard endpoint active",
        example: ["Constant Mists", "Darksteel Plate"]
    });
});

export default router;
