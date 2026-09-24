#!/usr/bin/env node
// Nagebouwde Trackman Range.
//
// Stuurt dezelfde soort berichten als de echte 'measurements'-WebSocket van
// Trackman Range (docs.trackmanrange.com): eerst LaunchData, dan na de vlucht
// een Measurement met Carry en CarrySide. Zo kunnen we de connector bouwen en
// testen zonder toegang. Zodra we toegang hebben, wisselen we alleen het adres.
//
// Starten:   node tools/mock-trackman.mjs
// In de app: Bron = "Trackman Range", adres ws://localhost:8922
// Druk op Enter in dit venster voor een slag, of laat hem elke 10 s vanzelf slaan.

import { createWsServer } from "./ws-server.mjs";
import { simulateShot } from "../js/physics.js";
import { randomUUID } from "node:crypto";

const PORT = 8922;
const ws = createWsServer(PORT, { onConnect: (_s, n) => log(`app verbonden (${n})`) });
log(`nagebouwde Trackman Range op ws://localhost:${PORT}. Enter = slag, elke 10 s vanzelf.`);

// Een leeg, vlak oefenveld om de carry uit te rekenen.
const range = { terrain: { width: 400, length: 900 }, zones: [], hills: [] };
const clubs = [
  { label: "driver", speed: 62, angle: 12, spin: 2800 },
  { label: "5 ijzer", speed: 49, angle: 16, spin: 5000 },
  { label: "7 ijzer", speed: 44, angle: 19, spin: 6500 },
  { label: "wedge", speed: 33, angle: 27, spin: 9000 },
];
let n = 0;

function fire() {
  n += 1;
  const club = clubs[n % clubs.length];
  const ballSpeed = club.speed * (1 + (Math.random() - 0.5) * 0.08);
  const launchAngle = club.angle + (Math.random() - 0.5) * 3;
  const launchDirection = (Math.random() - 0.5) * 8;
  const sideSpin = (Math.random() - 0.5) * 1200;
  const id = randomUUID();
  const now = () => new Date().toISOString();

  ws.send({
    Id: id, Type: "Measurement", SubType: "LaunchData", Time: now(),
    Payload: { Measurement: { BallSpeed: r1(ballSpeed), LaunchAngle: r1(launchAngle), LaunchDirection: r1(launchDirection) } },
  });

  // Trackman meet de echte vlucht; wij rekenen hem hier na met ons eigen model.
  const flight = simulateShot({ ballSpeed, launchAngle, direction: launchDirection, backSpin: club.spin, sideSpin }, { x: 0, y: 10 }, { x: 0, y: 1 }, range);
  const apex = Math.max(...flight.points.map((p) => p.h));
  setTimeout(() => {
    ws.send({
      Id: id, Type: "Measurement", SubType: "Measurement", Time: now(),
      Payload: {
        Measurement: {
          BallSpeed: r1(ballSpeed), LaunchAngle: r1(launchAngle), LaunchDirection: r1(launchDirection),
          Carry: r1(flight.carry), CarryActual: r1(flight.carry), CarrySide: r1(flight.landing.x), CarrySideActual: r1(flight.landing.x),
          MaxHeight: r1(apex), TargetDistance: null, ReducedAccuracy: [],
        },
      },
    });
    log(`slag ${n} (${club.label}): ${r1(ballSpeed)} m/s, ${r1(launchAngle)}°, carry ${r1(flight.carry)} m, ${r1(flight.landing.x)} m zijwaarts`);
  }, Math.round(flight.flightTime * 1000));
}

setInterval(fire, 10000);
process.stdin.on("data", fire);

function r1(v) { return Math.round(v * 10) / 10; }
function log(s) { console.log(`[trackman-mock ${new Date().toLocaleTimeString()}] ${s}`); }
