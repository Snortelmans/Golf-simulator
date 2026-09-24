// Trackman Range-connector. Wordt gebouwd in week 3.
//
// Plan: Trackman Range heeft een cloud-API (docs.trackmanrange.com) die per bay
// live slagen doorstuurt via een WebSocket, na inloggen met OAuth. Deze bron
// logt in, luistert op de bay van de speler en vertaalt elke slag naar ons
// slagformaat. Trackman levert ook een landingspunt; dat nemen we straks over
// in plaats van zelf de vlucht uit te rekenen.
//
// Tot we toegang hebben, testen we tegen een nagebouwde server die dezelfde
// berichten stuurt.

import { ShotSource } from "./shot-layer.js";

export class TrackmanRangeSource extends ShotSource {
  name = "trackman-range";

  start() {
    this.status = "fout";
    throw new Error("Trackman Range-connector is nog niet gebouwd (week 3)");
  }
}
