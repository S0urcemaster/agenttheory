# Leitstelle Plugin

## Zweck

Dieses Verzeichnis enthaelt den lokalen OpenClaw-Leitstellen-Prototyp.

Die Leitstelle ist als vorgeschaltete Weiche gedacht: Sie bewertet eine
User-Eingabe initial und entscheidet, ob und wie sie an den eigentlichen
OpenClaw-Agenten weitergegeben wird.

## Aktueller Stand

Runtime-Prototyp.

Vorhanden:

- `openclaw.plugin.json` als natives OpenClaw-Plugin-Manifest
- `index.js` mit `before_dispatch`-Hook als vorgeschalteter Filter
- `lib/router.mjs` als gemeinsame Routinglogik fuer Runtime und CLI
- `.codex-plugin/plugin.json` als Codex-Bundle-Metadaten fuer den bisherigen Plugin-/Skill-Kontext
- `skills/` fuer agentengerichtete Leitstellen-Anweisungen
- `scripts/route-input.mjs` als lokaler Routing-Test
- `assets/` fuer spaetere Plugin-Medien

Noch offen:

- feinere Leitstellen-Heuristik oder Modellentscheidung
- ausgereifte Testmatrix fuer Grenzfaelle
- optionales Weiterreichen der Leitstellenentscheidung als Prompt-Kontext

## OpenClaw Runtime

Das Plugin wird lokal gelinkt:

    openclaw plugins install -l /home/sntr/code/agenttheory/src/leitstelle

Danach muss der Gateway neu gestartet werden. Erfolgreich geladen ist es, wenn
`openclaw plugins inspect leitstelle --runtime --json` `format: "openclaw"`,
`hookCount: 1` und den Hook `before_dispatch` zeigt.

Der Hook laesst Slash-Commands standardmaessig durch. Unscharfe Eingaben oder
Eingaben unterhalb der Confidence-Schwelle werden mit einer Rueckfrage
abgefangen, bevor der OpenClaw-Agent gestartet wird.

## Lokale Nutzung

    cd /home/sntr/code/agenttheory/src/leitstelle
    npm run route:offline -- "neues projekt erstellen: Theory XSLT"
    OPENAI_API_KEY=... npm run route -- "neues projekt erstellen: Theory XSLT"
    npm run route -- --require-api "neues projekt erstellen: Theory XSLT"

Der Prototyp liest standardmaessig
/home/sntr/code/agenttheory/.theo/leitstelle/index.xml. Mit
LEITSTELLE_THEORY=/pfad/zur/leitstelle/index.xml kann eine andere Theory-Datei
verwendet werden.

Wenn kein OPENAI_API_KEY im Prozess ankommt, meldet das Script den Fallback auf
stderr. Mit --require-api wird daraus ein Fehler.

Default-Modell fuer die OpenAI API ist gpt-4.1-nano. Mit OPENAI_MODEL kann
das Modell pro Lauf ueberschrieben werden.

## Grenze

Dieses Plugin ist Entwicklungswerkzeug fuer Agent Theory. Es ist noch nicht als
verkaufsfertige produktive Agenten-Komponente zu behandeln.
