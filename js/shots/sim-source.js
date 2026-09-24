// Verzonnen slagen. Handig om te bouwen zonder launch monitor.
//
// Per club een gemiddelde balsnelheid, lanceerhoek en spin, met wat toeval erbij.
// De getallen liggen in de buurt van een gemiddelde amateur (handicap 15 tot 25).
// Bron: vuistregels uit Trackman-publicaties over amateurgemiddelden; niet exact.

import { ShotSource } from "./shot-layer.js";

export const CLUBS = {
  driver: { label: "Driver", ballSpeed: 62, launchAngle: 12, backSpin: 2800, spread: 4 },
  wood3: { label: "3 wood", ballSpeed: 56, launchAngle: 13, backSpin: 3600, spread: 4 },
  hybrid: { label: "Hybride", ballSpeed: 52, launchAngle: 15, backSpin: 4200, spread: 3.5 },
  iron5: { label: "5 ijzer", ballSpeed: 49, launchAngle: 16, backSpin: 5000, spread: 3.5 },
  iron7: { label: "7 ijzer", ballSpeed: 44, launchAngle: 19, backSpin: 6500, spread: 3 },
  iron9: { label: "9 ijzer", ballSpeed: 38, launchAngle: 23, backSpin: 8000, spread: 3 },
  pw: { label: "Pitching wedge", ballSpeed: 33, launchAngle: 27, backSpin: 9000, spread: 3 },
  sw: { label: "Sand wedge", ballSpeed: 26, launchAngle: 32, backSpin: 9500, spread: 3 },
  chip: { label: "Chip", ballSpeed: 12, launchAngle: 20, backSpin: 3000, spread: 2 },
};

export class SimulatedSource extends ShotSource {
  name = "simulatie";
  #bus = null;

  start(bus) {
    this.#bus = bus;
    this.status = "verbonden";
  }

  stop() {
    this.#bus = null;
    this.status = "uit";
  }

  /**
   * Sla een bal met een club. 'power' schaalt de snelheid (0.3 tot 1.1),
   * zodat je ook een halve swing kunt doen.
   */
  hit(clubKey, power = 1) {
    if (!this.#bus) throw new Error("Simulatie is niet gestart");
    const club = CLUBS[clubKey] || CLUBS.iron7;
    const shot = {
      ballSpeed: club.ballSpeed * power * gauss(1, 0.04),
      launchAngle: club.launchAngle + gauss(0, 1.5),
      direction: gauss(0, club.spread * 0.6),
      backSpin: club.backSpin * gauss(1, 0.12),
      sideSpin: gauss(0, 500),
      source: this.name,
      club: club.label,
    };
    return this.#bus.emit(shot);
  }

  /** Stuur een slag met zelfgekozen getallen (voor het formulier en voor tests). */
  custom(values) {
    if (!this.#bus) throw new Error("Simulatie is niet gestart");
    return this.#bus.emit({ ...values, source: this.name });
  }
}

/** Normaalverdeeld toeval: de meeste slagen zitten dicht bij het gemiddelde. */
function gauss(mean, sd) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
