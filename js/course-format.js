// Het baanformaat: hoe een baan als data is opgeslagen.
//
// Een baan is een gewoon tekstbestand (JSON). Kijk in courses/hole-1.json.
// Alles staat in meters. Coördinaten per hole:
//   x = dwars (0 = midden, positief = rechts als je vanaf de tee naar de vlag kijkt)
//   y = langs  (0 = achterkant van de tee, oplopend richting de vlag)
//
// Een hole bestaat uit:
//   - terrain: de grootte van het stuk grond (width x length)
//   - tee en pin: startpunt en vlag
//   - zones: veelhoeken met een ondergrond (fairway, green, bunker, water, tee).
//     Alles buiten de zones is rough. Latere zones liggen bóvenop eerdere.
//   - hills: heuvels en kuilen, elk een ronde bult met een straal en een hoogte (delta).
//     De hoogte op een punt is de som van alle bulten. Zo krijg je glooiend terrein
//     zonder dat je een hoogtekaart hoeft te tekenen.

export const FORMAT = "eigenbaan/1";
export const ZONE_TYPES = ["tee", "fairway", "rough", "green", "bunker", "water"];

/** Controleert of een baanbestand klopt. Geeft een lijst met fouten terug (leeg = goed). */
export function validateCourse(course) {
  const errors = [];
  if (!course || typeof course !== "object") return ["Baan is geen object"];
  if (course.format !== FORMAT) errors.push(`Onbekend formaat "${course.format}", verwacht "${FORMAT}"`);
  if (!Array.isArray(course.holes) || course.holes.length === 0) errors.push("Baan heeft geen holes");
  (course.holes || []).forEach((hole, i) => {
    const where = `hole ${i + 1}`;
    if (!hole.terrain || !(hole.terrain.width > 0) || !(hole.terrain.length > 0)) errors.push(`${where}: terrain.width en terrain.length moeten groter dan 0 zijn`);
    if (!isPoint(hole.tee)) errors.push(`${where}: tee mist of is geen {x, y}`);
    if (!isPoint(hole.pin)) errors.push(`${where}: pin mist of is geen {x, y}`);
    (hole.zones || []).forEach((zone, z) => {
      if (!ZONE_TYPES.includes(zone.type)) errors.push(`${where}, zone ${z + 1}: onbekend type "${zone.type}"`);
      if (!Array.isArray(zone.polygon) || zone.polygon.length < 3) errors.push(`${where}, zone ${z + 1}: polygon heeft minstens 3 punten nodig`);
    });
    (hole.hills || []).forEach((hill, h) => {
      if (!(hill.radius > 0)) errors.push(`${where}, heuvel ${h + 1}: radius moet groter dan 0 zijn`);
    });
  });
  return errors;
}

function isPoint(p) {
  return p && typeof p.x === "number" && typeof p.y === "number";
}

/** Het rechthoekige stuk grond van een hole, in baancoördinaten. */
export function terrainBounds(hole) {
  const w = hole.terrain.width;
  const l = hole.terrain.length;
  return { minX: -w / 2, maxX: w / 2, minY: 0, maxY: l };
}

export function insideTerrain(hole, x, y) {
  const b = terrainBounds(hole);
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Ligt punt (x, y) binnen de veelhoek? Klassieke 'ray casting'-test. */
export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Welke ondergrond ligt op (x, y)? De laatst genoemde zone wint. Buiten alles = rough. */
export function surfaceAt(hole, x, y) {
  let surface = "rough";
  for (const zone of hole.zones || []) {
    if (pointInPolygon(x, y, zone.polygon)) surface = zone.type;
  }
  return surface;
}

/** Hoogte van het terrein op (x, y): de som van alle heuvels (ronde bulten). */
export function heightAt(hole, x, y) {
  let h = 0;
  for (const hill of hole.hills || []) {
    const dx = x - hill.x;
    const dy = y - hill.y;
    const sigma = hill.radius / 2; // de bult is op 'radius' afstand vrijwel weg
    h += hill.delta * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
  return h;
}

/** Helling van het terrein: hoeveel de hoogte stijgt per meter in x en in y. */
export function slopeAt(hole, x, y) {
  const d = 0.5;
  return {
    dx: (heightAt(hole, x + d, y) - heightAt(hole, x - d, y)) / (2 * d),
    dy: (heightAt(hole, x, y + d) - heightAt(hole, x, y - d)) / (2 * d),
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Lengte van de hole in meters, van tee tot vlag. */
export function holeLength(hole) {
  return distance(hole.tee, hole.pin);
}

/**
 * Automatische par op basis van lengte. Vuistregel geïnspireerd op de
 * USGA-richtlijnen voor heren, afgerond naar meters. Par 6 bestaat hier gewoon.
 */
export function computePar(lengthMeters) {
  if (lengthMeters < 235) return 3;
  if (lengthMeters < 435) return 4;
  if (lengthMeters < 640) return 5;
  return 6;
}
