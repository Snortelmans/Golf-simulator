// Het startpunt van de app. Twee standen: Spelen (3D) en Bouwen (2D van bovenaf).
// Beide werken op hetzelfde baan-object. Wat je bouwt, speel je meteen.

import { validateCourse, holeLength, computePar, distance } from "./course-format.js";
import { HoleGame, surfaceLabel, scoreName } from "./game.js";
import { ShotBus } from "./shots/shot-layer.js";
import { SimulatedSource, CLUBS } from "./shots/sim-source.js";
import { OpenConnectSource } from "./shots/openconnect-source.js";
import { TrackmanRangeSource } from "./shots/trackman-range-source.js";
import { buildHole, drawPath, toWorld, THEMES } from "./terrain.js";
import { Editor } from "./editor.js";
import { TEMPLATES } from "./templates.js";
import { saveLocal, loadLocal, toText, fromText, newCourse } from "./storage.js";
import { SEASONS, randomWind, describeWind } from "./seasons.js";

const el = (id) => document.getElementById(id);

// ============ Gedeelde toestand ============
let course = null; // de baan (één object voor bouwen én spelen)
let holeIndex = 0; // welke hole er nu gespeeld of bewerkt wordt
let mode = "spelen";
const scores = []; // slagen per hole in deze ronde
let seasonKey = "lente";
let wind = { x: 0, y: 0, speed: 0 };
try { seasonKey = localStorage.getItem("eigenbaan.seizoen") || "lente"; } catch { /* niets */ }

// ============ Spelen: 3D ============
const canvas = el("scene");
const engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: true });
const scene = new BABYLON.Scene(engine);
const hemi = new BABYLON.HemisphericLight("hemel", new BABYLON.Vector3(0.2, 1, 0.1), scene);
hemi.intensity = 0.75;
const sun = new BABYLON.DirectionalLight("zon", new BABYLON.Vector3(-0.4, -1, 0.3), scene);
sun.intensity = 0.7;
const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, 1.25, 14, BABYLON.Vector3.Zero(), scene);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 900;
camera.upperBetaLimit = 1.5;
camera.wheelPrecision = 8;
camera.attachControl(canvas, true);

let game, world, pathLine, animating = false;

// ============ De slagbronnen ============
const bus = new ShotBus();
const sources = {
  simulatie: new SimulatedSource(),
  openconnect: new OpenConnectSource("ws://localhost:8921", showSourceStatus),
  trackman: new TrackmanRangeSource("ws://localhost:8922", showSourceStatus),
};
const SOURCE_HELP = {
  simulatie: "",
  openconnect: "Start op de pc met de launch monitor: node tools/openconnect-bridge.mjs. Stel in de app van je launch monitor GSPro in als doel. De brug stuurt elke slag hierheen.",
  trackman: "Adres van de Trackman Range-metingen (uit de sessie), of ws://localhost:8922 voor de nagebouwde Trackman: node tools/mock-trackman.mjs.",
};
let sourceKey = "simulatie";
sources.simulatie.start(bus);

bus.on((shot) => {
  if (!game || mode !== "spelen") return;
  if (animating) { queued.push(shot); return; }
  const entry = game.applyShot(shot);
  if (entry) playEntry(entry);
});
const queued = []; // slagen die binnenkwamen tijdens een animatie

function switchSource(key) {
  sources[sourceKey].stop();
  sourceKey = key;
  const src = sources[key];
  el("simBediening").hidden = key !== "simulatie";
  el("bronAdresRij").hidden = key === "simulatie";
  el("bronUitleg").hidden = key === "simulatie";
  el("bronUitleg").textContent = SOURCE_HELP[key];
  if (key === "simulatie") { showSourceStatus("verbonden", ""); src.start(bus); return; }
  el("bronAdres").value = src.url;
  src.start(bus);
}
function showSourceStatus(status, detail) {
  const box = el("bronStatus");
  box.className = "bronStatus " + status;
  box.textContent = sourceKey === "simulatie" ? "" : { uit: "uit", verbinden: "verbinden…", verbonden: "verbonden", fout: "geen verbinding" }[status] || status;
  if (detail && sourceKey !== "simulatie") el("melding").textContent = detail;
  if (status === "verbonden" && sourceKey !== "simulatie" && game && !game.finished) el("melding").textContent = "Verbonden. Sla een bal op de range.";
}
el("bron").addEventListener("change", () => switchSource(el("bron").value));
el("bronVerbind").addEventListener("click", () => {
  const src = sources[sourceKey];
  src.stop();
  src.url = el("bronAdres").value.trim();
  src.start(bus);
});

// ============ Ronde en holes ============
function startRound() {
  scores.length = 0;
  holeIndex = 0;
  wind = randomWind(seasonKey);
  el("scorekaart").hidden = true;
  startHole(0);
}

function startHole(index) {
  if (!course.holes.length) {
    el("melding").textContent = "Deze baan heeft nog geen holes. Ga naar Bouwen en voeg er een toe.";
    return;
  }
  holeIndex = Math.min(index, course.holes.length - 1);
  if (world) world.dispose();
  if (pathLine) { pathLine.dispose(); pathLine = null; }
  game = new HoleGame(course, holeIndex, { wind, rollFactor: SEASONS[seasonKey].rollFactor });
  world = buildHole(scene, game.hole, course.theme || "classic", seasonKey);
  el("thema").value = course.theme || "classic";
  el("holeNaam").textContent = `${holeIndex + 1}. ${game.hole.name || "Hole"}`;
  el("holeInfo").textContent = `Par ${game.par} · ${Math.round(holeLength(game.hole))} m`;
  el("wind").textContent = describeWind(wind);
  el("melding").textContent = sourceKey === "simulatie"
    ? (holeIndex === 0 ? "Kies een club en sla. De slag is verzonnen: er hangt nog geen simulator aan." : `Hole ${holeIndex + 1}. Kies een club en sla.`)
    : `Hole ${holeIndex + 1}. Sla een bal op de range.`;
  el("laatste").hidden = true;
  el("volgende").hidden = true;
  lookBehindBall();
  updateHud();
}

function updateHud() {
  el("slagen").textContent = game.strokes;
  el("afstand").textContent = game.finished ? "in het gat" : `${Math.round(game.distanceToPin())} m`;
  el("ligging").textContent = game.finished ? game.scoreName() : surfaceLabel(game.surface());
  const played = scores.reduce((a, b) => a + b, 0) + (game.finished ? 0 : game.strokes);
  const parSoFar = course.holes.slice(0, scores.length).reduce((a, h) => a + holePar(h), 0);
  el("ronde").textContent = scores.length ? `${played} (${signed(played - parSoFar)} na ${scores.length})` : `${played}`;
  el("clubs").querySelectorAll("button").forEach((b) => (b.disabled = game.finished || animating));
}

function holePar(h) {
  return h.par || computePar(holeLength(h));
}
function signed(n) {
  return n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;
}

function lookBehindBall(radius = 14) {
  const b = game.ball, p = game.hole.pin;
  camera.target = toWorld(game.hole, b.x, b.y, 0.8);
  camera.alpha = Math.atan2(b.y - p.y, b.x - p.x);
  camera.beta = 1.25;
  camera.radius = radius;
}

function playEntry(entry) {
  const { result, shot } = entry;
  animating = true;
  updateHud();
  showShot(shot, entry);
  if (pathLine) pathLine.dispose();
  pathLine = drawPath(scene, game.hole, result.points, world.theme.flag);
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
    scores[holeIndex] = game.strokes;
    el("melding").textContent += ` Score: ${game.strokes} (${game.scoreName()}).`;
    if (holeIndex < course.holes.length - 1) {
      el("volgende").hidden = false;
    } else {
      const total = scores.reduce((a, b) => a + b, 0);
      const par = course.holes.reduce((a, h) => a + holePar(h), 0);
      el("melding").textContent += ` Ronde klaar: ${total} slagen, ${signed(total - par)}.`;
      showScorecard();
    }
  }
  lookBehindBall(game.finished ? 20 : 14);
  updateHud();
  // Slagen die tijdens de animatie binnenkwamen (van een echte simulator) alsnog spelen.
  if (queued.length && !game.finished) {
    const next = queued.shift();
    const e = game.applyShot(next);
    if (e) playEntry(e);
  } else queued.length = 0;
}

function showShot(shot, entry) {
  el("laatste").hidden = false;
  el("lsClub").textContent = shot.club || "-";
  el("lsBron").textContent = shot.source;
  el("lsSpeed").textContent = `${shot.ballSpeed.toFixed(1)} m/s (${(shot.ballSpeed * 3.6).toFixed(0)} km/u)`;
  el("lsAngle").textContent = `${shot.launchAngle.toFixed(1)}°`;
  el("lsDir").textContent = `${shot.direction > 0 ? "+" : ""}${shot.direction.toFixed(1)}°`;
  el("lsSpin").textContent = `${Math.round(shot.backSpin)} / ${Math.round(shot.sideSpin)} rpm`;
  el("lsCarry").textContent = `${Math.round(entry.result.carry)} m` + (shot.measuredCarry ? ` (simulator: ${Math.round(shot.measuredCarry)} m)` : "");
}

// Scorekaart.
function showScorecard() {
  const table = el("scoreTabel");
  const holes = course.holes;
  const head = `<tr><th>Hole</th>${holes.map((_, i) => `<th>${i + 1}</th>`).join("")}<th>Tot.</th></tr>`;
  const parRow = `<tr><th>Par</th>${holes.map((h) => `<td>${holePar(h)}</td>`).join("")}<td>${holes.reduce((a, h) => a + holePar(h), 0)}</td></tr>`;
  const played = holes.map((h, i) => scores[i]);
  const total = played.reduce((a, b) => a + (b || 0), 0);
  const scoreRow = `<tr><th>Slagen</th>${holes.map((h, i) => {
    const s = played[i];
    if (s == null) return "<td>-</td>";
    const d = s - holePar(h);
    return `<td class="${d < 0 ? "min" : d > 0 ? "plus" : ""}" title="${scoreName(s, holePar(h))}">${s}</td>`;
  }).join("")}<td>${total}</td></tr>`;
  const parPlayed = holes.filter((_, i) => played[i] != null).reduce((a, h) => a + holePar(h), 0);
  const diffRow = `<tr><th>+/-</th>${holes.map((h, i) => played[i] == null ? "<td></td>" : `<td>${signed(played[i] - holePar(h))}</td>`).join("")}<td>${signed(total - parPlayed)}</td></tr>`;
  table.innerHTML = head + parRow + scoreRow + diffRow;
  el("scorekaart").hidden = false;
}
el("toonScorekaart").addEventListener("click", () => { if (el("scorekaart").hidden) showScorecard(); else el("scorekaart").hidden = true; });
el("sluitScorekaart").addEventListener("click", () => (el("scorekaart").hidden = true));

// Knoppen in de speelstand.
for (const [key, club] of Object.entries(CLUBS)) {
  const b = document.createElement("button");
  b.type = "button";
  b.id = `club-${key}`;
  b.textContent = club.label;
  b.addEventListener("click", () => sources.simulatie.hit(key, Number(el("kracht").value) / 100));
  el("clubs").appendChild(b);
}
el("kracht").addEventListener("input", () => (el("krachtWaarde").textContent = `${el("kracht").value}%`));
el("opnieuw").addEventListener("click", startRound);
el("volgende").addEventListener("click", () => startHole(holeIndex + 1));
for (const sel of [el("thema"), el("baanThema")]) {
  for (const [key, t] of Object.entries(THEMES)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = t.label;
    sel.appendChild(o);
  }
}
for (const [key, s] of Object.entries(SEASONS)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = s.label;
  el("seizoen").appendChild(o);
}
el("seizoen").value = seasonKey;
el("seizoen").addEventListener("change", () => {
  seasonKey = el("seizoen").value;
  try { localStorage.setItem("eigenbaan.seizoen", seasonKey); } catch { /* niets */ }
  startRound();
});
el("thema").addEventListener("change", () => { course.theme = el("thema").value; el("baanThema").value = course.theme; startHole(holeIndex); saveLocal(course); });
el("cameraBal").addEventListener("click", () => lookBehindBall());
el("cameraBoven").addEventListener("click", () => {
  camera.target = toWorld(game.hole, 0, game.hole.terrain.length / 2, 0);
  camera.alpha = -Math.PI / 2;
  camera.beta = 0.01;
  camera.radius = game.hole.terrain.length * 1.1;
});

engine.runRenderLoop(() => { if (mode === "spelen") scene.render(); });
window.addEventListener("resize", () => engine.resize());

// ============ Bouwen: 2D ============
const editor = new Editor(el("editor"), {
  onChange: () => { refreshHoleForm(); saveLocal(course); },
  onStatus: (text) => (el("bouwStatus").textContent = text),
});

for (const [key, t] of Object.entries(TEMPLATES)) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = t.label;
  el("sjabloon").appendChild(o);
}
el("sjabloon").value = "par4recht";

function editHole(index) {
  holeIndex = Math.max(0, Math.min(index, course.holes.length - 1));
  const hole = course.holes[holeIndex];
  editor.setHole(hole || null, course.theme);
  refreshHoleList();
  refreshHoleForm();
}

function refreshHoleList() {
  const box = el("holeLijst");
  box.innerHTML = "";
  course.holes.forEach((h, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${i + 1}`;
    b.title = h.name || "";
    if (i === holeIndex) b.classList.add("active");
    b.addEventListener("click", () => editHole(i));
    box.appendChild(b);
  });
  if (!course.holes.length) box.textContent = "Nog geen holes. Kies een sjabloon en klik + Hole.";
  el("baanNaam").textContent = `${course.name} · ${course.holes.length} hole${course.holes.length === 1 ? "" : "s"}`;
}

function refreshHoleForm() {
  const hole = course.holes[holeIndex];
  const has = Boolean(hole);
  for (const id of ["holeNaamInvoer", "terreinBreedte", "terreinLengte", "holePar", "autoPutt", "holeDupliceren", "holeVerwijderen", "holeOmhoog", "holeOmlaag"]) el(id).disabled = !has;
  el("baanNaamInvoer").value = course.name;
  el("baanThema").value = course.theme || "classic";
  if (!has) return;
  el("holeNaamInvoer").value = hole.name || "";
  el("terreinBreedte").value = hole.terrain.width;
  el("terreinLengte").value = hole.terrain.length;
  el("holePar").value = hole.par || computePar(distance(hole.tee, hole.pin));
  el("autoPutt").value = hole.autoPuttMeters ?? 3;
  refreshHoleList();
  refreshSelection();
}

function refreshSelection() {
  const sel = editor.selectedItem();
  el("selectieOpties").hidden = !sel || (sel.kind !== "zone" && sel.kind !== "hill");
  el("zoneTypeRij").hidden = sel?.kind !== "zone";
  el("heuvelOpties").hidden = !(editor.tool === "heuvel" || sel?.kind === "hill");
  if (sel?.kind === "zone") el("zoneType").value = sel.item.type;
  if (sel?.kind === "hill") {
    el("heuvelStraal").value = sel.item.radius;
    el("heuvelHoogte").value = sel.item.delta;
    showHillValues();
  }
}

function showHillValues() {
  el("heuvelStraalWaarde").textContent = `${el("heuvelStraal").value} m`;
  const d = Number(el("heuvelHoogte").value);
  el("heuvelHoogteWaarde").textContent = `${d >= 0 ? "+" : ""}${d} m`;
}

function changed() {
  editor.draw();
  refreshHoleForm();
  saveLocal(course);
}

el("tools").querySelectorAll("button").forEach((b) => {
  b.addEventListener("click", () => {
    el("tools").querySelectorAll("button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    editor.setTool(b.dataset.tool);
    refreshSelection();
    el("draftKnoppen").hidden = true;
  });
});
el("editor").addEventListener("pointerdown", () => setTimeout(() => {
  el("draftKnoppen").hidden = !editor.draft;
  refreshSelection();
}, 0));
el("draftKlaar").addEventListener("click", () => { editor.finishDraft(); el("draftKnoppen").hidden = true; });
el("draftTerug").addEventListener("click", () => { editor.undoPoint(); el("draftKnoppen").hidden = !editor.draft; });
el("draftAnnuleer").addEventListener("click", () => { editor.cancelDraft(); el("draftKnoppen").hidden = true; });
document.addEventListener("keydown", (e) => {
  if (mode !== "bouwen" || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "Enter") { editor.finishDraft(); el("draftKnoppen").hidden = true; }
  if (e.key === "Escape") { editor.cancelDraft(); el("draftKnoppen").hidden = true; }
  if (e.key === "Backspace" && editor.draft) { editor.undoPoint(); el("draftKnoppen").hidden = !editor.draft; }
  if ((e.key === "Delete" || e.key === "Backspace") && !editor.draft) { editor.deleteSelected(); refreshSelection(); }
});

for (const id of ["heuvelStraal", "heuvelHoogte"]) {
  el(id).addEventListener("input", () => {
    showHillValues();
    editor.hillRadius = Number(el("heuvelStraal").value);
    editor.hillDelta = Number(el("heuvelHoogte").value);
    const sel = editor.selectedItem();
    if (sel?.kind === "hill") { sel.item.radius = editor.hillRadius; sel.item.delta = editor.hillDelta; changed(); }
    else editor.setTool(editor.tool);
  });
}
showHillValues();

el("zoneType").addEventListener("change", () => {
  const sel = editor.selectedItem();
  if (sel?.kind === "zone") { sel.item.type = el("zoneType").value; changed(); }
});
function moveZone(delta) {
  const s = editor.selected;
  if (s?.kind !== "zone") return;
  const to = s.index + delta;
  const zones = course.holes[holeIndex].zones;
  if (to < 0 || to >= zones.length) return;
  [zones[s.index], zones[to]] = [zones[to], zones[s.index]];
  editor.selected = { kind: "zone", index: to };
  changed();
}
el("zoneOnder").addEventListener("click", () => moveZone(-1));
el("zoneBoven").addEventListener("click", () => moveZone(1));
el("selectieWissen").addEventListener("click", () => { editor.deleteSelected(); refreshSelection(); });

el("holeToevoegen").addEventListener("click", () => {
  const hole = TEMPLATES[el("sjabloon").value].make();
  course.holes.push(hole);
  renumber();
  editHole(course.holes.length - 1);
  saveLocal(course);
});
el("holeDupliceren").addEventListener("click", () => {
  const copy = JSON.parse(JSON.stringify(course.holes[holeIndex]));
  copy.name = (copy.name || "Hole") + " (kopie)";
  course.holes.splice(holeIndex + 1, 0, copy);
  renumber();
  editHole(holeIndex + 1);
  saveLocal(course);
});
el("holeVerwijderen").addEventListener("click", () => {
  course.holes.splice(holeIndex, 1);
  renumber();
  editHole(Math.max(0, holeIndex - 1));
  saveLocal(course);
});
function swapHoles(delta) {
  const to = holeIndex + delta;
  if (to < 0 || to >= course.holes.length) return;
  [course.holes[holeIndex], course.holes[to]] = [course.holes[to], course.holes[holeIndex]];
  renumber();
  editHole(to);
  saveLocal(course);
}
el("holeOmhoog").addEventListener("click", () => swapHoles(-1));
el("holeOmlaag").addEventListener("click", () => swapHoles(1));
function renumber() {
  course.holes.forEach((h, i) => (h.number = i + 1));
}

el("holeNaamInvoer").addEventListener("input", () => { course.holes[holeIndex].name = el("holeNaamInvoer").value; refreshHoleList(); saveLocal(course); });
for (const id of ["terreinBreedte", "terreinLengte"]) {
  el(id).addEventListener("change", () => {
    const hole = course.holes[holeIndex];
    hole.terrain.width = clamp(Number(el("terreinBreedte").value), 40, 400);
    hole.terrain.length = clamp(Number(el("terreinLengte").value), 60, 900);
    editor.resize();
    changed();
  });
}
el("holePar").addEventListener("change", () => {
  const hole = course.holes[holeIndex];
  hole.par = clamp(Number(el("holePar").value), 3, 6);
  hole.parOverride = hole.par !== computePar(distance(hole.tee, hole.pin));
  changed();
});
el("autoPutt").addEventListener("change", () => { course.holes[holeIndex].autoPuttMeters = clamp(Number(el("autoPutt").value), 0, 15); saveLocal(course); });

el("baanNaamInvoer").addEventListener("input", () => { course.name = el("baanNaamInvoer").value; refreshHoleList(); saveLocal(course); });
el("baanThema").addEventListener("change", () => { course.theme = el("baanThema").value; editor.setHole(course.holes[holeIndex] || null, course.theme); saveLocal(course); });
el("speelBaan").addEventListener("click", () => setMode("spelen", true));
el("bewaar").addEventListener("click", () => {
  el("bouwStatus").textContent = saveLocal(course) ? "Bewaard op dit apparaat." : "Bewaren lukt niet in deze browser (privémodus?). Gebruik 'Tekst tonen'.";
});
el("toonTekst").addEventListener("click", () => { el("baanTekst").value = toText(course); el("tekstVak").hidden = false; });
el("sluitTekst").addEventListener("click", () => (el("tekstVak").hidden = true));
el("kopieer").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(el("baanTekst").value); el("bouwStatus").textContent = "Gekopieerd."; }
  catch { el("baanTekst").select(); el("bouwStatus").textContent = "Kopiëren lukt niet automatisch; de tekst is geselecteerd, druk Ctrl+C."; }
});
el("laadTekst").addEventListener("click", () => {
  const { course: loaded, error } = fromText(el("baanTekst").value);
  if (error) { el("bouwStatus").textContent = error; return; }
  course = loaded;
  saveLocal(course);
  editHole(0);
  el("tekstVak").hidden = true;
  el("bouwStatus").textContent = "Baan geladen uit tekst.";
});
el("download").addEventListener("click", () => {
  const blob = new Blob([toText(course)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(course.name || "baan").replace(/[^\w-]+/g, "_")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
el("nieuweBaan").addEventListener("click", () => {
  course = newCourse();
  saveLocal(course);
  editHole(0);
  el("bouwStatus").textContent = "Nieuwe lege baan. Kies een sjabloon en klik + Hole.";
});

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

// ============ Standen wisselen ============
function setMode(next, restart = false) {
  mode = next;
  el("spelen").hidden = next !== "spelen";
  el("bouwen").hidden = next !== "bouwen";
  el("tabSpelen").classList.toggle("active", next === "spelen");
  el("tabBouwen").classList.toggle("active", next === "bouwen");
  el("tabSpelen").setAttribute("aria-selected", next === "spelen");
  el("tabBouwen").setAttribute("aria-selected", next === "bouwen");
  if (next === "spelen") {
    engine.resize();
    if (restart || !game) startRound();
    else startHole(holeIndex);
  } else {
    editHole(holeIndex);
    editor.resize();
  }
}
el("tabSpelen").addEventListener("click", () => setMode("spelen"));
el("tabBouwen").addEventListener("click", () => setMode("bouwen"));

// Handig om te leren: open de console (F12) en typ bijvoorbeeld
//   eigenBaan.sim.custom({ ballSpeed: 70, launchAngle: 10, direction: 5, backSpin: 2500 })
window.eigenBaan = { get game() { return game; }, get course() { return course; }, sim: sources.simulatie, sources, bus, scene, camera, CLUBS, editor };

// ============ Start ============
async function boot() {
  course = loadLocal();
  if (!course) {
    const res = await fetch("courses/hole-1.json");
    course = await res.json();
    const errors = validateCourse(course);
    if (errors.length) { el("melding").textContent = "Baanbestand klopt niet: " + errors.join("; "); return; }
  }
  refreshHoleList();
  setMode("spelen", true);
}
boot();
