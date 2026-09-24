// Van baandata naar 3D: het terrein, de vlag, de tee en de bal.
//
// Babylon.js (de 3D-bibliotheek) gebruikt andere assen dan ons baanformaat:
//   baan x (dwars)  -> Babylon X
//   baan y (langs)  -> Babylon Z
//   hoogte          -> Babylon Y
// De functie toWorld() zet een baanpunt om naar een Babylon-positie.

import { heightAt, surfaceAt } from "./course-format.js";
import { SEASONS, mixHex } from "./seasons.js";

/** Kleuren per thema. Elke ondergrond krijgt een kleur; de rest is sfeer. */
export const THEMES = {
  classic: {
    label: "Klassiek",
    tee: "#4f9a4f", fairway: "#6ec25a", rough: "#3e8339", green: "#9be07f", bunker: "#e9dca8", water: "#3d86c9",
    sky: "#bfe0f5", fog: "#d8ecf7", flag: "#e63b2e", ball: "#ffffff",
  },
  lava: {
    label: "Lava",
    tee: "#7a3a1a", fairway: "#6b2a12", rough: "#2b1108", green: "#ff8c42", bunker: "#8a8a8a", water: "#ff3b1f",
    sky: "#2a0f0a", fog: "#4a1a10", flag: "#ffd166", ball: "#ffffff",
  },
  sneeuw: {
    label: "Sneeuw",
    tee: "#d6e3ea", fairway: "#eef4f8", rough: "#c2d2dc", green: "#ffffff", bunker: "#a9b8c2", water: "#6fb6e8",
    sky: "#dfe9f0", fog: "#eef4f8", flag: "#e63b2e", ball: "#ffcc00",
  },
  neon: {
    label: "Neon",
    tee: "#1de9b6", fairway: "#00e676", rough: "#0b3d2e", green: "#76ff03", bunker: "#ffea00", water: "#2979ff",
    sky: "#0a0a1a", fog: "#14142a", flag: "#ff4081", ball: "#ffffff",
  },
};

/** Kleurt het gras van een thema naar het seizoen (zomer geel, herfst bruin, winter wit). */
export function seasonTheme(theme, seasonKey) {
  const season = SEASONS[seasonKey];
  if (!season) return theme;
  const out = { ...theme };
  for (const key of ["tee", "fairway", "rough", "green"]) out[key] = mixHex(theme[key], season.tint, season.tintAmount);
  return out;
}

export function toWorld(hole, x, y, extraHeight = 0) {
  return new BABYLON.Vector3(x, heightAt(hole, x, y) + extraHeight, y);
}

function color3(hex) {
  return BABYLON.Color3.FromHexString(hex);
}

/** Bouwt de hele hole in de scene. Geeft de losse onderdelen terug zodat we ze later kunnen opruimen. */
export function buildHole(scene, hole, themeKey = "classic", seasonKey = "lente") {
  const theme = seasonTheme(THEMES[themeKey] || THEMES.classic, seasonKey);
  const parts = [];

  scene.clearColor = BABYLON.Color4.FromHexString(theme.sky + "ff");
  scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogColor = color3(theme.fog);
  scene.fogStart = 350;
  scene.fogEnd = 900;

  // --- Het terrein: een vlak met veel hoekpunten, elk op de juiste hoogte en in de juiste kleur.
  const { width, length } = hole.terrain;
  const step = 1.5; // meter per hoekpunt; kleiner = mooier maar zwaarder
  const ground = BABYLON.MeshBuilder.CreateGround(
    "terrein",
    { width, height: length, subdivisionsX: Math.round(width / step), subdivisionsY: Math.round(length / step), updatable: true },
    scene
  );
  ground.position.z = length / 2; // CreateGround zet het midden op 0; wij willen y van 0 tot length

  const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const indices = ground.getIndices();
  const colors = new Float32Array((positions.length / 3) * 4);
  for (let i = 0, c = 0; i < positions.length; i += 3, c += 4) {
    const x = positions[i];
    const y = positions[i + 2] + ground.position.z;
    positions[i + 1] = heightAt(hole, x, y);
    const rgb = color3(theme[surfaceAt(hole, x, y)] || theme.rough);
    colors[c] = rgb.r; colors[c + 1] = rgb.g; colors[c + 2] = rgb.b; colors[c + 3] = 1;
  }
  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  ground.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);

  const groundMat = new BABYLON.StandardMaterial("terreinMat", scene);
  groundMat.diffuseColor = BABYLON.Color3.White();
  groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  ground.material = groundMat;
  ground.receiveShadows = true;
  parts.push(ground);

  // --- De vlag: een paal, een doek en een gat.
  const pinPos = toWorld(hole, hole.pin.x, hole.pin.y);
  const pole = BABYLON.MeshBuilder.CreateCylinder("paal", { height: 2.2, diameter: 0.06 }, scene);
  pole.position = pinPos.add(new BABYLON.Vector3(0, 1.1, 0));
  const poleMat = new BABYLON.StandardMaterial("paalMat", scene);
  poleMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
  pole.material = poleMat;
  const flag = BABYLON.MeshBuilder.CreatePlane("vlag", { width: 0.7, height: 0.45, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
  flag.position = pinPos.add(new BABYLON.Vector3(0.36, 1.95, 0));
  const flagMat = new BABYLON.StandardMaterial("vlagMat", scene);
  flagMat.diffuseColor = color3(theme.flag);
  flagMat.emissiveColor = color3(theme.flag).scale(0.3);
  flagMat.backFaceCulling = false;
  flag.material = flagMat;
  const cup = BABYLON.MeshBuilder.CreateDisc("gat", { radius: 0.11 }, scene);
  cup.rotation.x = Math.PI / 2;
  cup.position = pinPos.add(new BABYLON.Vector3(0, 0.02, 0));
  const cupMat = new BABYLON.StandardMaterial("gatMat", scene);
  cupMat.diffuseColor = BABYLON.Color3.Black();
  cup.material = cupMat;
  parts.push(pole, flag, cup);

  // --- Teemarkers.
  for (const dx of [-1.5, 1.5]) {
    const marker = BABYLON.MeshBuilder.CreateSphere("teemarker", { diameter: 0.25 }, scene);
    marker.position = toWorld(hole, hole.tee.x + dx, hole.tee.y, 0.12);
    const m = new BABYLON.StandardMaterial("teemarkerMat", scene);
    m.diffuseColor = color3(theme.flag);
    marker.material = m;
    parts.push(marker);
  }

  // --- De bal. Groter dan echt (4,3 cm) zodat je hem van ver ziet.
  const ball = BABYLON.MeshBuilder.CreateSphere("bal", { diameter: 0.4, segments: 12 }, scene);
  const ballMat = new BABYLON.StandardMaterial("balMat", scene);
  ballMat.diffuseColor = color3(theme.ball);
  ballMat.emissiveColor = color3(theme.ball).scale(0.25);
  ball.material = ballMat;
  ball.position = toWorld(hole, hole.tee.x, hole.tee.y, 0.2);
  parts.push(ball);

  return { theme, ground, ball, pinPos, parts, dispose: () => parts.forEach((p) => p.dispose()) };
}

/** Tekent het pad van een slag als een lijn. */
export function drawPath(scene, hole, points, colorHex) {
  const vectors = points.map((p) => new BABYLON.Vector3(p.x, p.h + 0.1, p.y));
  const line = BABYLON.MeshBuilder.CreateLines("pad", { points: vectors }, scene);
  line.color = color3(colorHex);
  line.alpha = 0.8;
  return line;
}
