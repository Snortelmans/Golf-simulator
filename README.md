# Eigen Baan

Bouw je eigen golfhole en speel hem op de Trackman Range van je club.
Werknaam. Week 1 van het maandplan: één hole, één slag.

## Wat het nu doet

- Laadt een hole uit een tekstbestand (`courses/hole-1.json`) en tekent hem in 3D in de browser.
- Laat een verzonnen slag vliegen, stuiteren en uitrollen, met water, bunkers en heuvels.
- Houdt de slagen bij en putt automatisch als de bal op de green ligt.
- Vier thema's: klassiek, lava, sneeuw, neon.

Er hangt nog geen echte simulator aan. Dat is week 3.

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
js/shots/trackman-range-source.js   nog leeg, komt in week 3
js/terrain.js              van baandata naar 3D (Babylon.js)
js/main.js                 knoopt alles aan elkaar
vendor/babylon.js          de 3D-bibliotheek (Babylon.js 9.28, Apache 2.0)
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
