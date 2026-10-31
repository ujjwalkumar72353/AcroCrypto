import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: https://assets.coingecko.com https://coin-images.coingecko.com",
  "connect-src 'self' https://api.coingecko.com https://api.alternative.me wss://stream.binance.com:9443",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityPolicy = {
  name: "security-policy",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
      injectTo: "head-prepend",
    },
  ],
};

export default defineConfig({
  plugins: [react(), securityPolicy],
  server: { port: 5174 },
  preview: { port: 4174 },
});
