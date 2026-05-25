# Leitstelle Scripts

Hier koennen spaeter Hilfsskripte fuer die Leitstelle liegen, zum Beispiel
Validatoren, Routing-Demos oder kleine CLI-Prototypen.

## route-input.mjs

Erster lokaler Routing-Prototyp.

Beispiele:

    npm run route -- "neues projekt erstellen: Theory XSLT"
    npm run route:offline -- "wie gut ist dein wissen zu openclaw plugins?"
    npm run route -- --require-api "neues projekt erstellen: Theory XSLT"

Mit OPENAI_API_KEY nutzt npm run route die OpenAI API. Ohne API-Key oder mit
--offline faellt das Script auf eine einfache lokale Heuristik zurueck.
Mit --require-api bricht das Script ab, wenn OPENAI_API_KEY im Prozess fehlt.
Default-Modell ist gpt-4.1-nano; OPENAI_MODEL kann es ueberschreiben.
Standard-Theory ist /home/sntr/code/agenttheory/.theo/leitstelle/index.xml.
