import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "-p", "tsconfig.frontend.json"], {
  cwd: root,
  stdio: "inherit",
});

const copy = (source: string, target: string) => {
  const from = path.join(root, source);
  const to = path.join(dist, target);
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
};

const staticCopies: Array<[string, string]> = [
  ["src/app/index.html", "index.html"],
  ["src/styles", "styles"],
  ["src/app/robots.txt", "robots.txt"],
  ["src/app/sitemap.xml", "sitemap.xml"],
];
staticCopies.forEach(([source, target]) => copy(source, target));

const indexPath = path.join(dist, "index.html");
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, "utf8");
  const scripts = [
    "/components/theme-default.js",
    "/components/chat-storage.js",
    "/components/chat-search.js",
    "/components/new-chat-ui.js",
    "/app/app.js",
  ];

  html = html.replace(/\n?<script src="\/components\/(?:theme-default|chat-storage|chat-search|new-chat-ui|localized-new-chat)\.js"><\/script>/g, "");
  html = html.replace(/\n?<script src="\/app\/app\.js"><\/script>/g, "");
  html = html.replace(/\n?<link rel="stylesheet" href="\/styles\/new-chat-ui\.css">/g, "");

  const additions = `${scripts.map((src) => `<script src="${src}"></script>`).join("\n")}\n<link rel="stylesheet" href="/styles/new-chat-ui.css">`;
  html = html.replace("</body>", `\n${additions}\n</body>`);
  writeFileSync(indexPath, html, "utf8");
}

console.log("Frontend build complete: dist/");
