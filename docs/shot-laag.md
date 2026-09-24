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

## Trackman Range (week 3)

Trackman levert per slag ook een landingspunt en de hele vlucht. Die nemen we
dan over in plaats van zelf te rekenen; alleen het uitrollen blijft van ons.
Zolang er geen toegang is, testen we tegen een nagebouwde server die dezelfde
berichten stuurt als de echte.
