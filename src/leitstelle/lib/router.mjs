import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(__filename), "..");
const repoRoot = path.resolve(pluginRoot, "..", "..");
export const defaultTheoryPath = path.join(repoRoot, ".theo", "leitstelle", "index.xml");

export const decisionSchema = {
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

const QUESTION_RE = /\?|\b(wie|was|warum|wo|wohin|welche|welcher|welches|wann|kannst|koennen|können|soll|reicht|geht|gibt es|ist das)\b/u;
const COMMAND_RE = /\b(mach|aendere|ändere|lege|leg|anlegen|erstelle|erstellen|setz|setze|fuehre|führe|schreib|baue|installiere|starte|stoppe|pruefe|prüfe|vermerke|halte fest|notiere|speichere|such|suche|lies|read|continue|mach weiter|leg los)\b/u;
const SOFT_INTENT_RE = /\b(ich moechte|ich möchte|ich will|ich wuerde gern|ich würde gern|wir sollten|man koennte|man könnte)\b/u;
const DEVELOPMENT_RE = /\b(canon|theory|theorie|\.theo|xml|spec|spezifikation|plugin|plugins|leitstelle|routing|route|workspace|agenttheory|src|code|openclaw|codex|hook|before_dispatch|before_prompt_build|runtime|manifest)\b/u;
const CLI_RE = /^\s*\/|\b(sync|next|einkaufsliste|tools|channels|plugins|status)\b/u;
const APPLICATION_RE = /\b(timer|termin|termine|einkaufsliste|spruch|saying|logbuch|post|text|bild|bilder|dokument|datei|backup|telegram|wetter|kalender|mail|email)\b/u;

export const routePrefixes = {
  entwicklungskontext: "Entwickler mit Frage",
  anwendungskontext: "User mit Frage",
  "cli-befehl": "Entwickler mit CLI-Anweisung",
  "entwickler-anweisung": "Entwickler mit Anweisung",
  "anwender-anweisung": "User mit Anweisung",
  "entwickler-cli-befehl-plus-weitere-anweisungen": "Entwickler mit CLI-Anweisung und weiterer Anweisung",
  "entwickler-botschaft": "Entwickler mit Botschaft"
};

export const unclearForwardedMessage = "Bitte den Benutzer: sein Anliegen zu wiederholen";

function clampConfidence(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function makeDecision(input, overrides) {
  const confidence = clampConfidence(overrides.confidence);
  return {
    source: { theory_path: overrides.theoryPath },
    wirkfeld: overrides.wirkfeld,
    eingabeart: overrides.eingabeart,
    route: overrides.route,
    rueckfrage_noetig: overrides.rueckfrage_noetig,
    confidence,
    begruendung: overrides.begruendung,
    angepasste_usereingabe: input
  };
}

export function heuristicDecision(input, options = {}) {
  const theoryPath = options.theoryPath || defaultTheoryPath;
  const trimmed = String(input || "").trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return makeDecision(trimmed, {
      theoryPath,
      wirkfeld: "unscharf",
      eingabeart: "unscharf",
      route: "rueckfrage",
      rueckfrage_noetig: true,
      confidence: 0.95,
      begruendung: "Leere Eingabe."
    });
  }

  const hasQuestion = QUESTION_RE.test(lower);
  const hasCommand = COMMAND_RE.test(lower);
  const hasSoftIntent = SOFT_INTENT_RE.test(lower);
  const development = DEVELOPMENT_RE.test(lower);
  const application = APPLICATION_RE.test(lower);
  const cli = CLI_RE.test(lower);

  if (hasSoftIntent && !hasCommand && !hasQuestion) {
    return makeDecision(trimmed, {
      theoryPath,
      wirkfeld: development ? "entwicklung" : application ? "anwendung" : "unscharf",
      eingabeart: "aussage",
      route: "rueckfrage",
      rueckfrage_noetig: true,
      confidence: 0.72,
      begruendung: "Die Eingabe formuliert Absicht oder Kontext, aber keinen klaren Ausfuehrungsauftrag."
    });
  }

  if (!hasQuestion && !hasCommand && trimmed.length < 4) {
    return makeDecision(trimmed, {
      theoryPath,
      wirkfeld: "unscharf",
      eingabeart: "unscharf",
      route: "rueckfrage",
      rueckfrage_noetig: true,
      confidence: 0.86,
      begruendung: "Sehr kurze Eingabe ohne erkennbare Frage oder Anweisung."
    });
  }

  const eingabeart = hasQuestion && hasCommand
    ? "frage-und-anweisung"
    : hasCommand
      ? "anweisung"
      : hasQuestion
        ? "frage"
        : "aussage";

  const wirkfeld = development && !application
    ? "entwicklung"
    : application && !development
      ? "anwendung"
      : development && application
        ? "unscharf"
        : "anwendung";

  if (wirkfeld === "unscharf") {
    return makeDecision(trimmed, {
      theoryPath,
      wirkfeld,
      eingabeart,
      route: "rueckfrage",
      rueckfrage_noetig: true,
      confidence: 0.68,
      begruendung: "Entwicklungs- und Anwendungskontext sind beide erkennbar; die Ausfuehrungsroute ist nicht eindeutig."
    });
  }

  let route = "anwender-anweisung";
  if (cli) route = hasCommand && !lower.trim().startsWith("/") ? "cli-befehl" : "cli-befehl";
  else if (wirkfeld === "entwicklung" && eingabeart === "frage") route = "entwicklungskontext";
  else if (wirkfeld === "anwendung" && eingabeart === "frage") route = "anwendungskontext";
  else if (wirkfeld === "entwicklung" && eingabeart === "aussage") route = "entwickler-botschaft";
  else if (wirkfeld === "entwicklung") route = "entwickler-anweisung";
  else if (wirkfeld === "anwendung" && eingabeart === "aussage") route = "rueckfrage";

  const rueckfrageNoetig = route === "rueckfrage";
  return makeDecision(trimmed, {
    theoryPath,
    wirkfeld,
    eingabeart,
    route,
    rueckfrage_noetig: rueckfrageNoetig,
    confidence: rueckfrageNoetig ? 0.64 : 0.74,
    begruendung: "Lokale Leitstellen-Heuristik nach Eingabeart, Wirkfeld und Route."
  });
}

export async function callOpenAI(input, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const theoryPath = options.theoryPath || defaultTheoryPath;
  if (!apiKey) {
    if (options.requireApi) {
      throw new Error("OPENAI_API_KEY ist in diesem Prozess nicht gesetzt.");
    }
    return heuristicDecision(input, { theoryPath });
  }

  const theoryXml = await readFile(theoryPath, "utf8");
  const model = options.model || process.env.OPENAI_MODEL || "gpt-4.1-nano";
  const prompt = [
    "Nutze das XML als Entscheidungslogik.",
    "Erzeuge intern eine Entscheidung nach Schema.",
    "Die oeffentliche Weitergabe erfolgt spaeter ausschliesslich als prefixed Klartextnachricht.",
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
      Authorization: "Bearer " + apiKey,
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

export async function routeUserInput(input, options = {}) {
  const mode = options.mode || "heuristic";
  if (mode === "openai") {
    return callOpenAI(input, options);
  }
  return heuristicDecision(input, options);
}

export function formatForwardedMessage(decision, input) {
  const trimmed = String(input ?? decision?.angepasste_usereingabe ?? "").trim();
  if (!trimmed || decision?.rueckfrage_noetig === true || decision?.route === "rueckfrage") {
    return unclearForwardedMessage;
  }

  const prefix = decision?.eingabeart === "frage-und-anweisung" && decision?.wirkfeld === "entwicklung"
    ? "Entwickler mit Frage und Anweisung"
    : decision?.eingabeart === "frage-und-anweisung" && decision?.wirkfeld === "anwendung"
      ? "User mit Frage und Anweisung"
      : routePrefixes[decision?.route];
  if (!prefix) return unclearForwardedMessage;
  return `${prefix}: ${trimmed}`;
}

export async function routeUserMessage(input, options = {}) {
  const decision = await routeUserInput(input, options);
  return formatForwardedMessage(decision, input);
}

export function shouldBypassInput(input, options = {}) {
  const trimmed = String(input || "").trim();
  const prefixes = options.bypassPrefixes || ["/"];
  return prefixes.some((prefix) => prefix && trimmed.startsWith(prefix));
}

export function buildClarifyingReply(decision, options = {}) {
  return options.message || unclearForwardedMessage;
}
