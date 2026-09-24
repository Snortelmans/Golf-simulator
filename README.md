# Eigen Baan

Code: https://github.com/Snortelmans/golf-simulator · Online: https://snortelmans.github.io/Golf-simulator/

Bouw je eigen golfhole en speel hem op de Trackman Range van je club.
Werknaam. Week 4 van het maandplan: delen en het voorstel.

## Wat het nu doet

**Spelen**
- Laadt een baan uit een tekstbestand en tekent elke hole in 3D in de browser.
- Laat een verzonnen slag vliegen, stuiteren en uitrollen, met water, bunkers en heuvels.
- Telt de slagen, putt automatisch op de green en speelt alle holes achter elkaar.
- Vier thema's: klassiek, lava, sneeuw, neon.

**Bouwen** (week 2)
- Tekenen van bovenaf: tee en vlag slepen, zones klikken (fairway, green, bunker, water, teebox), heuvels en kuilen zetten.
- Sjablonen om mee te beginnen: par 3 over water, par 4 recht, dogleg, par 5 met eilandgreen, par 6 monster.
- Meerdere holes per baan, dupliceren, volgorde wisselen.
- Par wordt automatisch berekend (3 tot 6), tenzij je hem zelf aanpast.
- Bewaren op je eigen apparaat, en als tekst tonen, kopiëren, laden of downloaden.

**Ronde en simulators** (week 3)
- Scorekaart, wind die de bal echt beïnvloedt, vier seizoenen (kleur, rol, wind).
- Drie bronnen van slagen: verzonnen, GSPro Open Connect (via een brug op de pc) en Trackman Range.
- Nagebouwde Trackman Range om zonder toegang te testen. Zie [docs/simulators.md](docs/simulators.md).

**Delen** (week 4)
- Banen publiceren, banen van anderen spelen, ranglijst per baan. Gebouwd op Supabase (gratis).
- Staat uit tot er een Supabase-project is gekoppeld, zie hieronder.

## Online delen aanzetten

1. Maak een gratis project op supabase.com (kies regio EU, bijvoorbeeld Frankfurt).
2. Open in het project de SQL Editor, plak de inhoud van `supabase/schema.sql` en klik Run.
3. Ga naar Project Settings > API. Kopieer de Project URL en de `anon` `public` key.
4. Maak naast `index.html` een bestand `config.json` (zie `config.example.json`) met die twee waarden.
5. Herlaad de app. Onder 'Banen online' en 'Publiceer online' werkt het nu.

De anon key mag openbaar zijn: de regels in `schema.sql` staan alleen lezen en toevoegen toe.

## Zelf draaien

Je hebt alleen een browser nodig en een klein webservertje (een browser wil
bestanden niet rechtstreeks van je schijf laden als ze elkaar aanroepen).

Met Python (zit op Mac en Linux, op Windows via python.org):

```
cd eigen-baan
python3 -m http.server 8000
```

Of met Node:

```
npx serve .
```

Open daarna http://localhost:8000 in je browser.

## Hoe de code in elkaar zit

```
index.html                 het scherm: knoppen, tekst, de 3D-canvas
css/style.css              hoe het scherm eruitziet
courses/hole-1.json        de eerste hole, als data
js/course-format.js        het baanformaat: zones, heuvels, hoogte, ondergrond
js/physics.js              balvlucht, stuiteren, uitrollen
js/game.js                 de spelregels: slagen tellen, water, putten
js/shots/shot-layer.js     één slagformaat voor alle simulators (de 'reisstekker')
js/shots/sim-source.js     verzonnen slagen per club
js/shots/openconnect-source.js      GSPro Open Connect (launch monitors thuis)
js/shots/trackman-range-source.js   Trackman Range (op de club)
js/seasons.js              seizoenen en wind
js/cloud.js                online delen via Supabase
supabase/schema.sql        de tabellen en regels voor Supabase
config.example.json        voorbeeld van config.json
js/terrain.js              van baandata naar 3D (Babylon.js)
js/editor.js               de bouwer: tekenen van bovenaf op een 2D-canvas
js/templates.js            sjablonen (kant-en-klare holes)
js/storage.js              bewaren op het apparaat, tekst in en uit
js/main.js                 knoopt alles aan elkaar
vendor/babylon.js          de 3D-bibliotheek (Babylon.js 9.28, Apache 2.0)
tools/openconnect-bridge.mjs   brug tussen launch monitor en app (draait op de pc)
tools/mock-trackman.mjs        nagebouwde Trackman Range om te testen
docs/                      uitleg per onderwerp
```

Lees de bestanden in deze volgorde als je wilt snappen hoe het werkt:
`courses/hole-1.json` → `js/course-format.js` → `js/game.js` → `js/main.js`.

## Spelen vanuit de console

Open de browserconsole (F12) en typ:

```js
eigenBaan.sim.custom({ ballSpeed: 70, launchAngle: 10, direction: 5, backSpin: 2500 })
```

Zo stuur je een slag met zelfgekozen getallen. Precies zo gaat straks een slag
van Trackman de app in.

## Meer lezen

- [docs/baanformaat.md](docs/baanformaat.md): hoe je een hole beschrijft
- [docs/shot-laag.md](docs/shot-laag.md): hoe slagen van een simulator binnenkomen
- [docs/simulators.md](docs/simulators.md): een launch monitor of Trackman Range aansluiten
