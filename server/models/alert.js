import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coinId: { type: String, required: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    currency: { type: String, enum: ["usd", "inr"], required: true },
    direction: { type: String, enum: ["above", "below"], required: true },
    target: { type: Number, required: true },
    active: { type: Boolean, default: true, index: true },
    triggeredAt: { type: Date },
    triggeredPrice: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("Alert", alertSchema);
