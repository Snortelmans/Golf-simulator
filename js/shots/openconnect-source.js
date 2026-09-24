// GSPro Open Connect-connector.
//
// Open Connect is het open protocol waarmee de meeste launch monitors
// (Garmin R10, FlightScope Mevo+, Rapsodo MLM2PRO, Bushnell, ...) hun slagen
// naar GSPro sturen: een JSON-bericht over een gewone TCP-verbinding naar
// 127.0.0.1 poort 921. Bron: gsprogolf.com/GSProConnectV1.html
//
// Een browser kan geen TCP-poort openen. Daarom draait er een klein
// hulpprogramma op de pc (tools/openconnect-bridge.mjs) dat zich voordoet als
// GSPro, de slagen ontvangt en doorstuurt naar deze app via een WebSocket.
//
//   launch monitor --TCP 921--> brug --WebSocket 8921--> deze app
//
// Bericht van de launch monitor (ingekort):
//   { "DeviceID": "...", "Units": "Yards", "ShotNumber": 1, "APIversion": "1",
//     "BallData": { "Speed": 147.5, "SpinAxis": -13.2, "TotalSpin": 3250, "BackSpin": 2500,
//                   "SideSpin": -800, "HLA": 2.3, "VLA": 14.3, "CarryDistance": 256.5 },
//     "ShotDataOptions": { "ContainsBallData": true, "IsHeartBeat": false, ... } }
//   Speed is in mijl per uur, HLA/VLA in graden, spin in rpm, CarryDistance in yards of meters.

import { ShotSource } from "./shot-layer.js";

const MPH_TO_MS = 0.44704;
const YARD_TO_M = 0.9144;

export class OpenConnectSource extends ShotSource {
  name = "open-connect";

  constructor(url = "ws://localhost:8921", onStatus = () => {}) {
    super();
    this.url = url;
    this.onStatus = onStatus;
    this.socket = null;
    this.bus = null;
    this.shots = 0;
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
    this.socket.onerror = () => this.#setStatus("fout", "Geen verbinding met de brug op " + this.url);
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
    const shot = openConnectToShot(msg);
    if (shot) {
      this.shots += 1;
      this.bus.emit(shot);
    }
  }

  #setStatus(status, detail) {
    this.status = status;
    this.onStatus(status, detail);
  }
}

/** Vertaalt een Open Connect-bericht naar ons slagformaat. Geeft null voor hartslagen en lege berichten. */
export function openConnectToShot(msg) {
  const opts = msg.ShotDataOptions || {};
  if (opts.IsHeartBeat || opts.ContainsBallData === false || !msg.BallData) return null;
  const b = msg.BallData;
  if (!(b.Speed > 0)) return null;
  const yards = (msg.Units || "Yards").toLowerCase().startsWith("y");
  return {
    ballSpeed: b.Speed * MPH_TO_MS,
    launchAngle: b.VLA,
    direction: b.HLA, // + = rechts, net als bij ons
    backSpin: b.BackSpin ?? b.TotalSpin,
    sideSpin: b.SideSpin ?? 0, // aanname: + = slice (naar rechts); controleren met een echte launch monitor
    measuredCarry: b.CarryDistance > 0 ? b.CarryDistance * (yards ? YARD_TO_M : 1) : undefined,
    source: "open-connect",
    club: msg.DeviceID,
    raw: msg,
  };
}
