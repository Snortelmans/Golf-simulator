// Het startpunt van de app. Dit bestand knoopt alles aan elkaar:
//   baan laden -> 3D bouwen -> slagbron starten -> knoppen koppelen -> slag animeren.

import { validateCourse, holeLength } from "./course-format.js";
import { HoleGame, surfaceLabel } from "./game.js";
import { ShotBus } from "./shots/shot-layer.js";
import { SimulatedSource, CLUBS } from "./shots/sim-source.js";
import { buildHole, drawPath, toWorld, THEMES } from "./terrain.js";

const el = (id) => document.getElementById(id);
const canvas = el("scene");
const engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: true });
const scene = new BABYLON.Scene(engine);

// Licht: een zachte hemel plus een zon voor schaduwrijk reliëf.
const hemi = new BABYLON.HemisphericLight("hemel", new BABYLON.Vector3(0.2, 1, 0.1), scene);
hemi.intensity = 0.75;
const sun = new BABYLON.DirectionalLight("zon", new BABYLON.Vector3(-0.4, -1, 0.3), scene);
sun.intensity = 0.7;

// Camera: draait om een doel (de bal). Muis en vinger werken automatisch.
const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, 1.25, 14, BABYLON.Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 400;
camera.upperBetaLimit = 1.5;
camera.wheelPrecision = 8;
camera.attachControl(canvas, true);

let course, game, world, pathLine, animating = false;
const bus = new ShotBus();
const sim = new SimulatedSource();
sim.start(bus);

// Iedere slag, van welke bron ook, komt hier binnen.
bus.on((shot) => {
  if (!game || animating) return;
  const entry = game.applyShot(shot);
  if (entry) playEntry(entry);
});

async function loadCourse(url) {
  const res = await fetch(url);
  const data = await res.json();
  const errors = validateCourse(data);
  if (errors.length) {
    el("melding").textContent = "Baanbestand klopt niet: " + errors.join("; ");
    return;
  }
  course = data;
  startHole(course.theme || "classic");
}

function startHole(themeKey) {
  if (world) world.dispose();
  if (pathLine) { pathLine.dispose(); pathLine = null; }
  game = new HoleGame(course, 0);
  world = buildHole(scene, game.hole, themeKey);
  el("thema").value = themeKey;
  el("holeNaam").textContent = `${game.hole.number}. ${game.hole.name || course.name}`;
  el("holeInfo").textContent = `Par ${game.par} · ${Math.round(holeLength(game.hole))} m`;
  el("melding").textContent = "Kies een club en sla. De slag is verzonnen: er hangt nog geen simulator aan.";
  el("laatste").hidden = true;
  lookBehindBall();
  updateHud();
}

function updateHud() {
  el("slagen").textContent = game.strokes;
  el("afstand").textContent = game.finished ? "in het gat" : `${Math.round(game.distanceToPin())} m`;
  el("ligging").textContent = game.finished ? game.scoreName() : surfaceLabel(game.surface());
  el("clubs").querySelectorAll("button").forEach((b) => (b.disabled = game.finished || animating));
}

/** Zet de camera achter de bal, kijkend naar de vlag. */
function lookBehindBall(radius = 14) {
  const b = game.ball, p = game.hole.pin;
  camera.target = toWorld(game.hole, b.x, b.y, 0.8);
  camera.alpha = Math.atan2(b.y - p.y, b.x - p.x);
  camera.beta = 1.25;
  camera.radius = radius;
}

/** Laat de bal het uitgerekende pad volgen, in echte tijd. */
function playEntry(entry) {
  const { result, shot } = entry;
  const hole = game.hole;
  animating = true;
  updateHud();
  showShot(shot, entry);
  if (pathLine) pathLine.dispose();
  pathLine = drawPath(scene, hole, result.points, world.theme.flag);

  const points = result.points;
  const duration = points[points.length - 1].t;
  const t0 = performance.now();
  let i = 0;
  camera.radius = Math.max(camera.radius, 30);
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = (performance.now() - t0) / 1000;
    while (i < points.length - 1 && points[i + 1].t <= t) i++;
    const p = points[i];
    world.ball.position.set(p.x, p.h + 0.2, p.y);
    camera.target = BABYLON.Vector3.Lerp(camera.target, world.ball.position, 0.08);
    if (t >= duration) {
      scene.onBeforeRenderObservable.remove(observer);
      finishEntry(entry);
    }
  });
}

function finishEntry(entry) {
  animating = false;
  const b = game.finished ? game.hole.pin : game.ball;
  world.ball.position = toWorld(game.hole, b.x, b.y, 0.2);
  el("melding").textContent = entry.message;
  if (game.finished) {
    el("melding").textContent += ` Score: ${game.strokes} (${game.scoreName()}).`;
  }
  lookBehindBall(game.finished ? 20 : 14);
  updateHud();
}

function showShot(shot, entry) {
  const box = el("laatste");
  box.hidden = false;
  el("lsClub").textContent = shot.club || "-";
  el("lsBron").textContent = shot.source;
  el("lsSpeed").textContent = `${shot.ballSpeed.toFixed(1)} m/s (${(shot.ballSpeed * 3.6).toFixed(0)} km/u)`;
  el("lsAngle").textContent = `${shot.launchAngle.toFixed(1)}°`;
  el("lsDir").textContent = `${shot.direction > 0 ? "+" : ""}${shot.direction.toFixed(1)}°`;
  el("lsSpin").textContent = `${Math.round(shot.backSpin)} / ${Math.round(shot.sideSpin)} rpm`;
  el("lsCarry").textContent = `${Math.round(entry.result.carry)} m`;
}

// --- Knoppen
const clubsBox = el("clubs");
for (const [key, club] of Object.entries(CLUBS)) {
  const b = document.createElement("button");
  b.type = "button";
  b.id = `club-${key}`;
  b.textContent = club.label;
  b.addEventListener("click", () => sim.hit(key, Number(el("kracht").value) / 100));
  clubsBox.appendChild(b);
}
el("kracht").addEventListener("input", () => (el("krachtWaarde").textContent = `${el("kracht").value}%`));
el("opnieuw").addEventListener("click", () => startHole(el("thema").value));
const themaSelect = el("thema");
for (const [key, t] of Object.entries(THEMES)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = t.label;
  themaSelect.appendChild(o);
}
themaSelect.addEventListener("change", () => startHole(themaSelect.value));
el("cameraBal").addEventListener("click", () => lookBehindBall());
el("cameraBoven").addEventListener("click", () => {
  camera.target = toWorld(game.hole, 0, game.hole.terrain.length / 2, 0);
  camera.alpha = -Math.PI / 2;
  camera.beta = 0.01;
  camera.radius = game.hole.terrain.length * 1.1;
});

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

// Handig om te leren: open de console (F12) en typ bijvoorbeeld
//   eigenBaan.sim.custom({ ballSpeed: 70, launchAngle: 10, direction: 5, backSpin: 2500 })
window.eigenBaan = { get game() { return game; }, sim, bus, scene, camera, CLUBS };

loadCourse("courses/hole-1.json");
