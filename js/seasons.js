// Seizoenen en wind.
//
// Een seizoen doet drie dingen: het kleurt het gras anders, het bepaalt hoe ver
// de bal rolt (nat wintergras remt, droog zomergras niet) en hoe hard het waait.
// De wind wordt per ronde geloot en geldt voor alle holes.

export const SEASONS = {
  lente: { label: "Lente", tint: "#7fd66a", tintAmount: 0.15, rollFactor: 0.9, windMax: 6 },
  zomer: { label: "Zomer", tint: "#d9c35a", tintAmount: 0.18, rollFactor: 1.25, windMax: 4 },
  herfst: { label: "Herfst", tint: "#c9782e", tintAmount: 0.22, rollFactor: 0.85, windMax: 9 },
  winter: { label: "Winter", tint: "#e8f0f6", tintAmount: 0.45, rollFactor: 0.7, windMax: 8 },
};

/** Loot een wind voor deze ronde: kracht in m/s en richting in baancoördinaten. */
export function randomWind(seasonKey) {
  const season = SEASONS[seasonKey] || SEASONS.lente;
  const speed = Math.random() * season.windMax;
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, speed };
}

/** Wind in gewone woorden, gezien vanaf de tee richting de vlag. */
export function describeWind(wind) {
  const speed = Math.hypot(wind.x, wind.y);
  if (speed < 0.5) return "windstil";
  const bft = beaufort(speed);
  const along = wind.y, across = wind.x;
  let from;
  if (Math.abs(along) >= Math.abs(across)) from = along > 0 ? "mee" : "tegen";
  else from = across > 0 ? "van links" : "van rechts";
  return `${speed.toFixed(0)} m/s ${from} (${bft} Bft)`;
}

function beaufort(ms) {
  const limits = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2];
  return limits.findIndex((l) => ms < l) === -1 ? 8 : limits.findIndex((l) => ms < l);
}

/** Mengt twee hex-kleuren: amount 0 = alleen a, 1 = alleen b. */
export function mixHex(a, b, amount) {
  const pa = hex(a), pb = hex(b);
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * amount));
  return "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hex(h) {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
