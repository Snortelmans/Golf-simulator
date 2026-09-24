#!/usr/bin/env node
// De brug tussen een launch monitor en de app.
//
// Doet zich voor als GSPro: luistert op 127.0.0.1 poort 921 (Open Connect),
// antwoordt netjes op elk bericht en stuurt elke slag door naar de app via
// een WebSocket op poort 8921.
//
// Starten:   node tools/openconnect-bridge.mjs
// Testen:    node tools/openconnect-bridge.mjs --test   (stuurt zelf elke 8 s een slag)
// In de app: Bron = "GSPro Open Connect", adres ws://localhost:8921
//
// Stel in je launch monitor-app (Garmin Golf, FS Golf, ...) GSPro in als doel;
// die zoekt dan vanzelf 127.0.0.1:921.

import { createServer, connect } from "node:net";
import { createWsServer } from "./ws-server.mjs";

const TCP_PORT = 921;
const WS_PORT = 8921;
const ws = createWsServer(WS_PORT, { onConnect: (_s, n) => log(`app verbonden (${n})`) });
let shots = 0;

const tcp = createServer((socket) => {
  log(`launch monitor verbonden vanaf ${socket.remoteAddress}`);
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    for (const text of takeJsonObjects()) handle(text, socket);
  });
  socket.on("error", (e) => log("fout op de verbinding: " + e.message));
  socket.on("close", () => log("launch monitor weg"));

  // Berichten kunnen aan elkaar geplakt binnenkomen; knip op accolades.
  function* takeJsonObjects() {
    let depth = 0, start = -1;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (ch === "{") { if (depth === 0) start = i; depth++; }
      else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { yield buffer.slice(start, i + 1); buffer = buffer.slice(i + 1); i = -1; start = -1; } }
    }
  }
});

function handle(text, socket) {
  let msg;
  try { msg = JSON.parse(text); } catch { log("onleesbaar bericht: " + text.slice(0, 80)); return; }
  const opts = msg.ShotDataOptions || {};
  const reply = { Code: 200, Message: "OK", Player: { Handed: "RH", Club: "DR" } };
  socket.write(JSON.stringify(reply));
  if (opts.IsHeartBeat) return;
  if (msg.BallData && opts.ContainsBallData !== false) {
    shots += 1;
    const b = msg.BallData;
    log(`slag ${shots}: ${b.Speed} mph, VLA ${b.VLA}°, HLA ${b.HLA}°, spin ${b.BackSpin ?? b.TotalSpin} rpm`);
    ws.send(msg);
  }
}

tcp.on("error", (e) => {
  if (e.code === "EADDRINUSE") log(`poort ${TCP_PORT} is bezet. Draait GSPro of een andere brug? Sluit die eerst.`);
  else if (e.code === "EACCES") log(`geen toestemming voor poort ${TCP_PORT}. Op Linux/Mac: start met sudo, of gebruik --port 9210 en stel dat in je launch monitor in.`);
  else log("fout: " + e.message);
  process.exit(1);
});

const portArg = process.argv.indexOf("--port");
const tcpPort = portArg > -1 ? Number(process.argv[portArg + 1]) : TCP_PORT;
tcp.listen(tcpPort, "127.0.0.1", () => {
  log(`luistert als GSPro op 127.0.0.1:${tcpPort}, app-adres ws://localhost:${WS_PORT}`);
});

// --test: doe zelf alsof je een launch monitor bent.
if (process.argv.includes("--test")) {
  setTimeout(() => {
    const client = connect(tcpPort, "127.0.0.1", () => {
      log("testmodus: elke 8 seconden een verzonnen slag");
      let n = 0;
      setInterval(() => {
        n += 1;
        const clubs = [[150, 12, 2600], [120, 17, 5000], [95, 24, 7500], [70, 30, 9000]];
        const [mph, vla, spin] = clubs[n % clubs.length];
        const shot = {
          DeviceID: "test-launch-monitor", Units: "Yards", ShotNumber: n, APIversion: "1",
          BallData: { Speed: mph + (Math.random() - 0.5) * 8, SpinAxis: 0, TotalSpin: spin, BackSpin: spin, SideSpin: Math.round((Math.random() - 0.5) * 800), HLA: (Math.random() - 0.5) * 6, VLA: vla + (Math.random() - 0.5) * 3, CarryDistance: 0 },
          ShotDataOptions: { ContainsBallData: true, ContainsClubData: false, LaunchMonitorIsReady: true, LaunchMonitorBallDetected: true, IsHeartBeat: false },
        };
        client.write(JSON.stringify(shot));
      }, 8000);
    });
    client.on("data", () => {});
  }, 500);
}

function log(s) {
  console.log(`[brug ${new Date().toLocaleTimeString()}] ${s}`);
}
