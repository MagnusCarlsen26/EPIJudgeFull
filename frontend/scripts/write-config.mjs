import { writeFileSync } from "node:fs";

const apiBaseUrl = process.env.VITE_API_BASE_URL || "";

writeFileSync(
  "public/config.js",
  `window.EPI_CONFIG = ${JSON.stringify({ API_BASE_URL: apiBaseUrl }, null, 2)};\n`,
);
