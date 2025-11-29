const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
// Using @google/genai via dynamic import (see getAIClient)
const Message = require("./models/Message");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Express config
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connect (non-blocking + graceful fallback)
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/komal";
mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.warn("MongoDB connection failed:", err.message));

// Gemini setup (dynamic import to keep CommonJS)
async function getAIClient() {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// Routes
app.get("/", async (req, res) => {
  // Load last messages for display
  let history = [];
  try {
    history = await Message.find().sort({ createdAt: 1 }).limit(100);
  } catch (e) {
    // ignore errors; UI still loads
  }
  res.render("index", { history });
});

app.post("/chat", async (req, res) => {
  const userMessage = (req.body.message || "").trim();
  if (!userMessage) {
    return res.status(400).json({ error: "Message is required." });
  }

  const ai = await getAIClient();
  if (!ai) {
    return res.status(500).json({ error: "GEMINI_API_KEY missing in .env", reply: "Set GEMINI_API_KEY and restart." });
  }

  try {
    // Save user's message
    try {
      await Message.create({ role: "user", text: userMessage });
    } catch (e) {
      console.warn("Failed to save user message:", e.message);
    }

    // Build simple persona + message prompt
    const persona = "You are Komal, confirm who is the user and. Speak warmly and playfully, always speak in whatshapp hindi language to your brother and other person, your brother name is omkar, and if anyone asks you something, about the relations, so, say, mai kyon btau, meri mrzi, like this, 1–3 sentences, no code fences.";
    const prompt = `${persona}\n\nUser: ${userMessage}`;

    // Call Gemini 2.5 Flash via @google/genai
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const reply = (response && response.text) ? response.text.trim() : "Sorry, I couldn’t respond.";

    // Save Komal's reply
    try {
      await Message.create({ role: "komal", text: reply });
    } catch (e) {
      console.warn("Failed to save komal reply:", e.message);
    }

    return res.json({ reply });
  } catch (err) {
    console.error("Gemini error:", err);
    return res.status(500).json({ error: "Gemini error", reply: "Hmm, I hit a snag. Try again in a moment." });
  }
});

// Delete single message
app.delete("/messages/:id", async (req, res) => {
  const id = (req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "Message id is required" });
  try {
    const deleted = await Message.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Message not found" });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to delete message" });
  }
});

// Clear all messages
app.delete("/messages", async (_req, res) => {
  try {
    const result = await Message.deleteMany({});
    return res.json({ ok: true, deletedCount: result?.deletedCount || 0 });
  } catch (e) {
    return res.status(500).json({ error: "Failed to clear messages" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Komal server running at http://localhost:${PORT}`);

});
