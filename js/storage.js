// Opslaan en laden. Week 2: alleen op je eigen apparaat (localStorage) en als tekst.
// Week 4: online via Supabase, zodat je banen kunt delen.

import { FORMAT, validateCourse } from "./course-format.js";

const KEY = "eigenbaan.course";

/** Slaat de baan op in de browser van dit apparaat. Geeft false als dat niet lukt (privémodus e.d.). */
export function saveLocal(course) {
  try {
    localStorage.setItem(KEY, JSON.stringify(course));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const course = JSON.parse(raw);
    return validateCourse(course).length ? null : course;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try { localStorage.removeItem(KEY); } catch { /* niets */ }
}

/** De baan als nette tekst, om te kopiëren of te bewaren als bestand. */
export function toText(course) {
  return JSON.stringify(course, null, 2);
}

/** Van tekst terug naar een baan. Geeft { course } of { error }. */
export function fromText(text) {
  try {
    const course = JSON.parse(text);
    const errors = validateCourse(course);
    if (errors.length) return { error: errors.join("; ") };
    return { course };
  } catch (e) {
    return { error: "Dit is geen geldige JSON-tekst: " + e.message };
  }
}

export function newCourse(name = "Mijn baan") {
  return { format: FORMAT, name, author: "", theme: "classic", holes: [] };
}
