// Desktop fingerprint: the game states that get recorded, and how the harness reaches each one.
//
// The states are grouped into CHAINS. A chain is one fresh page (empty storage, fixed clock, fixed seed) that is
// played through in a fixed order, recording a state at each stop. Everything is driven the way a laptop player
// drives the game (real key presses and mouse clicks, stepped frame by frame) wherever that is practical; jumps
// straight to a late part of the game use the game's own debug hook (window.__krel), never anything new.
//
// `states` lists what a chain records, in order. `--only x` runs the chain that holds x, up to x.
// A state is either a full dump (h.dump) or an input probe (h.probe: a small record of what an input did).

/** A new game as FLENKY that has left the house once: no welcome, no flyover, no first-broadcast to sit through. */
function newRun(extra) {
  return (S) =>
    S.ev((extra) => {
      const k = window.__krel;
      k.newRun("FLENKY");
      Object.assign(k.G.s.flags, { home_seen: true, flyover_seen: true, tv_klerble_welcome: true }, extra || {});
      k.G.save();
    }, extra);
}
const go = (S, key, data) => S.ev(([key, data]) => window.__krel.go(key, data), [key, data]);
const waitFor = (S, key, max) => S.until((key) => window.__krel.active().includes(key), key, max);
/** In a dungeon room and free to move (no fly-in, title card, conversation, tutorial or VS card in the way). */
const inRoom = (S, o) => S.clear(["Dungeon", "UI"], { ready: () => !window.__krel.game.scene.getScene("Dungeon").busy, ...(o || {}) });

// what the probes read out of the page, frame by frame
const homeMe = () => {
  const h = window.__krel.game.scene.getScene("Home");
  return [Math.round(h.me.x * 100) / 100, Math.round(h.me.y * 100) / 100];
};
const hubMe = () => {
  const h = window.__krel.game.scene.getScene("Hub");
  const c = h.cameras.main;
  return [Math.round(h.av.x * 100) / 100, Math.round(h.av.y * 100) / 100, Math.round(c.scrollX * 100) / 100, Math.round(c.scrollY * 100) / 100];
};
const dungeonMe = () => {
  const d = window.__krel.game.scene.getScene("Dungeon");
  const p = d.player.spr;
  return [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100];
};
const dungeonShots = () => {
  const d = window.__krel.game.scene.getScene("Dungeon");
  const mine = d.shots.filter((s) => s.o.owner !== "enemy");
  window.__fpSeen = window.__fpSeen || new WeakSet();
  let fresh = 0;
  for (const s of mine)
    if (!window.__fpSeen.has(s)) {
      window.__fpSeen.add(s);
      fresh++;
    }
  return [fresh, mine.length];
};
const dungeonState = () => {
  const k = window.__krel;
  const d = k.game.scene.getScene("Dungeon");
  const s = k.G.s;
  return {
    dungeon: k.G.rt.dungeonId, room: k.G.rt.room, side: !!d.side, busy: !!d.busy, enemies: d.enemies.length, boss: d.boss ? d.boss.bossId : null,
    player: [Math.round(d.player.spr.x * 100) / 100, Math.round(d.player.spr.y * 100) / 100], hp: Math.round(s.hp * 100) / 100, gun: s.gun || null, ammo: s.gun ? s.guns[s.gun] : null,
    krezz: Math.round(s.krezz * 100) / 100, wonk: Math.round((d.player.wonk || 0) * 100) / 100,
  };
};

const CHAINS = [
  // ------------------------------------------------------------------ the page itself
  {
    id: "shell",
    about: "The page around the game at three window sizes (where the canvas sits, what is in the document).",
    states: ["shell_windows"],
    async run(h) {
      const { S } = h;
      await S.frames(40);
      const sizes = [[1280, 720], [1440, 900], [1024, 768], [1720, 720]];
      const out = {};
      for (const [w, hh] of [...sizes, [1280, 720]]) {
        await S.page.setViewportSize({ width: w, height: hh });
        // (the scale manager looks at the window twice a second)
        await S.frames(45);
        const rec = await S.ev(() => {
          const r2 = (v) => Math.round(v * 100) / 100;
          const rect = (el) => {
            const b = el.getBoundingClientRect();
            return [r2(b.x), r2(b.y), r2(b.width), r2(b.height)];
          };
          const g = window.__krel.game;
          const c = g.canvas;
          const cs = getComputedStyle(c);
          return {
            window: [window.innerWidth, window.innerHeight], canvas: rect(c), canvasStyle: c.getAttribute("style") || "", canvasMargin: [cs.marginLeft, cs.marginTop], game: rect(document.getElementById("game")), body: rect(document.body),
            gutters: { left: r2(c.getBoundingClientRect().left), right: r2(window.innerWidth - c.getBoundingClientRect().right), top: r2(c.getBoundingClientRect().top), bottom: r2(window.innerHeight - c.getBoundingClientRect().bottom) },
            scale: { display: [r2(g.scale.displaySize.width), r2(g.scale.displaySize.height)], parent: [r2(g.scale.parentSize.width), r2(g.scale.parentSize.height)], displayScale: [Math.round(g.scale.displayScale.x * 1000) / 1000, Math.round(g.scale.displayScale.y * 1000) / 1000], orientation: g.scale.orientation },
            backing: [c.width, c.height],
          };
        });
        const key = `${w}x${hh}`;
        out[key in out ? key + " (back again)" : key] = rec;
      }
      await h.probe("shell_windows", out);
    },
  },

  // ------------------------------------------------------------------ front end
  {
    id: "front",
    about: "Enter gate, title, the Chapter Select password box, Settings (both tabs), KrelTV from the title and its guide.",
    states: ["enter", "title", "title_password", "settings_sound", "settings_play", "tv_from_title", "tv_guide"],
    async run(h) {
      const { S } = h;
      await S.frames(90);
      await h.dump("enter");
      await S.toTitle();
      await S.frames(20);
      await h.dump("title");
      await S.clickText("CHAPTER SELECT");
      await S.frames(20);
      await h.dump("title_password");
      await S.clickText("CANCEL");
      await S.frames(10);
      await S.clickText("SETTINGS", { scene: "Title" });
      await S.frames(30);
      await h.dump("settings_sound");
      await S.clickText("PLAY & DISPLAY", { scene: "Menu" });
      await S.frames(20);
      await h.dump("settings_play");
      await S.key("Escape");
      await S.frames(20);
      await S.clickText("WATCH TV", { scene: "Title" });
      await waitFor(S, "TV");
      await S.frames(120);
      await h.dump("tv_from_title");
      await S.key("d");
      await S.frames(40);
      await h.dump("tv_guide");
    },
  },

  // ------------------------------------------------------------------ a new game, played from the title
  {
    id: "newgame",
    about: "NEW GAME by mouse: character select, difficulty, banter, the welcome at home, walking about, using the telly.",
    states: ["charselect", "difficulty", "banter", "home_welcome", "home", "probe_home_move", "probe_home_interact", "tv_episode", "pause_home"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await S.clickText("NEW GAME");
      await waitFor(S, "CharSelect");
      await S.frames(40);
      await h.dump("charselect");
      // the first card (FLENKY): a click picks and confirms
      await S.click(92, 140);
      await waitFor(S, "Difficulty");
      await S.frames(40);
      await h.dump("difficulty");
      await S.clickText("NEXT: BANTER");
      await waitFor(S, "Banter");
      await S.frames(40);
      await h.dump("banter");
      await S.clickText("LET'S KREZ");
      await waitFor(S, "Home", 900);
      // the welcome: a banner, then the narrator's first line, typed out
      await S.until(() => window.__krel.game.scene.getScene("Home").busy, null, 400);
      await S.frames(120);
      await h.dump("home_welcome");
      await S.key("Tab");
      await S.frames(60);
      await h.dump("home");
      // hold D (walk right) for 60 frames, then let go
      const before = await S.ev(homeMe);
      await S.page.keyboard.down("d");
      const right = await S.sample(60, homeMe);
      await S.page.keyboard.up("d");
      const rest = await S.sample(6, homeMe);
      await h.probe("probe_home_move", { input: "hold D for 60 frames, release, 6 more frames", before, perFrame: right, afterRelease: rest });
      // walk left to the telly and press E
      await S.page.keyboard.down("a");
      const walked = await S.until(() => {
        const hm = window.__krel.game.scene.getScene("Home");
        return hm.prompt.visible && /KrelTV/.test(hm.prompt.text);
      }, null, 400);
      await S.page.keyboard.up("a");
      await S.frames(2);
      const at = await S.ev(() => {
        const hm = window.__krel.game.scene.getScene("Home");
        return { me: [Math.round(hm.me.x * 100) / 100, hm.me.y], prompt: hm.prompt.text, promptAt: [Math.round(hm.prompt.x * 100) / 100, Math.round(hm.prompt.y * 100) / 100] };
      });
      const scenesBefore = await S.scenes();
      await S.key("e");
      await S.frames(30);
      const tv = await S.ev(() => {
        const t = window.__krel.game.scene.getScene("TV");
        return { episode: t.ep ? t.ep.id : null, mode: t.mode };
      });
      await h.probe("probe_home_interact", { input: "hold A until the telly's prompt shows, release, press E", framesWalked: walked, at, scenesBefore, scenesAfter: await S.scenes(), tv });
      await S.frames(210);
      await h.dump("tv_episode");
      // switch it off, then Esc at home: the pause menu
      await S.key("Escape");
      await S.frames(60);
      await S.clear(["UI", "Home"]);
      const pauseBefore = await S.scenes();
      await S.key("Escape");
      await S.frames(20);
      await h.dump("pause_home");
      h.note("pause_home", { scenesBefore: pauseBefore, scenesAfter: await S.scenes() });
    },
  },

  // ------------------------------------------------------------------ Krelford, and the pause menu
  {
    id: "hub",
    about: "Krelford at the front door, walking, Esc for the pause menu and every page of it, save slots, back to the title with a save.",
    states: ["hub", "probe_hub_move", "probe_hub_pause", "pause", "pause_quests", "pause_log", "pause_controls", "pause_settings", "pause_difficulty", "pause_banter", "slots_save", "title_with_save", "slots_load"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun()(S);
      await go(S, "Hub", { at: "HOME" });
      await S.frames(120);
      await h.dump("hub");
      const before = await S.ev(hubMe);
      await S.page.keyboard.down("d");
      const right = await S.sample(40, hubMe);
      await S.page.keyboard.up("d");
      await S.page.keyboard.down("s");
      const down = await S.sample(30, hubMe);
      await S.page.keyboard.up("s");
      const rest = await S.sample(10, hubMe);
      await h.probe("probe_hub_move", { input: "hold D for 40 frames, then S for 30, release, 10 more frames", record: "[player x, player y, camera scrollX, camera scrollY] per frame", before, holdD: right, holdS: down, afterRelease: rest });
      const scenesBefore = await S.scenes();
      await S.key("Escape");
      await S.frames(20);
      await h.probe("probe_hub_pause", { input: "press Escape in town", scenesBefore, scenesAfter: await S.scenes() });
      await h.dump("pause");
      for (const [label, id] of [["QUESTS & SIDE QUESTS", "pause_quests"], ["DIALOGUE LOG", "pause_log"], ["CONTROLS", "pause_controls"], ["SETTINGS", "pause_settings"], ["DIFFICULTY", "pause_difficulty"], ["BANTER", "pause_banter"]]) {
        await S.clickText(label, { scene: "Menu" });
        await S.frames(20);
        // (the town paused underneath is listed in full by "pause": here it is a count and a hash)
        await h.dump(id, { detail: ["Menu"] });
        await S.key("Escape");
        await S.frames(20);
      }
      await S.clickText("SAVE GAME", { scene: "Menu" });
      await S.frames(30);
      await h.dump("slots_save", { detail: ["Menu", "Slots"] });
      // save into slot 1, then quit to the title: it now offers CONTINUE and LOAD GAME
      await S.click(480, 232);
      await S.frames(40);
      await S.clear(["Hub", "UI"]);
      await S.key("Escape");
      await S.frames(20);
      await S.clickText("QUIT TO TITLE", { scene: "Menu" });
      await waitFor(S, "Title");
      await S.frames(60);
      await h.dump("title_with_save");
      await S.clickText("LOAD GAME", { scene: "Title" });
      await S.frames(30);
      await h.dump("slots_load");
    },
  },

  // ------------------------------------------------------------------ talking
  {
    id: "meeting",
    about: "The first Town Hall meeting: its title card gone, the first line being typed, then a few lines in.",
    states: ["meeting", "meeting_later"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun()(S);
      await go(S, "Meeting", { id: "lore_appreciation_inquiry", next: { scene: "Hub" } });
      await S.frames(200);
      await h.dump("meeting");
      for (let i = 0; i < 6; i++) {
        await S.key("e");
        await S.frames(24);
      }
      await h.dump("meeting_later");
    },
  },

  // ------------------------------------------------------------------ a normal dungeon room
  {
    id: "dungeon",
    about: "Wildern room 1 from the door: the arrival conversation, the first-dungeon tutorial, mid-fight, moving, firing, pausing, the WONK gauge.",
    states: ["dungeon_dialogue", "dungeon_tutorial", "dungeon_fight", "probe_dungeon_move", "probe_dungeon_dodge", "probe_dungeon_fire", "pause_dungeon", "wonk_gauge"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun({ prologue_done: true, met_emergency: true })(S);
      await go(S, "Dungeon", { dungeon: "wildern", room: 0 });
      // the fly-in over the school: Space skips it
      await S.frames(40);
      await S.key(" ");
      await waitFor(S, "Dialogue", 400);
      await S.frames(60);
      await h.dump("dungeon_dialogue");
      await S.key("Tab");
      await waitFor(S, "Tutorial", 200);
      await S.frames(30);
      await h.dump("dungeon_tutorial");
      const did = await inRoom(S);
      h.note("dungeon_fight", { toGetThere: did });
      // the first wave walks in
      await S.until(() => window.__krel.game.scene.getScene("Dungeon").enemies.length > 0, null, 400);
      await S.frames(45);
      await h.dump("dungeon_fight");
      const st0 = await S.ev(dungeonState);
      await S.page.keyboard.down("w");
      const up = await S.sample(30, dungeonMe);
      await S.page.keyboard.up("w");
      await S.page.keyboard.down("a");
      const left = await S.sample(30, dungeonMe);
      await S.page.keyboard.up("a");
      await h.probe("probe_dungeon_move", { input: "hold W for 30 frames, then A for 30", before: st0, holdW: up, holdA: left, after: await S.ev(dungeonState) });
      // dodge: walking right (D held), Space pressed on the 6th frame
      const d0 = await S.ev(dungeonState);
      await S.page.keyboard.down("d");
      const roll = [];
      for (let i = 0; i < 40; i++) {
        if (i === 5) await S.page.keyboard.down(" ");
        if (i === 8) await S.page.keyboard.up(" ");
        await S.frames(1);
        roll.push(await S.ev(dungeonMe));
      }
      await S.page.keyboard.up("d");
      await S.frames(2);
      await h.probe("probe_dungeon_dodge", { input: "hold D for 40 frames; Space (dodge) down on frame 6, up on frame 9", before: d0, perFrame: roll, after: await S.ev(dungeonState) });
      // aim up the room with the mouse and hold the left button for 40 frames
      await S.moveTo(480, 120);
      const f0 = await S.ev(dungeonState);
      await S.ev(dungeonShots);
      await S.page.mouse.down();
      const shots = await S.sample(40, dungeonShots);
      await S.page.mouse.up();
      await S.frames(2);
      await h.probe("probe_dungeon_fire", { input: "mouse to (480,120), hold the left button for 40 frames", record: "[new player shots this frame, player shots alive] per frame", before: f0, perFrame: shots, spawned: shots.reduce((n, s) => n + s[0], 0), after: await S.ev(dungeonState) });
      const scenesBefore = await S.scenes();
      await S.key("Escape");
      await S.frames(20);
      await h.dump("pause_dungeon");
      h.note("pause_dungeon", { scenesBefore, scenesAfter: await S.scenes() });
      await S.key("Escape");
      await S.frames(20);
      // the WONK YOUR THANG gauge (started straight away, as when the meter fills)
      await S.ev(() => window.__krel.wonk());
      await S.frames(40);
      await h.dump("wonk_gauge");
    },
  },

  // ------------------------------------------------------------------ a boss, reached through Chapter Select
  {
    id: "boss",
    about: "Chapter Select (password typed in), its boss list, then Chapter 2's boss room: the VS card and the fight, firing a gun that uses ammo.",
    states: ["chapter_select", "chapter_select_bosses", "boss_vs", "boss_room", "probe_boss_fire", "probe_boss_swap", "weapon_picker"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await S.clickText("CHAPTER SELECT");
      await S.frames(20);
      await S.page.keyboard.type("krunt");
      await S.frames(4);
      await S.page.keyboard.press("Enter");
      await waitFor(S, "ChapterSelect");
      await S.frames(30);
      await h.dump("chapter_select");
      await S.clickText("BOSS FIGHTS");
      await S.frames(20);
      await h.dump("chapter_select_bosses");
      await S.clickText("Ch 2 ·", { nth: 0 });
      await waitFor(S, "Dungeon");
      await S.frames(40);
      // the fly-in, the room's title card and the arrival conversation, up to the VS card
      const did1 = await S.clear(["Dungeon", "UI"], { stopAt: "VsSplash" });
      await S.frames(30);
      h.note("boss_vs", { toGetThere: did1 });
      await h.dump("boss_vs");
      const did = await inRoom(S);
      h.note("boss_room", { toGetThere: did });
      await S.frames(90);
      await h.dump("boss_room");
      await S.moveTo(480, 140);
      const f0 = await S.ev(dungeonState);
      await S.ev(dungeonShots);
      await S.page.mouse.down();
      const shots = await S.sample(40, dungeonShots);
      await S.page.mouse.up();
      await S.frames(2);
      await h.probe("probe_boss_fire", { input: "mouse to (480,140), hold the left button for 40 frames", record: "[new player shots this frame, player shots alive] per frame", before: f0, perFrame: shots, spawned: shots.reduce((n, s) => n + s[0], 0), after: await S.ev(dungeonState) });
      // X tapped: the next gun. X held: the weapon picker.
      const guns = () => {
        const s = window.__krel.G.s;
        return { gun: s.gun || null, ammo: s.gun ? s.guns[s.gun] : null, owned: Object.keys(s.guns).length };
      };
      const g0 = await S.ev(guns);
      await S.key("x", 2);
      await S.frames(20);
      const g1 = await S.ev(guns);
      await S.key("x", 2);
      await S.frames(20);
      await h.probe("probe_boss_swap", { input: "tap X (swap gun) twice, 20 frames apart", before: g0, afterOne: g1, afterTwo: await S.ev(guns), scenes: await S.scenes() });
      await S.page.keyboard.down("x");
      await waitFor(S, "WeaponPick", 120);
      await S.frames(20);
      await h.dump("weapon_picker");
      await S.page.keyboard.up("x");
      await S.frames(4);
    },
  },

  // ------------------------------------------------------------------ a side-scrolling (run and gun) room
  {
    id: "side",
    about: "The Crobley factory floor (side view): standing at the start, running right, a jump.",
    states: ["side_room", "probe_side_run", "probe_side_jump"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun()(S);
      await S.ev(() => {
        const k = window.__krel;
        k.setChapter(4);
        // (the first-dungeon tutorial has been seen)
        k.G.meta.tutDungeon = true;
        k.G.saveMeta();
      });
      await go(S, "Dungeon", { dungeon: "crobley_factory", room: 0 });
      await S.frames(40);
      const did = await inRoom(S);
      h.note("side_room", { toGetThere: did });
      await S.frames(60);
      await h.dump("side_room");
      const st0 = await S.ev(dungeonState);
      await S.page.keyboard.down("d");
      const run = await S.sample(30, dungeonMe);
      await S.page.keyboard.up("d");
      const stop = await S.sample(10, dungeonMe);
      await h.probe("probe_side_run", { input: "hold D for 30 frames, release, 10 more frames", before: st0, holdD: run, afterRelease: stop });
      // jump: W (the "Move up / jump" key) held for 4 frames; y for 70 frames (up, over and back down)
      const j0 = await S.ev(dungeonMe);
      await S.page.keyboard.down("w");
      const arc = [];
      for (let i = 0; i < 70; i++) {
        if (i === 4) await S.page.keyboard.up("w");
        await S.frames(1);
        arc.push((await S.ev(dungeonMe))[1]);
      }
      await h.probe("probe_side_jump", { input: "press W (jump) for 4 frames; the player's y for 70 frames", before: j0, y: arc, after: await S.ev(dungeonState) });
    },
  },

  // ------------------------------------------------------------------ indoors
  {
    id: "places",
    about: "The Krezz Arms, the Wonky Pole, the Kreddle strip, the Kreddle Exchange shop, the Krunch Pit board.",
    states: ["pub", "club", "kreddle", "exchange", "pit_board"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun({ prologue_done: true, met_emergency: true })(S);
      await go(S, "Pub");
      await S.frames(120);
      await h.dump("pub");
      await go(S, "Club");
      await S.frames(120);
      await h.dump("club");
      await go(S, "Kreddle");
      await S.frames(40);
      const did = await S.clear(["UI", "Kreddle"]);
      h.note("kreddle", { toGetThere: did });
      await S.frames(90);
      await h.dump("kreddle");
      // the Exchange counter (what the Exchange door opens)
      await S.ev(() => {
        const kd = window.__krel.game.scene.getScene("Kreddle");
        kd.scene.launch("Menu", { mode: "bank", caller: "Kreddle" });
        kd.scene.pause();
      });
      await S.frames(60);
      await h.dump("exchange");
      await go(S, "Pit");
      await S.frames(40);
      const did2 = await S.clear(["UI", "Pit"]);
      h.note("pit_board", { toGetThere: did2 });
      await S.frames(60);
      await h.dump("pit_board");
    },
  },

  // ------------------------------------------------------------------ minigames
  {
    id: "minigames",
    about: "The crocodile rhythm game with notes on the way down, and Beep Beep on the road.",
    states: ["crocodile", "beepbeep"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun({ prologue_done: true, met_emergency: true })(S);
      await go(S, "Minigame", { mode: "crocodile", returnAt: "HOME" });
      await S.frames(60);
      // its introduction is a conversation: Tab skips it
      for (let i = 0; i < 4; i++) {
        const talking = await S.ev(() => {
          const m = window.__krel.game.scene.getScene("Minigame");
          return !!(m.box && m.box.active);
        });
        if (!talking) break;
        await S.key("Tab");
        await S.frames(40);
      }
      // (the song's clock is the music's own; in the harness that is the fake clock too)
      await S.frames(360);
      await h.dump("crocodile");
      await go(S, "BeepBeep", {});
      await S.frames(60);
      for (let i = 0; i < 4; i++) {
        const talking = await S.ev(() => {
          const m = window.__krel.game.scene.getScene("BeepBeep");
          return !!(m.box && m.box.active);
        });
        if (!talking) break;
        await S.key("Tab");
        await S.frames(40);
      }
      await S.frames(180);
      await h.dump("beepbeep");
    },
  },

  // ------------------------------------------------------------------ the finale's brawl
  {
    id: "finale",
    about: "The SSJ brawl in the sky (the finale's fighting-game beat), a few seconds in.",
    states: ["ssj_brawl"],
    async run(h) {
      const { S } = h;
      await S.toTitle();
      await newRun()(S);
      await S.ev(() => window.__krel.setChapter(7));
      await go(S, "Finale", { beat: "brawl" });
      await S.frames(90);
      for (let i = 0; i < 8; i++) {
        const talking = await S.ev(() => {
          const m = window.__krel.game.scene.getScene("Finale");
          return !!(m.box && m.box.active);
        });
        if (!talking) break;
        await S.key("Tab");
        await S.frames(40);
      }
      // past the SUPER SAIYAN BRAWL banner, into the fight
      await S.frames(300);
      await h.dump("ssj_brawl");
    },
  },

  // ------------------------------------------------------------------ the other build (VITE_KREL_ALT=1)
  {
    id: "alt",
    alt: true,
    about: "The ALT build: Enter gate, title, character select, the welcome at home, Krelford, the pause menu.",
    states: ["alt_enter", "alt_title", "alt_charselect", "alt_home_welcome", "alt_home", "alt_hub", "alt_pause"],
    async run(h) {
      const { S } = h;
      await S.frames(90);
      await h.dump("alt_enter");
      await S.toTitle();
      await S.frames(20);
      await h.dump("alt_title");
      await S.clickText("NEW GAME");
      await waitFor(S, "CharSelect");
      await S.frames(40);
      await h.dump("alt_charselect");
      await S.click(92, 140);
      await waitFor(S, "Difficulty");
      await S.frames(40);
      await S.clickText("NEXT: BANTER");
      await waitFor(S, "Banter");
      await S.frames(40);
      await S.clickText("LET'S KREZ");
      await waitFor(S, "Home", 900);
      await S.until(() => window.__krel.game.scene.getScene("Home").busy, null, 400);
      await S.frames(120);
      await h.dump("alt_home_welcome");
      await S.key("Tab");
      await S.frames(60);
      await h.dump("alt_home");
      await S.ev(() => {
        const k = window.__krel;
        Object.assign(k.G.s.flags, { flyover_seen: true, tv_klerble_welcome: true });
        k.G.save();
      });
      await go(S, "Hub", { at: "HOME" });
      await S.frames(120);
      await h.dump("alt_hub");
      await S.key("Escape");
      await S.frames(20);
      await h.dump("alt_pause", { detail: ["Menu", "UI"] });
    },
  },
];

module.exports = { CHAINS };
