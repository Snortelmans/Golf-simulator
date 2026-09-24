// Balvlucht en uitrollen.
//
// Dit is een vereenvoudigd natuurkundig model, genoeg om een slag geloofwaardig
// te laten voelen. Het rekent in baancoördinaten (x dwars, y langs, h omhoog).
//
// Drie krachten werken op de bal in de lucht:
//   1. zwaartekracht (naar beneden)
//   2. luchtweerstand (tegen de vliegrichting in, groeit met de snelheid in het kwadraat)
//   3. lift door backspin (de bal 'zweeft' en blijft langer in de lucht)
// Bij sidespin komt de lift schuin te staan en buigt de bal af (slice of hook).
//
// Bij Trackman Range nemen we later het landingspunt van Trackman zelf over.
// Dit model is dan alleen nog nodig voor verzonnen slagen en voor het uitrollen.

import { heightAt, surfaceAt, slopeAt, insideTerrain } from "./course-format.js";

export const BALL = {
  mass: 0.04593, // kg
  radius: 0.02135, // m
  area: Math.PI * 0.02135 * 0.02135, // frontaal oppervlak, m²
};

const AIR_DENSITY = 1.225; // kg/m³
const GRAVITY = 9.81;

/**
 * Hoe elke ondergrond zich gedraagt bij landen en rollen.
 *   bounce: hoeveel van de verticale snelheid terugkomt (0 = dood, 1 = stuiterbal)
 *   keep:   hoeveel van de horizontale snelheid overblijft na een stuit
 *   roll:   hoe hard de bal afremt tijdens het rollen, in m/s²
 */
export const SURFACES = {
  tee: { bounce: 0.35, keep: 0.6, roll: 1.8 },
  fairway: { bounce: 0.35, keep: 0.6, roll: 1.8 },
  green: { bounce: 0.25, keep: 0.55, roll: 1.0 },
  rough: { bounce: 0.2, keep: 0.45, roll: 4.5 },
  bunker: { bounce: 0.05, keep: 0.2, roll: 9 },
  water: { bounce: 0, keep: 0, roll: 99 },
};

/**
 * Simuleert één slag vanaf 'start' en geeft het hele pad terug.
 *
 * shot = genormaliseerde slag uit de shot-laag:
 *   ballSpeed (m/s), launchAngle (graden omhoog), direction (graden, + = rechts van de richtlijn),
 *   backSpin (rpm), sideSpin (rpm, + = buigt naar rechts)
 * aim = { x, y } eenheidsvector van de richtlijn (waar de speler op mikt)
 *
 * Geeft terug: { points, carry, total, landing, end, surface, outcome }
 *   outcome: "ok" | "water" | "oob"
 */
export function simulateShot(shot, start, aim, hole, options = {}) {
  const dt = options.dt ?? 0.005;
  const sampleEvery = options.sampleEvery ?? 0.02;
  const maxTime = 60;

  // Richtlijn draaien met de afwijking van de slag (direction).
  const dirRad = (shot.direction * Math.PI) / 180;
  const cosD = Math.cos(dirRad);
  const sinD = Math.sin(dirRad);
  // Draaien van de aim-vector: positief = met de klok mee gezien van boven = naar rechts.
  const hx = aim.x * cosD + aim.y * sinD;
  const hy = -aim.x * sinD + aim.y * cosD;

  const launchRad = (shot.launchAngle * Math.PI) / 180;
  const v = {
    x: shot.ballSpeed * Math.cos(launchRad) * hx,
    y: shot.ballSpeed * Math.cos(launchRad) * hy,
    h: shot.ballSpeed * Math.sin(launchRad),
  };
  const p = { x: start.x, y: start.y, h: heightAt(hole, start.x, start.y) + BALL.radius };

  let backSpin = ((shot.backSpin || 0) * 2 * Math.PI) / 60; // rad/s
  let sideSpin = ((shot.sideSpin || 0) * 2 * Math.PI) / 60;

  const points = [{ x: p.x, y: p.y, h: p.h, t: 0 }];
  let t = 0;
  let nextSample = sampleEvery;
  let phase = "flight"; // flight -> bounce -> roll
  let landing = null;
  let carry = 0;
  let flightTime = 0;
  let lastDry = { x: start.x, y: start.y };
  let outcome = "ok";

  const k = (0.5 * AIR_DENSITY * BALL.area) / BALL.mass; // versnelling per (snelheid²)

  while (t < maxTime) {
    if (phase === "flight" || phase === "bounce") {
      const speed = Math.hypot(v.x, v.y, v.h);
      if (speed > 0.01) {
        // Spin-verhouding bepaalt hoeveel lift en extra weerstand er is.
        const omega = Math.hypot(backSpin, sideSpin);
        const spinRatio = (omega * BALL.radius) / speed;
        const cd = Math.min(0.42, 0.21 + 0.45 * spinRatio);
        const cl = Math.min(0.35, 0.1 + 1.2 * spinRatio);

        // Luchtweerstand.
        const ax = -k * cd * speed * v.x;
        const ay = -k * cd * speed * v.y;
        const ah = -k * cd * speed * v.h;

        // Lift: staat loodrecht op de vliegrichting én op de spin-as.
        let lx = 0, ly = 0, lh = 0;
        if (omega > 0) {
          const hs = Math.hypot(v.x, v.y) || 1e-6;
          const fx = v.x / hs, fy = v.y / hs; // horizontale vliegrichting
          // Backspin-as wijst naar rechts (fy, -fx, 0); sidespin-as wijst omlaag (0,0,-1) voor een slice.
          let axX = (backSpin / omega) * fy;
          let axY = (backSpin / omega) * -fx;
          // Sidespin buigt in dit model iets te hard; 0.6 brengt het in lijn met Trackman-ervaring.
          let axH = (sideSpin / omega) * -0.6;
          // Kruisproduct spin-as × vliegrichting geeft de liftrichting.
          const ux = v.x / speed, uy = v.y / speed, uh = v.h / speed;
          lx = axY * uh - axH * uy;
          ly = axH * ux - axX * uh;
          lh = axX * uy - axY * ux;
          const liftAcc = k * cl * speed * speed;
          lx *= liftAcc; ly *= liftAcc; lh *= liftAcc;
        }

        v.x += (ax + lx) * dt;
        v.y += (ay + ly) * dt;
        v.h += (ah + lh - GRAVITY) * dt;
      } else {
        v.h -= GRAVITY * dt;
      }
      // Spin neemt langzaam af in de lucht.
      backSpin *= 1 - 0.04 * dt;
      sideSpin *= 1 - 0.04 * dt;

      p.x += v.x * dt;
      p.y += v.y * dt;
      p.h += v.h * dt;

      const ground = heightAt(hole, p.x, p.y) + BALL.radius;
      if (p.h <= ground && v.h < 0) {
        // Contact met de grond.
        p.h = ground;
        const surface = surfaceAt(hole, p.x, p.y);
        if (phase === "flight") {
          landing = { x: p.x, y: p.y };
          carry = Math.hypot(p.x - start.x, p.y - start.y);
          flightTime = t;
          phase = "bounce";
        }
        if (surface === "water") { outcome = "water"; break; }
        const s = SURFACES[surface] || SURFACES.rough;
        v.h = -v.h * s.bounce;
        v.x *= s.keep;
        v.y *= s.keep;
        // Backspin remt de bal bij het stuiteren extra af (zoals een wedge die 'bijt').
        const bite = Math.min(0.5, backSpin / 2500);
        v.x *= 1 - bite;
        v.y *= 1 - bite;
        backSpin *= 0.5;
        sideSpin *= 0.5;
        if (v.h < 1.0) {
          v.h = 0;
          phase = "roll";
        }
      }
    } else {
      // Rollen: afremmen door de ondergrond, versnellen door de helling.
      const surface = surfaceAt(hole, p.x, p.y);
      if (surface === "water") { outcome = "water"; break; }
      const s = SURFACES[surface] || SURFACES.rough;
      const speed = Math.hypot(v.x, v.y);
      if (speed < 0.05) break;
      const slope = slopeAt(hole, p.x, p.y);
      const ax = (-s.roll * v.x) / speed - GRAVITY * slope.dx;
      const ay = (-s.roll * v.y) / speed - GRAVITY * slope.dy;
      v.x += ax * dt;
      v.y += ay * dt;
      // Voorkom dat afremmen de bal de andere kant op duwt.
      if (v.x * (v.x - ax * dt) < 0 && Math.abs(slope.dx) < 0.02) v.x = 0;
      if (v.y * (v.y - ay * dt) < 0 && Math.abs(slope.dy) < 0.02) v.y = 0;
      p.x += v.x * dt;
      p.y += v.y * dt;
      p.h = heightAt(hole, p.x, p.y) + BALL.radius;
    }

    if (!insideTerrain(hole, p.x, p.y)) { outcome = "oob"; break; }
    if (surfaceAt(hole, p.x, p.y) !== "water") lastDry = { x: p.x, y: p.y };

    t += dt;
    if (t >= nextSample) {
      points.push({ x: p.x, y: p.y, h: p.h, t });
      nextSample += sampleEvery;
    }
  }
  points.push({ x: p.x, y: p.y, h: p.h, t });

  const end = outcome === "ok" ? { x: p.x, y: p.y } : lastDry;
  return {
    points,
    carry,
    total: Math.hypot(end.x - start.x, end.y - start.y),
    landing: landing || end,
    end,
    surface: surfaceAt(hole, end.x, end.y),
    outcome,
    flightTime,
  };
}
