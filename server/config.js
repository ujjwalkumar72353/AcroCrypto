import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true });

export const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  if (isProduction) {
    throw new Error("JWT_SECRET is required in production");
  }
  process.env.JWT_SECRET = "local-development-only-secret";
}
