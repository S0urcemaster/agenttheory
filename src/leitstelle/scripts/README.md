# Leitstelle Scripts

Hier koennen spaeter Hilfsskripte fuer die Leitstelle liegen, zum Beispiel
Validatoren, Routing-Demos oder kleine CLI-Prototypen.

## route-input.mjs

Erster lokaler Routing-Prototyp.

Beispiele:

    npm run route -- "neues projekt erstellen: Theory XSLT"
    npm run route:offline -- "wie gut ist dein wissen zu openclaw plugins?"

Mit OPENAI_API_KEY nutzt npm run route die OpenAI API. Ohne API-Key oder mit
--offline faellt das Script auf eine einfache lokale Heuristik zurueck.
