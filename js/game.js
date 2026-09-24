// De spelregels voor één hole: waar ligt de bal, hoeveel slagen, is hij binnen?
//
// Deze code weet niets van 3D of van simulators. Hij krijgt een slag binnen,
// laat de natuurkunde het pad uitrekenen en past de regels toe:
//   - water: één strafslag, bal terug op het laatste droge punt
//   - buiten het terrein: één strafslag, opnieuw vanaf dezelfde plek
//   - op de green: automatisch putten (binnen autoPuttMeters = één putt, anders twee)
//
// Wind en seizoen (rolfactor) komen als opties binnen en gaan door naar de natuurkunde.

import { distance, surfaceAt, holeLength, computePar } from "./course-format.js";
import { simulateShot } from "./physics.js";

export class HoleGame {
  constructor(course, holeIndex = 0, options = {}) {
    this.course = course;
    this.hole = course.holes[holeIndex];
    this.par = this.hole.par || computePar(holeLength(this.hole));
    this.autoPuttMeters = this.hole.autoPuttMeters ?? 3;
    this.options = { wind: options.wind || { x: 0, y: 0 }, rollFactor: options.rollFactor ?? 1 };
    this.reset();
  }

  reset() {
    this.ball = { x: this.hole.tee.x, y: this.hole.tee.y };
    this.strokes = 0;
    this.finished = false;
    this.log = [];
  }

  distanceToPin() {
    return distance(this.ball, this.hole.pin);
  }

  surface() {
    return surfaceAt(this.hole, this.ball.x, this.ball.y);
  }

  /** Eenheidsvector van de bal naar de vlag: daar mikt de speler op. */
  aim() {
    const dx = this.hole.pin.x - this.ball.x;
    const dy = this.hole.pin.y - this.ball.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  /**
   * Rekent de vlucht uit. Als de simulator zelf een carry en zijwaartse afwijking
   * meldt (Trackman doet dat), stemmen we de slag af tot onze bal daar landt.
   * Zo blijft het landingspunt van de simulator leidend en blijft ons model
   * alleen nodig voor de animatie en het uitrollen.
   */
  simulate(shot, start) {
    let s = { ...shot };
    let result = simulateShot(s, start, this.aim(), this.hole, this.options);
    if (shot.measuredCarry > 5 && result.carry > 5) {
      for (let i = 0; i < 4; i++) {
        const ratio = shot.measuredCarry / result.carry;
        const sideError = (shot.measuredSide ?? 0) - sideOffset(start, this.aim(), result.landing);
        if (Math.abs(ratio - 1) < 0.02 && Math.abs(sideError) < 1) break;
        s.ballSpeed *= Math.pow(ratio, 0.6);
        s.direction += (sideError / Math.max(20, result.carry)) * (180 / Math.PI);
        result = simulateShot(s, start, this.aim(), this.hole, this.options);
      }
    }
    return result;
  }

  /**
   * Verwerk een slag. Geeft het resultaat terug, inclusief het pad voor de animatie
   * en een korte tekst voor in het scherm.
   */
  applyShot(shot) {
    if (this.finished) return null;
    const start = { ...this.ball };
    const result = this.simulate(shot, start);
    this.strokes += 1;
    let penalty = 0;
    let message;

    if (result.outcome === "water") {
      penalty = 1;
      message = "Water. Eén strafslag, bal terug op het laatste droge punt.";
    } else if (result.outcome === "oob") {
      penalty = 1;
      result.end = start;
      message = "Buiten het terrein. Eén strafslag, opnieuw vanaf dezelfde plek.";
    } else {
      message = `${Math.round(result.carry)} m carry, ${Math.round(result.total)} m totaal, in de ${surfaceLabel(result.surface)}.`;
    }
    this.strokes += penalty;
    this.ball = { ...result.end };

    let putts = 0;
    const toPin = this.distanceToPin();
    if (result.outcome === "ok" && this.surface() === "green") {
      putts = toPin <= this.autoPuttMeters ? 1 : 2;
      this.strokes += putts;
      this.finished = true;
      this.ball = { ...this.hole.pin };
      message += putts === 1 ? ` ${toPin.toFixed(1)} m van de vlag: één putt, binnen!` : ` ${toPin.toFixed(1)} m van de vlag: twee putts, binnen.`;
    }

    const entry = { shot, result, penalty, putts, message, strokes: this.strokes, toPin };
    this.log.push(entry);
    return entry;
  }

  /** Naam van de score, zoals golfers die gebruiken. */
  scoreName() {
    return scoreName(this.strokes, this.par);
  }
}

export function scoreName(strokes, par) {
  const diff = strokes - par;
  if (strokes === 1) return "Hole-in-one";
  const names = { [-3]: "Albatros", [-2]: "Eagle", [-1]: "Birdie", 0: "Par", 1: "Bogey", 2: "Dubbel bogey", 3: "Triple bogey" };
  return names[diff] || `${diff > 0 ? "+" : ""}${diff}`;
}

/** Hoe ver een punt rechts (+) of links (-) van de richtlijn ligt. */
function sideOffset(start, aim, point) {
  const dx = point.x - start.x, dy = point.y - start.y;
  return dx * aim.y - dy * aim.x;
}

export function surfaceLabel(surface) {
  return { tee: "tee", fairway: "fairway", rough: "rough", green: "green", bunker: "bunker", water: "water" }[surface] || surface;
}
