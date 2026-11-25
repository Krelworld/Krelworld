import { ALL_EPISODES } from "/home/user/Rory-s-rangers-/src/content/television/channels";
import { voiceKey } from "/home/user/Rory-s-rangers-/src/game/audio/voiceKey";
const out = ALL_EPISODES.map((e: any) => ({ id: e.id, channel: e.channel, show: e.show, title: e.title, unlockFlag: e.unlockFlag, unlockHint: e.unlockHint, style: e.style, beats: e.beats.map((b: any) => b.type === "speaker" ? { ...b, key: voiceKey(b.character, b.text) } : b) }));
console.log(JSON.stringify(out));
