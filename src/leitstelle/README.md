# Leitstelle Plugin

## Zweck

Dieses Verzeichnis enthaelt das erste OpenClaw/Codex-Plugin-Geruest fuer die
Leitstelle.

Die Leitstelle ist als vorgeschaltete Weiche gedacht: Sie bewertet eine
User-Eingabe initial und entscheidet, ob und wie sie an den eigentlichen
OpenClaw-Agenten weitergegeben wird.

## Aktueller Stand

Scaffold.

Vorhanden:

- `.codex-plugin/plugin.json` als Plugin-Manifest
- `skills/` fuer agentengerichtete Leitstellen-Anweisungen
- `scripts/route-input.mjs` als erster lokaler Routing-Prototyp
- `assets/` fuer spaetere Plugin-Medien

Noch offen:

- endgueltige Manifest-Werte
- konkrete Leitstellen-API
- Modell-/Routingentscheidung
- Test- oder Demo-Workflow

## Lokale Nutzung

    cd /home/sntr/code/agenttheory/src/leitstelle
    npm run route:offline -- "neues projekt erstellen: Theory XSLT"
    OPENAI_API_KEY=... npm run route -- "neues projekt erstellen: Theory XSLT"
    npm run route -- --require-api "neues projekt erstellen: Theory XSLT"

Der Prototyp liest standardmaessig
/home/sntr/code/agenttheory/.theo/leitstelle.xml. Mit
LEITSTELLE_THEORY=/pfad/zur/leitstelle.xml kann eine andere Theory-Datei
verwendet werden.

Wenn kein OPENAI_API_KEY im Prozess ankommt, meldet das Script den Fallback auf
stderr. Mit --require-api wird daraus ein Fehler.

## Grenze

Dieses Plugin ist Entwicklungswerkzeug fuer Agent Theory. Es ist noch nicht als
verkaufsfertige produktive Agenten-Komponente zu behandeln.
