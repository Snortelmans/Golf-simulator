// De shot-laag: één slagformaat voor alle simulators.
//
// Elk merk (Trackman Range, GSPro Open Connect, straks Inrange) praat anders.
// Een 'bron' (ShotSource) vertaalt dat naar dit ene formaat en geeft het door
// aan de ShotBus. De rest van de app hoeft alleen dit formaat te kennen.
//
// Denk aan een reisstekker: één stekker in de app, per merk een ander opzetstuk.
//
// De richting (direction) is altijd ten opzichte van de richtlijn van de bay.
// Op de range mikt de speler op de vlag in de app; die lijn is de richtlijn.

/**
 * Het slagformaat. Alles in SI-eenheden, hoeken in graden.
 * @typedef {Object} Shot
 * @property {number} ballSpeed    balsnelheid in m/s (bijv. 65 voor een drive)
 * @property {number} launchAngle  hoek omhoog in graden (bijv. 12)
 * @property {number} direction    afwijking van de richtlijn in graden, + = rechts
 * @property {number} backSpin     backspin in rpm (bijv. 2800)
 * @property {number} sideSpin     sidespin in rpm, + = buigt naar rechts (slice)
 * @property {string} source       naam van de bron ("simulatie", "trackman-range", ...)
 * @property {string} [club]       clubnaam als bekend
 * @property {number} timestamp    ms sinds 1970
 * @property {Object} [raw]        de originele data van de simulator, voor debuggen
 */

const LIMITS = {
  ballSpeed: [1, 95],
  launchAngle: [-5, 60],
  direction: [-45, 45],
  backSpin: [0, 15000],
  sideSpin: [-6000, 6000],
};

/** Vult ontbrekende velden aan en houdt waarden binnen realistische grenzen. */
export function normalizeShot(partial) {
  const shot = {
    ballSpeed: num(partial.ballSpeed, 40),
    launchAngle: num(partial.launchAngle, 15),
    direction: num(partial.direction, 0),
    backSpin: num(partial.backSpin, 3000),
    sideSpin: num(partial.sideSpin, 0),
    source: partial.source || "onbekend",
    club: partial.club,
    timestamp: partial.timestamp || Date.now(),
    raw: partial.raw,
  };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    shot[key] = Math.min(max, Math.max(min, shot[key]));
  }
  return shot;
}

function num(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Simpele doorgeefluik: bronnen sturen slagen, het spel luistert. */
export class ShotBus {
  #handlers = [];

  /** Luister naar nieuwe slagen. Geeft een functie terug om weer te stoppen. */
  on(handler) {
    this.#handlers.push(handler);
    return () => {
      this.#handlers = this.#handlers.filter((h) => h !== handler);
    };
  }

  emit(partialShot) {
    const shot = normalizeShot(partialShot);
    for (const handler of this.#handlers) handler(shot);
    return shot;
  }
}

/**
 * Wat elke bron moet kunnen. Dit is een afspraak, geen code die wordt afgedwongen.
 *   name          korte naam voor in het scherm
 *   start(bus)    begin met luisteren naar de simulator en stuur slagen naar de bus
 *   stop()        stop met luisteren
 *   status        "uit" | "verbinden" | "verbonden" | "fout"
 */
export class ShotSource {
  name = "basis";
  status = "uit";
  start(_bus) { throw new Error("start() nog niet gebouwd voor " + this.name); }
  stop() {}
}
