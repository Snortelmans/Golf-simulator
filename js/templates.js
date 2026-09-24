// Sjablonen: kant-en-klare holes om mee te beginnen.
//
// Elk sjabloon is een functie die een hole-object maakt. Daarna kun je alles
// aanpassen in de bouwer. De vormen zijn bewust simpel: een paar veelhoeken
// en een paar heuvels.

import { computePar, distance } from "./course-format.js";

/** Een ovaal als veelhoek, handig voor greens en bunkers. */
export function oval(cx, cy, rx, ry, n = 12, rotation = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([
      round(cx + x * Math.cos(rotation) - y * Math.sin(rotation)),
      round(cy + x * Math.sin(rotation) + y * Math.cos(rotation)),
    ]);
  }
  return pts;
}

/** Een 'slang' langs een middenlijn: van punten (x, y, halve breedte) naar een gesloten veelhoek. */
export function ribbon(centerline) {
  const left = [], right = [];
  for (let i = 0; i < centerline.length; i++) {
    const [x, y, hw] = centerline[i];
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // loodrecht op de richting
    left.push([round(x + nx * hw), round(y + ny * hw)]);
    right.push([round(x - nx * hw), round(y - ny * hw)]);
  }
  return left.concat(right.reverse());
}

function round(v) {
  return Math.round(v * 10) / 10;
}

function base(name, width, length, tee, pin) {
  const hole = {
    number: 1,
    name,
    terrain: { width, length },
    tee,
    pin,
    autoPuttMeters: 3,
    zones: [],
    hills: [],
  };
  hole.par = computePar(distance(tee, pin));
  return hole;
}

export const TEMPLATES = {
  leeg: {
    label: "Leeg terrein",
    make() {
      const h = base("Nieuwe hole", 140, 300, { x: 0, y: 12 }, { x: 0, y: 260 });
      h.zones.push({ type: "tee", polygon: [[-5, 6], [5, 6], [5, 18], [-5, 18]] });
      h.zones.push({ type: "green", polygon: oval(0, 260, 12, 12) });
      return h;
    },
  },
  par3: {
    label: "Par 3 over water",
    make() {
      const h = base("Over het water", 120, 200, { x: 0, y: 12 }, { x: 4, y: 160 });
      h.zones.push({ type: "water", polygon: [[-40, 40], [40, 40], [44, 120], [-44, 125]] });
      h.zones.push({ type: "fairway", polygon: ribbon([[0, 125, 14], [2, 145, 16], [4, 160, 18], [4, 178, 14]]) });
      h.zones.push({ type: "green", polygon: oval(4, 160, 13, 11) });
      h.zones.push({ type: "bunker", polygon: oval(-14, 150, 5, 8) });
      h.zones.push({ type: "bunker", polygon: oval(20, 168, 5, 6) });
      h.zones.push({ type: "tee", polygon: [[-5, 6], [5, 6], [5, 18], [-5, 18]] });
      h.hills.push({ x: 0, y: 12, radius: 20, delta: 2 }, { x: 4, y: 160, radius: 30, delta: 1.5 }, { x: -50, y: 100, radius: 40, delta: 4 });
      return h;
    },
  },
  par4recht: {
    label: "Par 4 recht",
    make() {
      const h = base("Rechtdoor", 160, 430, { x: 0, y: 12 }, { x: 0, y: 380 });
      h.zones.push({ type: "fairway", polygon: ribbon([[0, 30, 16], [0, 120, 20], [0, 220, 24], [0, 320, 22], [0, 360, 16]]) });
      h.zones.push({ type: "bunker", polygon: oval(28, 230, 6, 12) });
      h.zones.push({ type: "green", polygon: oval(0, 380, 14, 16) });
      h.zones.push({ type: "bunker", polygon: oval(-19, 372, 5, 9) });
      h.zones.push({ type: "tee", polygon: [[-5, 6], [5, 6], [5, 18], [-5, 18]] });
      h.hills.push({ x: 0, y: 12, radius: 22, delta: 1.2 }, { x: 0, y: 380, radius: 40, delta: 2 }, { x: 60, y: 200, radius: 50, delta: 6 }, { x: -60, y: 300, radius: 50, delta: 5 });
      return h;
    },
  },
  doglegLinks: {
    label: "Par 4 dogleg links",
    make() {
      const h = base("De Bocht", 200, 400, { x: 40, y: 12 }, { x: -60, y: 350 });
      h.zones.push({ type: "fairway", polygon: ribbon([[40, 30, 16], [40, 120, 20], [30, 200, 24], [0, 260, 24], [-40, 310, 20], [-60, 335, 16]]) });
      h.zones.push({ type: "bunker", polygon: oval(0, 215, 14, 8) });
      h.zones.push({ type: "water", polygon: [[-100, 200], [-30, 230], [-40, 280], [-100, 290]] });
      h.zones.push({ type: "green", polygon: oval(-60, 350, 15, 14) });
      h.zones.push({ type: "bunker", polygon: oval(-80, 345, 6, 9) });
      h.zones.push({ type: "tee", polygon: [[35, 6], [45, 6], [45, 18], [35, 18]] });
      h.hills.push({ x: 40, y: 12, radius: 22, delta: 1.5 }, { x: 60, y: 260, radius: 60, delta: 8 }, { x: -60, y: 350, radius: 35, delta: 2 });
      return h;
    },
  },
  par5: {
    label: "Par 5 met eilandgreen",
    make() {
      const h = base("Het Eiland", 200, 560, { x: 0, y: 12 }, { x: 10, y: 510 });
      h.zones.push({ type: "fairway", polygon: ribbon([[0, 30, 16], [0, 150, 22], [10, 280, 24], [20, 380, 22], [10, 430, 18]]) });
      h.zones.push({ type: "water", polygon: oval(10, 510, 48, 40, 16) });
      h.zones.push({ type: "fairway", polygon: oval(10, 510, 26, 22) });
      h.zones.push({ type: "green", polygon: oval(10, 510, 16, 14) });
      h.zones.push({ type: "bunker", polygon: oval(30, 300, 7, 14) });
      h.zones.push({ type: "bunker", polygon: oval(-14, 400, 6, 10) });
      h.zones.push({ type: "tee", polygon: [[-5, 6], [5, 6], [5, 18], [-5, 18]] });
      h.hills.push({ x: 0, y: 12, radius: 22, delta: 1.5 }, { x: -70, y: 250, radius: 60, delta: 7 }, { x: 80, y: 150, radius: 50, delta: 5 });
      return h;
    },
  },
  par6: {
    label: "Par 6 monster",
    make() {
      const h = base("Het Monster", 220, 720, { x: -20, y: 12 }, { x: 30, y: 670 });
      h.zones.push({ type: "fairway", polygon: ribbon([[-20, 30, 16], [-20, 150, 22], [0, 280, 24], [30, 400, 24], [40, 520, 22], [30, 640, 16]]) });
      h.zones.push({ type: "water", polygon: [[-100, 300], [-40, 330], [-50, 420], [-100, 440]] });
      h.zones.push({ type: "bunker", polygon: oval(50, 330, 8, 16) });
      h.zones.push({ type: "bunker", polygon: oval(-6, 560, 8, 12) });
      h.zones.push({ type: "green", polygon: oval(30, 670, 18, 16) });
      h.zones.push({ type: "bunker", polygon: oval(8, 660, 6, 10) });
      h.zones.push({ type: "bunker", polygon: oval(54, 680, 6, 10) });
      h.zones.push({ type: "tee", polygon: [[-25, 6], [-15, 6], [-15, 18], [-25, 18]] });
      h.hills.push({ x: -20, y: 12, radius: 22, delta: 1.5 }, { x: 90, y: 200, radius: 60, delta: 9 }, { x: -80, y: 550, radius: 60, delta: 8 }, { x: 30, y: 670, radius: 40, delta: 2.5 });
      return h;
    },
  },
};
