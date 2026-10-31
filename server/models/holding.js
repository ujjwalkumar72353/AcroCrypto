import mongoose from "mongoose";

const holdingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coinId: { type: String, required: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    thumb: { type: String, default: "" },
    quantity: { type: Number, required: true },
    buyPrice: { type: Number, required: true },
    currency: { type: String, enum: ["usd", "inr"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Holding", holdingSchema);
