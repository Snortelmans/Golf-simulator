// De baanbouwer: een hole tekenen van bovenaf.
//
// Dit is een gewoon 2D-canvas (geen 3D). De tee staat onderaan, de vlag bovenaan.
// Je kiest een gereedschap en klikt of sleept op het canvas:
//   verplaats  tee, vlag, heuvel of hoekpunt slepen; binnen een zone slepen verplaatst de hele zone
//   zone       (fairway/green/bunker/water/tee) punt voor punt klikken, 'Klaar' sluit de veelhoek
//   heuvel     klik om een heuvel of kuil te zetten (straal en hoogte via de schuifjes)
//   wissen     klik op een zone of heuvel om hem weg te halen
//
// De bouwer verandert het hole-object rechtstreeks en roept onChange() aan.
// Het spel leest datzelfde object. Zo delen bouwen en spelen één bestand.

import { pointInPolygon, computePar, distance, terrainBounds } from "./course-format.js";
import { THEMES } from "./terrain.js";

const MARGIN = 24; // pixels rond het terrein
const GRAB = 14; // pixels: hoe dichtbij je moet klikken om iets te pakken

export class Editor {
  constructor(canvas, { onChange, onStatus } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onChange = onChange || (() => {});
    this.onStatus = onStatus || (() => {});
    this.hole = null;
    this.themeKey = "classic";
    this.tool = "verplaats";
    this.hillRadius = 30;
    this.hillDelta = 3;
    this.draft = null; // veelhoek in aanbouw
    this.selected = null; // { kind: "zone"|"hill"|"tee"|"pin", index }
    this.drag = null;
    this.scale = 1;
    this.offset = { x: 0, y: 0 };

    canvas.addEventListener("pointerdown", (e) => this.#down(e));
    canvas.addEventListener("pointermove", (e) => this.#move(e));
    canvas.addEventListener("pointerup", (e) => this.#up(e));
    canvas.addEventListener("pointercancel", (e) => this.#up(e));
    canvas.addEventListener("dblclick", () => this.finishDraft());
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  setHole(hole, themeKey) {
    this.hole = hole;
    if (themeKey) this.themeKey = themeKey;
    this.draft = null;
    this.selected = null;
    this.resize();
  }

  setTool(tool) {
    this.tool = tool;
    this.draft = null;
    this.selected = null;
    this.#status();
    this.draw();
  }

  // --- Omrekenen tussen meters (baan) en pixels (scherm).
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.view = { w: rect.width, h: rect.height };
    if (!this.hole || rect.width < 20 || rect.height < 20) return; // nog niet zichtbaar
    const { width, length } = this.hole.terrain;
    this.scale = Math.min((rect.width - 2 * MARGIN) / width, (rect.height - 2 * MARGIN) / length);
    this.offset = {
      x: rect.width / 2,
      y: rect.height - MARGIN - (rect.height - 2 * MARGIN - length * this.scale) / 2,
    };
    this.draw();
  }

  toScreen(x, y) {
    return { sx: this.offset.x + x * this.scale, sy: this.offset.y - y * this.scale };
  }

  toWorld(sx, sy) {
    return { x: (sx - this.offset.x) / this.scale, y: (this.offset.y - sy) / this.scale };
  }

  #pointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    return { sx, sy, ...this.toWorld(sx, sy) };
  }

  // --- Muis en vinger.
  #down(e) {
    if (!this.hole) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.#pointer(e);
    const b = terrainBounds(this.hole);
    const inside = p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

    if (this.tool === "verplaats") {
      this.drag = this.#hitTest(p);
      this.selected = this.drag ? { kind: this.drag.kind, index: this.drag.index } : null;
      this.#status();
      this.draw();
      return;
    }
    if (!inside) return;

    if (this.tool === "heuvel") {
      this.hole.hills.push({ x: r1(p.x), y: r1(p.y), radius: this.hillRadius, delta: this.hillDelta });
      this.selected = { kind: "hill", index: this.hole.hills.length - 1 };
      this.#changed();
      return;
    }
    if (this.tool === "wissen") {
      const hit = this.#hitTest(p, true);
      if (hit?.kind === "zone") this.hole.zones.splice(hit.index, 1);
      else if (hit?.kind === "hill") this.hole.hills.splice(hit.index, 1);
      this.selected = null;
      this.#changed();
      return;
    }
    // Een zone tekenen: elk klikje is een hoekpunt.
    if (!this.draft) this.draft = { type: this.tool, polygon: [] };
    this.draft.polygon.push([r1(p.x), r1(p.y)]);
    this.#status();
    this.draw();
  }

  #move(e) {
    if (!this.drag || !this.hole) return;
    const p = this.#pointer(e);
    const { kind, index, vertex, last } = this.drag;
    const dx = p.x - last.x, dy = p.y - last.y;
    if (kind === "tee") { this.hole.tee.x = r1(p.x); this.hole.tee.y = r1(p.y); }
    else if (kind === "pin") { this.hole.pin.x = r1(p.x); this.hole.pin.y = r1(p.y); }
    else if (kind === "hill") { this.hole.hills[index].x = r1(p.x); this.hole.hills[index].y = r1(p.y); }
    else if (kind === "zone" && vertex != null) { this.hole.zones[index].polygon[vertex] = [r1(p.x), r1(p.y)]; }
    else if (kind === "zone") {
      this.hole.zones[index].polygon = this.hole.zones[index].polygon.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
    }
    this.drag.last = { x: p.x, y: p.y };
    this.draw();
  }

  #up(e) {
    if (this.drag) {
      this.drag = null;
      this.#changed();
    }
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* al losgelaten */ }
  }

  /** Wat ligt er onder de aanwijzer? Eerst kleine dingen (punten), dan zones. */
  #hitTest(p, forDelete = false) {
    const near = (x, y) => Math.hypot(p.sx - this.toScreen(x, y).sx, p.sy - this.toScreen(x, y).sy) <= GRAB;
    if (!forDelete) {
      if (near(this.hole.pin.x, this.hole.pin.y)) return { kind: "pin", last: p };
      if (near(this.hole.tee.x, this.hole.tee.y)) return { kind: "tee", last: p };
    }
    for (let i = this.hole.hills.length - 1; i >= 0; i--) {
      const h = this.hole.hills[i];
      if (near(h.x, h.y)) return { kind: "hill", index: i, last: p };
    }
    if (!forDelete) {
      for (let i = this.hole.zones.length - 1; i >= 0; i--) {
        const poly = this.hole.zones[i].polygon;
        for (let v = 0; v < poly.length; v++) if (near(poly[v][0], poly[v][1])) return { kind: "zone", index: i, vertex: v, last: p };
      }
    }
    for (let i = this.hole.zones.length - 1; i >= 0; i--) {
      if (pointInPolygon(p.x, p.y, this.hole.zones[i].polygon)) return { kind: "zone", index: i, last: p };
    }
    return null;
  }

  /** Sluit de veelhoek die in aanbouw is. */
  finishDraft() {
    if (!this.draft) return;
    if (this.draft.polygon.length >= 3) {
      this.hole.zones.push(this.draft);
      this.selected = { kind: "zone", index: this.hole.zones.length - 1 };
    }
    this.draft = null;
    this.#changed();
  }

  cancelDraft() {
    this.draft = null;
    this.#status();
    this.draw();
  }

  /** Laatste hoekpunt weghalen tijdens het tekenen. */
  undoPoint() {
    if (this.draft) this.draft.polygon.pop();
    if (this.draft && this.draft.polygon.length === 0) this.draft = null;
    this.#status();
    this.draw();
  }

  deleteSelected() {
    const s = this.selected;
    if (!s) return;
    if (s.kind === "zone") this.hole.zones.splice(s.index, 1);
    if (s.kind === "hill") this.hole.hills.splice(s.index, 1);
    this.selected = null;
    this.#changed();
  }

  selectedItem() {
    const s = this.selected;
    if (!s || !this.hole) return null;
    if (s.kind === "zone") return this.hole.zones[s.index] ? { kind: "zone", item: this.hole.zones[s.index] } : null;
    if (s.kind === "hill") return this.hole.hills[s.index] ? { kind: "hill", item: this.hole.hills[s.index] } : null;
    return { kind: s.kind, item: this.hole[s.kind] };
  }

  #changed() {
    if (this.hole && !this.hole.parOverride) this.hole.par = computePar(distance(this.hole.tee, this.hole.pin));
    this.#status();
    this.draw();
    this.onChange(this.hole);
  }

  #status() {
    if (this.draft) {
      const n = this.draft.polygon.length;
      this.onStatus(n < 3 ? `Klik hoekpunten van de ${this.draft.type} (${n} van minstens 3).` : `${n} hoekpunten. Klik 'Klaar' of dubbelklik om te sluiten.`);
    } else if (this.tool === "verplaats") {
      this.onStatus(this.selected ? `Geselecteerd: ${labelFor(this.selected.kind)}. Slepen om te verplaatsen.` : "Sleep de tee, de vlag, een heuvel, een hoekpunt of een hele zone.");
    } else if (this.tool === "heuvel") {
      this.onStatus(`Klik om een ${this.hillDelta >= 0 ? "heuvel" : "kuil"} van ${Math.abs(this.hillDelta)} m te zetten.`);
    } else if (this.tool === "wissen") {
      this.onStatus("Klik op een zone of heuvel om hem te wissen.");
    } else {
      this.onStatus(`Klik de hoekpunten van de ${this.tool}. Later zones liggen bovenop eerdere.`);
    }
  }

  // --- Tekenen.
  draw() {
    const ctx = this.ctx;
    if (!this.view) return;
    ctx.clearRect(0, 0, this.view.w, this.view.h);
    if (!this.hole || !(this.scale > 0)) return;
    const theme = THEMES[this.themeKey] || THEMES.classic;
    const { width, length } = this.hole.terrain;
    const tl = this.toScreen(-width / 2, length);

    // Terrein (rough) en rand.
    ctx.fillStyle = theme.rough;
    ctx.fillRect(tl.sx, tl.sy, width * this.scale, length * this.scale);

    // Heuvels: licht voor omhoog, donker voor omlaag, als zachte cirkels.
    for (const h of this.hole.hills) {
      const c = this.toScreen(h.x, h.y);
      const r = Math.max(0.5, h.radius * this.scale);
      const g = ctx.createRadialGradient(c.sx, c.sy, 0, c.sx, c.sy, r);
      const a = Math.min(0.45, Math.abs(h.delta) / 12);
      const col = h.delta >= 0 ? `255,255,255` : `0,0,0`;
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zones, in volgorde.
    this.hole.zones.forEach((zone, i) => {
      this.#path(zone.polygon);
      ctx.fillStyle = theme[zone.type] || theme.rough;
      ctx.fill();
      if (this.selected?.kind === "zone" && this.selected.index === i) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [x, y] of zone.polygon) this.#dot(x, y, 4, "#fff");
      }
    });

    // Heuvelmiddelpunten.
    this.hole.hills.forEach((h, i) => {
      const sel = this.selected?.kind === "hill" && this.selected.index === i;
      this.#dot(h.x, h.y, sel ? 6 : 4, h.delta >= 0 ? "#ffffff" : "#222222", sel ? "#ffd166" : null);
    });

    // Veelhoek in aanbouw.
    if (this.draft && this.draft.polygon.length) {
      this.#path(this.draft.polygon, false);
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const [x, y] of this.draft.polygon) this.#dot(x, y, 4, "#ffd166");
    }

    // Tee en vlag.
    this.#dot(this.hole.tee.x, this.hole.tee.y, 6, theme.flag, "#fff");
    const pin = this.toScreen(this.hole.pin.x, this.hole.pin.y);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pin.sx, pin.sy);
    ctx.lineTo(pin.sx, pin.sy - 18);
    ctx.stroke();
    ctx.fillStyle = theme.flag;
    ctx.beginPath();
    ctx.moveTo(pin.sx, pin.sy - 18);
    ctx.lineTo(pin.sx + 12, pin.sy - 14);
    ctx.lineTo(pin.sx, pin.sy - 10);
    ctx.fill();

    // Lengte-aanduiding.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`${Math.round(distance(this.hole.tee, this.hole.pin))} m · par ${this.hole.par}`, tl.sx + 6, tl.sy + 16);
  }

  #path(polygon, close = true) {
    const ctx = this.ctx;
    ctx.beginPath();
    polygon.forEach(([x, y], i) => {
      const s = this.toScreen(x, y);
      if (i === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    });
    if (close) ctx.closePath();
  }

  #dot(x, y, r, fill, stroke) {
    const s = this.toScreen(x, y);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
}

function r1(v) {
  return Math.round(v * 10) / 10;
}

function labelFor(kind) {
  return { zone: "zone", hill: "heuvel", tee: "tee", pin: "vlag" }[kind] || kind;
}
