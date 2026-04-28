import "dotenv/config"; // must be first — loads .env before any other module reads process.env
import { createApp } from "./app";
import { initAdditiveTaxonomy } from "./integrations/additivesTaxonomy";

const PORT = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  await initAdditiveTaxonomy();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[Server] Ingredient Analyzer API running on http://localhost:${PORT}`);
    console.log(`[Server] Docs: http://localhost:${PORT}/api-docs`);
  });
}

start().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
