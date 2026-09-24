# Het baanformaat (versie eigenbaan/1)

Een baan is een JSON-bestand. JSON is een tekstformaat dat mensen én computers
kunnen lezen: accolades voor objecten, vierkante haken voor lijsten.

## Assen

Alles is in meters. Per hole:

- `x` is dwars: 0 is het midden, positief is rechts als je vanaf de tee naar de vlag kijkt.
- `y` is langs: 0 is de achterrand van het terrein, oplopend richting de vlag.

## Een hole

```json
{
  "number": 1,
  "name": "Het Begin",
  "par": 4,
  "terrain": { "width": 160, "length": 430 },
  "tee": { "x": 0, "y": 12 },
  "pin": { "x": 14, "y": 372 },
  "autoPuttMeters": 3,
  "zones": [ ... ],
  "hills": [ ... ]
}
```

- `terrain`: de grootte van het stuk grond. Een bal die hierbuiten komt is 'out of bounds'.
- `tee` en `pin`: startpunt en vlag.
- `par`: mag je weglaten, dan rekent de app hem uit op basis van de lengte (par 3 tot 6).
- `autoPuttMeters`: binnen deze afstand van de vlag is het één putt, daarbuiten twee.

## Zones

Een zone is een veelhoek met een ondergrond:

```json
{ "type": "bunker", "polygon": [[28, 236], [42, 240], [44, 262], [34, 268], [26, 258]] }
```

Types: `tee`, `fairway`, `rough`, `green`, `bunker`, `water`.
Alles buiten de zones is rough. Latere zones liggen bóvenop eerdere,
dus zet de green ná de fairway in de lijst.

## Heuvels

In plaats van een hoogtekaart te tekenen, beschrijf je heuvels als ronde bulten:

```json
{ "x": -68, "y": 300, "radius": 55, "delta": 7 }
```

Op het middelpunt is de grond `delta` meter hoger (of lager bij een negatief getal).
Op `radius` afstand is de bult vrijwel weg. De hoogte op een punt is de som van alle bulten.
Een verhoogde tee: kleine radius, delta 1. Een heuvelrug naast de fairway: grote radius, delta 6.

## Waarom een eigen formaat?

Er bestaat geen open standaard voor golfbanen. GSPro heeft een eigen pijplijn
(QGIS, Blender, Unity) die tientallen uren per baan kost. Dit formaat is klein
en leesbaar, en later te vertalen naar GSPro of andere simulators.
