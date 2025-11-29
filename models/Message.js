const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "komal"], required: true },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdAt" } }
);

module.exports = mongoose.model("Message", messageSchema);