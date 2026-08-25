import "dotenv/config";
import express from "express";
import path from "node:path";
import chatHandler from "./api/chat";
import modelsHandler from "./api/models";
import healthHandler from "./api/health";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, "dist");

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(DIST_DIR));

app.get("/api/health", healthHandler as express.RequestHandler);
app.get("/api/models", modelsHandler as express.RequestHandler);
app.post("/api/chat", chatHandler as express.RequestHandler);

app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Gemini Assistant running at http://localhost:${PORT}`);
  });
}

export default app;
