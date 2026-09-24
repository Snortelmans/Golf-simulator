// Online delen via Supabase (week 4).
//
// Supabase is een kant-en-klare database met een webadres. We praten er
// rechtstreeks mee via fetch(), zonder extra bibliotheek. De 'anon key' mag in
// de browser staan: hij geeft alleen de rechten die in supabase/schema.sql
// zijn vastgelegd (lezen en toevoegen, niets wijzigen of wissen).
//
// Instellen: zet een bestand config.json naast index.html:
//   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseAnonKey": "eyJ..." }
// Zonder dat bestand werkt de app gewoon, maar zonder online delen.

import { validateCourse, holeLength, computePar } from "./course-format.js";

let config = null;

/** Leest config.json. Geeft true als online delen beschikbaar is. */
export async function initCloud() {
  try {
    const res = await fetch("config.json", { cache: "no-store" });
    if (!res.ok) return false;
    const c = await res.json();
    if (c.supabaseUrl && c.supabaseAnonKey) config = c;
  } catch {
    config = null;
  }
  return Boolean(config);
}

export function cloudEnabled() {
  return Boolean(config);
}

async function api(path, { method = "GET", body, headers = {} } = {}) {
  if (!config) throw new Error("Online delen is niet ingesteld (config.json ontbreekt).");
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase antwoordde ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** De nieuwste gepubliceerde banen, zonder de zware baandata. */
export async function listCourses(limit = 30) {
  return api(`courses?select=id,created_at,name,author,theme,holes,par,plays&order=created_at.desc&limit=${limit}`);
}

/** Eén baan compleet ophalen, om te spelen of te bewerken. */
export async function fetchCourse(id) {
  const rows = await api(`courses?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  const row = rows?.[0];
  if (!row) throw new Error("Baan niet gevonden.");
  const errors = validateCourse(row.data);
  if (errors.length) throw new Error("Baan online is beschadigd: " + errors.join("; "));
  api(`rpc/count_play`, { method: "POST", body: { course: id } }).catch(() => {});
  return { ...row.data, cloudId: row.id, name: row.name, author: row.author };
}

/** Publiceert een baan. Geeft het nieuwe id terug. */
export async function publishCourse(course, author) {
  const errors = validateCourse(course);
  if (errors.length) throw new Error("Baan klopt niet: " + errors.join("; "));
  if (!course.holes.length) throw new Error("Voeg eerst minstens één hole toe.");
  const data = { ...course };
  delete data.cloudId;
  const rows = await api("courses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      name: course.name || "Naamloze baan",
      author: (author || "anoniem").slice(0, 40),
      theme: course.theme || "classic",
      holes: course.holes.length,
      par: course.holes.reduce((a, h) => a + (h.par || computePar(holeLength(h))), 0),
      data,
    },
  });
  return rows[0].id;
}

/** Meldt een gespeelde ronde. */
export async function postScore(courseId, player, strokes, par, extra = {}) {
  return api("scores", {
    method: "POST",
    body: { course_id: courseId, player: (player || "anoniem").slice(0, 40), strokes, par, ...extra },
  });
}

/** Beste scores op een baan. */
export async function leaderboard(courseId, limit = 10) {
  return api(`scores?select=player,strokes,par,created_at,season&course_id=eq.${encodeURIComponent(courseId)}&order=strokes.asc,created_at.asc&limit=${limit}`);
}
