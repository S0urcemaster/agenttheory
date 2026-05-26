#!/usr/bin/env node
import { defaultTheoryPath, routeUserInput } from "../lib/router.mjs";

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const requireApi = args.includes("--require-api");
const help = args.includes("--help") || args.includes("-h");
const textArgs = args.filter((arg) => !["--offline", "--require-api", "--help", "-h"].includes(arg));

if (help || textArgs.length === 0) {
  console.log([
    "usage: npm run route -- <user-eingabe>",
    "       npm run route:offline -- <user-eingabe>",
    "       npm run route -- --require-api <user-eingabe>",
    "",
    "Environment:",
    "  OPENAI_API_KEY       nutzt die OpenAI API, sofern --offline nicht gesetzt ist",
    "  OPENAI_MODEL         optional, default: gpt-4.1-nano",
    "  LEITSTELLE_THEORY    optionaler Pfad zu leitstelle/index.xml"
  ].join("\n"));
  process.exit(help ? 0 : 64);
}

const userInput = textArgs.join(" ").trim();
const theoryPath = process.env.LEITSTELLE_THEORY || defaultTheoryPath;
const mode = offline ? "heuristic" : "openai";

if (offline) {
  console.error("leitstelle: --offline gesetzt, nutze Offline-Heuristik.");
}

if (!offline && !process.env.OPENAI_API_KEY && !requireApi) {
  console.error("leitstelle: OPENAI_API_KEY nicht gesetzt, nutze Offline-Heuristik. Mit --require-api hart fehlschlagen.");
}

const decision = await routeUserInput(userInput, {
  mode,
  theoryPath,
  requireApi
});

console.log(JSON.stringify(decision, null, 2));
