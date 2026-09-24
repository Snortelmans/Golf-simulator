# De shot-laag

Elk merk simulator stuurt slagdata anders. Trackman Range praat via een
cloud-API, GSPro Open Connect via een lokale verbinding, Inrange weer anders.
De app wil daar niets van weten. Daarom is er één slagformaat en per merk een
'bron' die vertaalt. Denk aan een reisstekker.

## Het slagformaat

```js
{
  ballSpeed: 62,      // m/s
  launchAngle: 12,    // graden omhoog
  direction: -2.5,    // graden, + = rechts van de richtlijn
  backSpin: 2800,     // rpm
  sideSpin: 300,      // rpm, + = buigt naar rechts
  source: "simulatie",
  club: "Driver",
  timestamp: 1790000000000
}
```

`direction` is altijd ten opzichte van de richtlijn van de bay. In de app
mikt de speler op de vlag; die lijn is de richtlijn. Slaat hij 3 graden naar
rechts op de range, dan gaat de bal in de app 3 graden rechts van de vlag.

## Hoe een slag door de app gaat

1. Een bron (`SimulatedSource`, straks `TrackmanRangeSource`) maakt een slag.
2. De bron geeft hem aan de `ShotBus`, die hem normaliseert (ontbrekende velden aanvullen, grenzen bewaken).
3. `HoleGame.applyShot()` laat `physics.js` het pad uitrekenen en past de regels toe.
4. `main.js` animeert de bal langs dat pad.

Stap 3 en 4 zijn hetzelfde voor verzonnen en echte slagen. Dat is het hele idee.

## Gemeten landingspunt

Trackman Range (en sommige launch monitors via Open Connect) melden ook hoe ver
de bal droeg en hoe ver zijwaarts hij landde (`measuredCarry`, `measuredSide`).
Dan is de simulator leidend: `HoleGame.simulate()` stuurt de slag in een paar
stappen bij tot onze bal op dat punt landt. Ons model doet dan alleen nog de
animatie en het uitrollen. Zie docs/simulators.md voor het aansluiten.
