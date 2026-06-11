import { definePluginEntry } from "/usr/lib/node_modules/openclaw/dist/plugin-sdk/plugin-entry.js";
import {
  buildClarifyingReply,
  defaultTheoryPath,
  formatForwardedMessage,
  routeUserInput,
  shouldBypassInput
} from "./lib/router.mjs";

const DEFAULT_CONFIG = {
  enabled: true,
  mode: "heuristic",
  minConfidenceToPass: 0.55,
  blockOnUnclear: true,
  bypassPrefixes: ["/"]
};

function normalizeConfig(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const mode = input.mode === "openai" ? "openai" : "heuristic";
  const minConfidenceToPass = typeof input.minConfidenceToPass === "number"
    ? Math.max(0, Math.min(1, input.minConfidenceToPass))
    : DEFAULT_CONFIG.minConfidenceToPass;
  const bypassPrefixes = Array.isArray(input.bypassPrefixes) && input.bypassPrefixes.length > 0
    ? input.bypassPrefixes.filter((entry) => typeof entry === "string" && entry.length > 0).slice(0, 16)
    : DEFAULT_CONFIG.bypassPrefixes;

  return {
    enabled: input.enabled !== false,
    mode,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : undefined,
    theoryPath: typeof input.theoryPath === "string" && input.theoryPath.trim() ? input.theoryPath.trim() : defaultTheoryPath,
    minConfidenceToPass,
    blockOnUnclear: input.blockOnUnclear !== false,
    bypassPrefixes
  };
}

function extractBody(event) {
  if (typeof event?.body === "string") return event.body;
  if (typeof event?.content === "string") return event.content;
  if (Array.isArray(event?.content)) {
    return event.content
      .map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function shouldBlockDecision(decision, config) {
  if (!config.blockOnUnclear) return false;
  if (decision?.rueckfrage_noetig === true) return true;
  if (decision?.route === "rueckfrage") return true;
  if (typeof decision?.confidence === "number" && decision.confidence < config.minConfidenceToPass) return true;
  return false;
}

export default definePluginEntry({
  id: "leitstelle",
  name: "Leitstelle",
  description: "Vorgeschaltete Weiche fuer OpenClaw-Eingaben nach Agent-Theory-Logik.",
  register(api) {
    api.registerCommand({
      name: "leitstelle",
      description: "Leitstelle: Status oder Testrouting anzeigen.",
      acceptsArgs: true,
      handler: async (ctx) => {
        const config = normalizeConfig(api.runtime?.config?.current?.()?.plugins?.entries?.leitstelle?.config ?? api.pluginConfig);
        const args = String(ctx.args || "").trim();
        if (!args || args === "status") {
          return {
            text: [
              "Leitstelle: " + (config.enabled ? "aktiv" : "aus"),
              "mode: " + config.mode,
              "theory: " + config.theoryPath,
              "minConfidenceToPass: " + config.minConfidenceToPass
            ].join("\n")
          };
        }
        const decision = await routeUserInput(args, {
          mode: config.mode,
          model: config.model,
          theoryPath: config.theoryPath
        });
        return { text: formatForwardedMessage(decision, args) };
      }
    });

    api.on("before_dispatch", async (event) => {
      const config = normalizeConfig(event?.context?.pluginConfig ?? api.pluginConfig);
      if (!config.enabled) return;

      const body = extractBody(event);
      if (!body.trim()) return;
      if (shouldBypassInput(body, { bypassPrefixes: config.bypassPrefixes })) return;

      const decision = await routeUserInput(body, {
        mode: config.mode,
        model: config.model,
        theoryPath: config.theoryPath
      });

      api.logger.debug?.(
        "leitstelle: route=" + decision.route
        + " wirkfeld=" + decision.wirkfeld
        + " eingabeart=" + decision.eingabeart
        + " confidence=" + decision.confidence
      );

      if (!shouldBlockDecision(decision, config)) return;

      return {
        handled: true,
        text: buildClarifyingReply(decision)
      };
    }, { priority: 100, timeoutMs: 10000 });

    api.on("before_prompt_build", async (event) => {
      const config = normalizeConfig(api.pluginConfig);
      if (!config.enabled) return;

      const body = String(event?.prompt || "").trim();
      if (!body || shouldBypassInput(body, { bypassPrefixes: config.bypassPrefixes })) return;

      const decision = await routeUserInput(body, {
        mode: config.mode,
        model: config.model,
        theoryPath: config.theoryPath
      });
      const forwardedMessage = formatForwardedMessage(decision, body);
      if (shouldBlockDecision(decision, config)) return;

      return {
        prependContext: forwardedMessage
      };
    }, { priority: 100, timeoutMs: 10000 });
  }
});
