import { readFileSync } from "node:fs";

const config = readFileSync("wrangler.jsonc", "utf8");

if (config.includes('"database_id": "00000000-0000-0000-0000-000000000000"')) {
  console.error(
    "wrangler.jsonc has the placeholder D1 database_id. Run `pnpm exec wrangler d1 create shogiwoshiyou` and set the real database_id before deploy.",
  );
  process.exit(1);
}
