import { G } from "../G";
import { synth } from "../audio/Synth";
import { JUKEBOX, trackFor, type JukeboxTrack } from "../../content/jukebox";

/** Every new piece of music you hear goes on the jukebox at home (kept across runs, like the archive). */
export function installJukebox() {
  synth.onMusic = (id) => {
    const t = trackFor(id);
    if (!t || !G.meta) return;
    const heard = (G.meta.heardMusic ??= []);
    const key = t.ids[0];
    if (heard.includes(key)) return;
    heard.push(key);
    G.saveMeta();
  };
}

export function heardTracks(): JukeboxTrack[] {
  const heard = new Set(G.meta?.heardMusic ?? []);
  return JUKEBOX.filter((t) => heard.has(t.ids[0]));
}

