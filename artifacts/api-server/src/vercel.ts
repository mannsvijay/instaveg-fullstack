// Vercel Function entry (Batch 8). Vercel's Node.js launcher calls the default
// export as a (req, res) handler for every /api request, so this module must
// not call listen(); src/index.ts keeps listen() for local development.
import app from "./app";

export default app;
