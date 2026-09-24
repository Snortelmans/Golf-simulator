// Trackman Range-connector.
//
// Trackman Range heeft een cloud-API (docs.trackmanrange.com). In het kort:
//   1. Je krijgt een toegangstoken van Trackman (Authorization: Bearer ...).
//      Hoe je dat token krijgt staat niet in de openbare documentatie; dat
//      regelt Trackman samen met de club.
//   2. Je maakt een ticket voor een bay (POST /api/tickets) en start een
//      sessie (POST /api/session). Het antwoord bevat een link 'measurements':
//      ws://[host]/ws?type=measurements&sessionId=...&ticketId=...
//   3. Op die WebSocket komen de metingen binnen. Elk bericht heeft
//      Id, Type, SubType, Time en Payload. Voor ons zijn er twee van belang:
//        SubType "LaunchData"   direct na de slag: BallSpeed (m/s), LaunchAngle, LaunchDirection (graden)
//        SubType "Measurement"  als de bal geland is: bovendien Carry, CarrySide, MaxHeight (m), ...
//      Trackman Range meet geen spin. Wij schatten die uit de balsnelheid en
//      de lanceerhoek, en laten de bal landen waar Trackman zegt (Carry, CarrySide).
//
// Deze connector doet alleen stap 3: hij luistert op een WebSocket-adres.
// Tot we toegang hebben, is dat adres onze nagebouwde server
// (tools/mock-trackman.mjs), die dezelfde berichten stuurt.
// Aannames die we bij echte toegang moeten controleren: het teken van
// LaunchDirection en CarrySide (+ = rechts), en de exacte naam van de velden
// in oudere versies van de API.

import { ShotSource } from "./shot-layer.js";

export class TrackmanRangeSource extends ShotSource {
  name = "trackman-range";

  constructor(url = "ws://localhost:8922", onStatus = () => {}) {
    super();
    this.url = url;
    this.onStatus = onStatus;
    this.socket = null;
    this.bus = null;
    this.pending = new Map(); // Id -> launchdata, wachtend op de landing
  }

  start(bus) {
    this.bus = bus;
    this.#connect();
  }

  stop() {
    this.bus = null;
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null; }
    this.#setStatus("uit");
  }

  #connect() {
    if (!this.bus) return;
    this.#setStatus("verbinden");
    try {
      this.socket = new WebSocket(this.url);
    } catch (e) {
      this.#setStatus("fout", e.message);
      return;
    }
    this.socket.onopen = () => this.#setStatus("verbonden");
    this.socket.onerror = () => this.#setStatus("fout", "Geen verbinding met " + this.url);
    this.socket.onclose = () => {
      if (!this.bus) return;
      this.#setStatus("verbinden", "Verbinding weg, opnieuw proberen…");
      setTimeout(() => this.#connect(), 2000);
    };
    this.socket.onmessage = (event) => this.#handle(event.data);
  }

  #handle(text) {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.Type !== "Measurement") return;
    const m = msg.Payload?.Measurement;
    if (!m) return;
    if (msg.SubType === "LaunchData") {
      // De bal is net weg. We onthouden de lancering en wachten op de landing.
      this.pending.set(msg.Id, m);
      this.onStatus("verbonden", `Bal in de lucht: ${m.BallSpeed?.toFixed(1)} m/s`);
      return;
    }
    if (msg.SubType === "Measurement") {
      const launch = this.pending.get(msg.Id) || {};
      this.pending.delete(msg.Id);
      const shot = trackmanToShot({ ...launch, ...m }, msg);
      if (shot) this.bus.emit(shot);
    }
  }

  #setStatus(status, detail) {
    this.status = status;
    this.onStatus(status, detail);
  }
}

/** Vertaalt een Trackman-meting naar ons slagformaat. */
export function trackmanToShot(m, raw) {
  if (!(m.BallSpeed > 0)) return null;
  return {
    ballSpeed: m.BallSpeed,
    launchAngle: m.LaunchAngle ?? 15,
    direction: m.LaunchDirection ?? 0, // aanname: + = rechts
    backSpin: estimateSpin(m.BallSpeed, m.LaunchAngle ?? 15),
    sideSpin: 0,
    measuredCarry: m.Carry > 0 ? m.Carry : undefined,
    measuredSide: typeof m.CarrySide === "number" ? m.CarrySide : undefined,
    source: "trackman-range",
    raw,
  };
}

/** Trackman Range meet geen spin; dit is een schatting per soort slag. */
export function estimateSpin(ballSpeed, launchAngle) {
  if (ballSpeed > 55) return 2800; // driver, woods
  if (ballSpeed > 45) return 4500; // lange ijzers
  if (ballSpeed > 35) return 6500; // midden ijzers
  return 8000 + Math.max(0, launchAngle - 25) * 50; // wedges
}
