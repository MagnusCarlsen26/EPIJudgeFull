import { writeFileSync } from "node:fs";

const apiBaseUrl = process.env.VITE_API_BASE_URL;

// TODO: Uncomment this line
// if (!apiBaseUrl) {
//   throw new Error("VITE_API_BASE_URL is required to generate public/config.js");
// }

writeFileSync(
  "public/config.js",
  `window.EPI_CONFIG = ${JSON.stringify({ API_BASE_URL: apiBaseUrl }, null, 2)};\n`,
);
