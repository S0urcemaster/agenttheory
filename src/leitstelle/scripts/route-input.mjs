#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(__filename), "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");
const defaultTheoryPath = path.join(repoRoot, ".theo", "leitstelle.xml");

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
    "  LEITSTELLE_THEORY    optionaler Pfad zu leitstelle.xml"
  ].join("\n"));
  process.exit(help ? 0 : 64);
}

const userInput = textArgs.join(" ").trim();
const theoryPath = process.env.LEITSTELLE_THEORY || defaultTheoryPath;
const theoryXml = await readFile(theoryPath, "utf8");

const decisionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source",
    "wirkfeld",
    "eingabeart",
    "route",
    "rueckfrage_noetig",
    "confidence",
    "begruendung",
    "angepasste_usereingabe"
  ],
  properties: {
    source: {
      type: "object",
      additionalProperties: false,
      required: ["theory_path"],
      properties: {
        theory_path: { type: "string" }
      }
    },
    wirkfeld: { type: "string", enum: ["entwicklung", "anwendung", "unscharf"] },
    eingabeart: { type: "string", enum: ["frage", "anweisung", "frage-und-anweisung", "aussage", "unscharf"] },
    route: {
      type: "string",
      enum: [
        "entwicklungskontext",
        "anwendungskontext",
        "cli-befehl",
        "entwickler-anweisung",
        "anwender-anweisung",
        "entwickler-cli-befehl-plus-weitere-anweisungen",
        "entwickler-botschaft",
        "rueckfrage"
      ]
    },
    rueckfrage_noetig: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    begruendung: { type: "string" },
    angepasste_usereingabe: { type: "string" }
  }
};

function heuristicDecision(input) {
  const lower = input.toLowerCase();
  const hasQuestion = /\?|\b(wie|was|warum|wo|wohin|welche|kannst|koennen|können|soll|reicht)\b/.test(lower);
  const hasCommand = /\b(mach|aendere|ändere|lege|leg|anlegen|erstelle|erstellen|setz|setze|fuehre|führe|schreib|baue|installiere|starte)\b/.test(lower);
  const development = /\b(canon|theory|theorie|\.theo|xml|spec|plugin|plugins|leitstelle|routing|route|workspace|agenttheory|src|code)\b/.test(lower);
  const cli = /\b(sync|next|einkaufsliste)\b/.test(lower);
  const eingabeart = hasQuestion && hasCommand ? "frage-und-anweisung" : hasCommand ? "anweisung" : hasQuestion ? "frage" : "aussage";
  const wirkfeld = development ? "entwicklung" : "anwendung";
  let route = "anwender-anweisung";
  if (cli) route = "cli-befehl";
  else if (wirkfeld === "entwicklung" && eingabeart === "frage") route = "entwicklungskontext";
  else if (wirkfeld === "anwendung" && eingabeart === "frage") route = "anwendungskontext";
  else if (wirkfeld === "entwicklung") route = "entwickler-anweisung";
  return {
    source: { theory_path: theoryPath },
    wirkfeld,
    eingabeart,
    route,
    rueckfrage_noetig: false,
    confidence: 0.45,
    begruendung: "Offline-Heuristik ohne Modellaufruf. Nur als technischer Fallback verwenden.",
    angepasste_usereingabe: input
  };
}

async function callOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (requireApi) {
      throw new Error("OPENAI_API_KEY ist in diesem Prozess nicht gesetzt.");
    }
    console.error("leitstelle: OPENAI_API_KEY nicht gesetzt, nutze Offline-Heuristik. Mit --require-api hart fehlschlagen.");
    return heuristicDecision(input);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-nano";
  const prompt = [
    "Du bist die Leitstelle vor einem OpenClaw-Agenten.",
    "Nutze die XML-Theory als Entscheidungslogik.",
    "Gib ausschliesslich eine JSON-Entscheidung nach Schema aus.",
    "Wenn die Eingabe nicht hart entscheidbar ist, waehle route=rueckfrage und rueckfrage_noetig=true.",
    "",
    "LEITSTELLE XML:",
    theoryXml,
    "",
    "USER-EINGABE:",
    input
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "leitstelle_decision",
          schema: decisionSchema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error("OpenAI API error " + response.status + ": " + body);
  }

  const data = await response.json();
  const outputText = data.output_text
    || data.output?.flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("OpenAI API response enthielt kein output_text.");
  }

  const parsed = JSON.parse(outputText);
  parsed.source = { theory_path: theoryPath };
  return parsed;
}

if (offline) {
  console.error("leitstelle: --offline gesetzt, nutze Offline-Heuristik.");
}

const decision = offline ? heuristicDecision(userInput) : await callOpenAI(userInput);
console.log(JSON.stringify(decision, null, 2));
