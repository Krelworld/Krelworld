// PHONE MODE: the game's long lists as phone lists (lists.ts, research M10), driven from outside (no scene file
// edited): each list's scene method is wrapped once (the game's method runs first, then its list is marked to be
// drawn again and the canvas rows it replaces are hidden), and every frame each list asks "is my list showing?".
// A tap calls the game's own method for that row (play this show, borrow this gun, open this record...).
//
//   TV        the on-demand guide (58 shows): channel tabs 44 px, rows with the channel chip and NEW / ✓ SEEN, the TV log
//   Home      the gun rack (reorder by dragging ⋮⋮, or ▲ ▼, or MAKE IT #1; ammo by the box with − / +), the jukebox
//             (91 tunes, two columns), the Kreltality trophies (when there are more than fit)
//   PitLoan   the loaner rack (19 guns, the perks): a tap picks, BORROW / HAND BACK does it
//   Archive   the records (tap one to read it)
//   Menu      QUESTS (its three tabs) and the DIALOGUE LOG (newest at the bottom)
//   ChapterSelect / DebugSkip   chapters, side quests, boss fights: a tap picks, START ▸ goes (it replaces your save)
//   shops     every ShopGrid (the Kreddle Exchange, the Prize Counter, Home Furnishings): shops.ts
//
// A list that already fits stays as the game draws it. Phones only.
import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { hexStr } from "../ui/theme";
import { dialogueLog } from "../ui/dialogueLog";
import { GUNS } from "../combat/Guns";
import { ammoQuote, buyAmmo, firstLoaded, gunModList, gunRatings, gunUpgrades, modSummary, moddedGun, moveGun, orderedGuns, specialText, STAT_KEYS, STAT_LABELS } from "../systems/armoury";
import { JUKEBOX } from "../../content/jukebox";
import { KREL_TROPHIES } from "../../content/home";
import { RUIN_AMMO_MULT } from "../scenes/home/ruinedHome";
import { STORY_EPISODES } from "../../content/television/channels";
import { TVScene } from "../scenes/TVScene";
import { HomeScene } from "../scenes/HomeScene";
import { PitLoanScene } from "../scenes/PitLoanScene";
import { ArchiveScene } from "../scenes/ArchiveScene";
import { MenuScene } from "../scenes/MenuScene";
import { DebugScene } from "../scenes/DebugScene";
import { PhoneList, type PListSpec, type PRow } from "./lists";
import { capPurse, maxBoxes, needsList, stepQty } from "./listLogic";
import { touchWording } from "./wording";

type Bag = Record<string, any>;

/** Scenes that draw over another scene (a list under one of them hides). */
const OVER = ["Menu", "Slots", "Dialogue", "WeaponPick", "KrelCue", "PitLoan"];

/** The scene if it is running (active, not asleep), else null. */
export function liveScene(game: Phaser.Game, key: string): Bag | null {
  try {
    const m = game.scene;
    if (!m.isActive(key)) return null;
    return m.getScene(key) as unknown as Bag;
  } catch {
    return null;
  }
}

/** True when another scene is drawn over `key` (the pause menu over Home, the save slots over the pause menu). */
export function covered(game: Phaser.Game, key: string): boolean {
  const m = game.scene;
  let at = -1;
  try {
    at = m.getIndex(key);
  } catch {
    return false;
  }
  for (const k of OVER) {
    if (k === key) continue;
    try {
      if (m.isActive(k) && m.getIndex(k) > at) return true;
    } catch {
      /* no such scene */
    }
  }
  return false;
}

/** Hide a canvas object the phone list replaces (and stop it taking taps). */
function hideObj(o: Bag | null | undefined) {
  if (!o) return;
  o.setVisible?.(false);
  if (o.input) o.disableInteractive?.();
  if (o.type === "Container") for (const c of o.list as Bag[]) hideObj(c);
}

/** Wrap a prototype method once: the game's method runs first, then `after`. */
function wrap(proto: Bag, name: string, after: (self: Bag, args: unknown[], ret: unknown) => void) {
  const inner = proto[name];
  if (typeof inner !== "function" || inner.__mfList) return;
  const w = function (this: Bag, ...args: unknown[]) {
    const r = inner.apply(this, args);
    try {
      after(this, args, r);
    } catch (e) {
      console.warn(`phone list (${name})`, e);
    }
    return r;
  };
  (w as Bag).__mfList = true;
  proto[name] = w;
}

/** A list: when it shows (`open`), and what it shows (`build`). */
interface Adapter {
  id: string;
  open(game: Phaser.Game): Bag | null;
  build(ctx: Bag, host: PhoneLists): PListSpec | null;
}

/** The phone's lists: one PhoneList per adapter, drawn when their game list is showing. */
export class PhoneLists {
  readonly lists = new Map<string, PhoneList>();
  private dirty = new Set<string>();
  private adapters: Adapter[] = [];
  private n = 0;
  /** The gun rack's phone state (selected gun, boxes of ammo). */
  rack = { sel: null as string | null, qty: 0, qtyFor: "" };

  constructor(
    readonly game: Phaser.Game,
    readonly parent: HTMLElement,
  ) {
    this.adapters = [tvGuide, gunRack, jukebox, trophies, pitLoan, archive, quests, menuLog, chapters];
    for (const a of this.adapters) this.lists.set(a.id, new PhoneList(parent, game, a.id));
    installWraps(this);
  }

  /** Draw this list again on the next frame (its game list changed). */
  touch(id: string) {
    this.dirty.add(id);
  }

  /** The list showing now, if any (for Back and the tests). */
  openList(): PhoneList | null {
    for (const l of this.lists.values()) if (l.isOpen) return l;
    return null;
  }

  /** Every frame: which lists show, drawn again only when changed (and re-checked twice a second). */
  frame() {
    this.n++;
    const check = this.n % 30 === 0;
    for (const a of this.adapters) {
      const list = this.lists.get(a.id)!;
      let ctx: Bag | null = null;
      try {
        ctx = a.open(this.game);
      } catch {
        ctx = null;
      }
      if (!ctx) {
        list.hide();
        this.dirty.delete(a.id);
        continue;
      }
      if (!list.isOpen || this.dirty.has(a.id) || check) {
        this.dirty.delete(a.id);
        let spec: PListSpec | null = null;
        try {
          spec = a.build(ctx, this);
        } catch (e) {
          console.warn(`phone list ${a.id}`, e);
        }
        if (spec) list.show(spec);
        else list.hide();
      } else list.place();
    }
  }

  /** Close every list (the page is hidden, a scene changed under it). */
  hideAll() {
    for (const l of this.lists.values()) l.hide();
  }
}

// ------------------------------------------------------------------ the TV's on-demand guide

/** The guide's channel codes and colours, read off the tabs the game just drew (channel → [code, colour]). */
function readChannels(sc: Bag) {
  const ui = (sc.ui?.list as Bag[]) ?? [];
  const tabs = ui.filter((o) => o.type === "Rectangle" && o.input && Math.abs(o.y - 106) < 1 && o.originX === 0);
  const labels = ui.filter((o) => o.type === "Text" && Math.abs(o.y - 117) < 1 && o.originX === 0.5);
  const map: Record<string, { code: string; color: string }> = sc.__mfChan ?? {};
  (sc.guideTabs as string[]).forEach((tab, i) => {
    const r = tabs[i];
    const t = labels[i];
    if (r && t) map[tab] = { code: t.text, color: hexStr(r.strokeColor ?? 0x64748b) };
  });
  sc.__mfChan = map;
  // (the TV log line at the foot of the guide: "📺 Seen 6 of 58 · ...")
  const note = ui.find((o) => o.type === "Text" && typeof o.text === "string" && o.text.startsWith("📺 ") && o.y > 400);
  sc.__mfNote = note?.text ?? "";
}

const tvGuide: Adapter = {
  id: "tv",
  open(game) {
    const sc = liveScene(game, "TV");
    if (!sc || sc.mode !== "episodes" || covered(game, "TV")) return null;
    // (seven rows fit the telly's screen: a short guide stays as it is)
    if (!needsList((sc.guideList as unknown[])?.length ?? 0, 7) && (sc.guideTabs as unknown[])?.length <= 1) return null;
    return sc;
  },
  build(sc) {
    const list = (sc.guideList as Bag[]) ?? [];
    const watched: string[] = sc.watchedList?.() ?? [];
    const chan = (sc.__mfChan as Record<string, { code: string; color: string }>) ?? {};
    const rows: PRow[] = list.map((e, i) => {
      const story = STORY_EPISODES.has(e.id);
      const seen = watched.includes(e.id);
      return {
        id: e.id,
        label: e.title,
        sub: e.show,
        chip: story ? { text: "STORY", bg: "#ffffff", fg: "#7a5a00" } : { text: chan[e.channel]?.code ?? String(e.channel).slice(0, 4).toUpperCase(), bg: chan[e.channel]?.color ?? "#64748b" },
        badge: seen ? { text: "✓ SEEN", bg: "transparent", fg: "#4ade80" } : { text: sc.fromTitle ? "NEW" : "🎁 NEW", bg: "#ffd23f" },
        selected: i === sc.guideSel,
        onTap: () => {
          sc.guideSel = i;
          synth.play("select");
          sc.play(e);
        },
      };
    });
    const tabs = ((sc.guideTabs as string[]) ?? []).map((tab) => ({
      label: tab === "ALL" ? "ALL" : chan[tab]?.code ?? tab,
      on: tab === sc.guideTab,
      color: tab === "ALL" ? "#ffd23f" : chan[tab]?.color ?? "#7fb3ff",
      fn: () => sc.setGuideTab(tab),
    }));
    return {
      id: "tv",
      memo: sc.guideTab,
      rect: { x: 8, y: 6, w: 846, h: 528 },
      title: `📺 KRELTV ON DEMAND${sc.guideTab === "ALL" ? "" : ` · ${sc.guideTab}`}`,
      head: [{ label: "📺 WHATEVER'S ON", id: "surf", fn: () => (synth.play("select"), sc.surf()) }],
      tabs,
      rows,
      note: sc.__mfNote || undefined,
      empty: "Nothing on this channel yet.",
      accent: "#7fb3ff",
    };
  },
};

// ------------------------------------------------------------------ Home: the gun rack, the jukebox, the trophies

/** Home's open panel (recorded by the wrapped panel()), if it is the one titled `title` and still up. */
function homePanel(game: Phaser.Game, title: string): Bag | null {
  const h = liveScene(game, "Home");
  if (!h || covered(game, "Home")) return null;
  const p = h.__mfPanel as Bag | undefined;
  if (!p || p.title !== title || !p.root?.active) return null;
  return h;
}

const RACK_RECT = { x: 34, y: 66, w: 892, h: 442 };

const gunRack: Adapter = {
  id: "rack",
  open(game) {
    const h = homePanel(game, "THE GUN RACK");
    // (one gun or none: nothing to order, the game's own panel stays)
    if (!h || orderedGuns(G.s).length < 2) return null;
    return h;
  },
  build(h, host) {
    const s = G.s;
    const order = orderedGuns(s);
    const st = host.rack;
    if (!st.sel || !order.includes(st.sel)) st.sel = (h.__mfPanel?.sel as string) ?? order[0];
    if (!order.includes(st.sel!)) st.sel = order[0];
    const sel = st.sel!;
    const mult = h.ruined ? RUIN_AMMO_MULT : 1;
    const redraw = () => host.touch("rack");
    const reorder = (id: string, to: number) => {
      moveGun(s, id, Math.max(0, Math.min(order.length - 1, to)));
      // (what you're carrying follows the rack: the top gun that has ammo; the game's own rule)
      s.gun = firstLoaded(s) ?? undefined;
      G.save();
      synth.play("pickup");
      st.sel = id;
      redraw();
    };
    const rows: PRow[] = order.map((id, i) => {
      const g = GUNS[id];
      const have = s.guns?.[id] ?? 0;
      const q = ammoQuote(s, id, mult);
      const empty = have <= 0;
      return {
        id,
        label: `${i + 1}. ${g.name}`,
        sub: g.blurb,
        icon: g.tex,
        right: g.maxAmmo >= 9999 ? "∞" : empty ? "EMPTY" : `${have}/${q.max}${id === s.gun ? " · IN HAND" : ""}`,
        rightColor: empty ? "#ef4444" : id === s.gun ? "#67e8f9" : "#facc15",
        selected: id === sel,
        grip: true,
        onTap: () => {
          if (st.sel === id) return;
          st.sel = id;
          synth.play("select");
          redraw();
        },
        actions: [
          { label: "▲", id: `up-${id}`, disabled: i === 0, fn: () => reorder(id, i - 1) },
          { label: "▼", id: `down-${id}`, disabled: i === order.length - 1, fn: () => reorder(id, i + 1) },
        ],
      };
    });
    rows.push({ id: "fart", label: `${order.length + 1}. 💨 Fart Blaster`, sub: "Always last. Infinite ammo.", dim: true });
    // the picked gun: its stats, mods, ammo (by the box), MAKE IT #1, perks
    const g = GUNS[sel];
    const pos = order.indexOf(sel);
    const mg = moddedGun(g, s);
    const r = gunRatings(mg);
    const stars = STAT_KEYS.map((k) => `${STAT_LABELS[k].padEnd(9, " ")} ${"●".repeat(r[k])}${"○".repeat(Math.max(0, 5 - r[k]))}`).join("\n");
    const mods = gunModList(s, sel);
    const modHave = mods.reduce((a, m) => a + m.lvl, 0);
    const modMax = mods.reduce((a, m) => a + m.max, 0);
    const up = gunUpgrades(s);
    const q = ammoQuote(s, sel, mult);
    const can = maxBoxes(s.coins, q.unit, q.boxes);
    if (st.qtyFor !== `${sel}|${q.boxes}|${s.coins}`) {
      st.qtyFor = `${sel}|${q.boxes}|${s.coins}`;
      st.qty = can;
    }
    st.qty = Math.max(can ? 1 : 0, Math.min(can, st.qty));
    const n = st.qty;
    const buyLabel = q.full ? "AMMO FULL" : !can ? `SKINT: A BOX IS ${q.unit}🪙` : `BUY ${n} BOX${n === 1 ? "" : "ES"} · ${n * q.unit}🪙`;
    return {
      id: "rack",
      rect: RACK_RECT,
      title: `🪙 ${s.coins} Krezzcoin · #1 is what you start a dungeon with`,
      rows,
      onReorder: (id, to) => reorder(id, to),
      note: touchWording(`Drag ⋮⋮ or use ▲▼ to set your order.${h.ruined ? " No shops left: ammo's HALF PRICE." : ""}`),
      accent: "#67e8f9",
      detail: {
        actionsFirst: true,
        icon: g.tex,
        title: g.name,
        text: `Ammo ${s.guns?.[sel] ?? 0}/${q.max} · #${pos + 1} in your order\n${g.blurb}\n\n${stars}\n${specialText(mg)}\n\nGUN MODS ${modHave}/${modMax}: ${modSummary(s, sel) || "none yet"}\nALL GUNS: ${up.applied.length ? up.applied.map((a) => a.u.name).join(", ") : "none yet"}`,
        qty: q.full || can <= 1 ? undefined : { n, max: can, label: `${n} box${n === 1 ? "" : "es"} (${g.pickup * n} rounds)`, set: (v) => ((st.qty = stepQty(n, v > n ? 1 : -1, can)), redraw()) },
        buy: {
          label: buyLabel,
          id: "rack-buy",
          kind: q.full || !can ? "plain" : "go",
          disabled: q.full || !can,
          fn: () => {
            // exactly n boxes, with the game's own purchase (it buys while the money lasts: for this purchase the
            // purse holds n boxes' worth, and the rest is put straight back)
            const { purse, aside } = capPurse(s.coins, q.unit, n);
            s.coins = purse;
            let got = 0;
            try {
              got = buyAmmo(s, sel, mult);
            } finally {
              s.coins += aside;
            }
            if (!got) return void host.lists.get("rack")?.deny();
            synth.play("coin");
            G.save();
            host.lists.get("rack")?.flash(`+${got * g.pickup}`);
            redraw();
          },
        },
        more: [
          { label: pos === 0 ? "★ #1: YOU START WITH IT" : "★ MAKE IT #1", id: "rack-top", disabled: pos === 0, fn: () => reorder(sel, 0) },
          {
            label: "🩸 KREDDLE PERKS & GORE MODE",
            id: "rack-perks",
            fn: () => {
              h.__mfPanel?.close?.();
              h.armouryPanel?.(sel);
            },
          },
        ],
      },
    };
  },
};

const jukebox: Adapter = {
  id: "jukebox",
  open(game) {
    return homePanel(game, "THE JUKEBOX");
  },
  build(h) {
    const heard = new Set(G.meta.heardMusic ?? []);
    const cur = synth.currentMusic();
    const got = JUKEBOX.filter((t) => heard.has(t.ids[0])).length;
    const rows: PRow[] = JUKEBOX.map((t) => {
      const has = heard.has(t.ids[0]);
      const playing = !!cur && t.ids.includes(cur);
      return {
        id: t.ids[0],
        label: has ? `${t.sanmik ? "🎤 " : "♪ "}${t.title}` : "? ? ?",
        sub: has ? t.where : undefined,
        color: has ? (t.sanmik ? "#ff9ad5" : "#ffffff") : "#5b5670",
        selected: playing,
        disabled: !has,
        dim: !has,
        onTap: has ? () => (synth.musicRaw(t.ids[0], true), void 0) : undefined,
      };
    });
    const pool = JUKEBOX.filter((t) => heard.has(t.ids[0]));
    const nowT = cur ? JUKEBOX.find((t) => t.ids.includes(cur)) : undefined;
    void h;
    return {
      id: "jukebox",
      rect: RACK_RECT,
      title: `${got} of ${JUKEBOX.length} tunes`,
      head: [
        { label: "STOP", id: "juke-stop", fn: () => synth.music("home", true) },
        ...(pool.length ? [{ label: "SHUFFLE", id: "juke-shuffle", fn: () => synth.musicRaw(pool[Math.floor(Math.random() * pool.length)].ids[0], true) }] : []),
      ],
      rows,
      cols: 2,
      note: nowT ? `NOW PLAYING: ${nowT.title} · ${nowT.where}` : "Hear new music out in Krelworld and it goes on here.",
      accent: "#ff6fa8",
    };
  },
};

const trophies: Adapter = {
  id: "trophies",
  open(game) {
    const h = homePanel(game, "THE TROPHY SHELF");
    if (!h) return null;
    const got = Object.keys(KREL_TROPHIES).filter((b) => G.s.flags[`krel_${b}`]);
    // (about seven lines fit under the crystals)
    return needsList(got.length, 7) ? h : null;
  },
  build() {
    const got = Object.keys(KREL_TROPHIES).filter((b) => G.s.flags[`krel_${b}`]);
    return {
      id: "trophies",
      rect: { x: 60, y: 258, w: 840, h: 250 },
      title: `KRELTALITY TROPHIES (${got.length})`,
      rows: got.map((b) => ({ id: b, label: `🩸 ${KREL_TROPHIES[b]}`, text: true, color: "#fecaca" })),
      accent: "#ef4444",
      glass: true,
    };
  },
};

// ------------------------------------------------------------------ the Krunch Pit's loaner rack

const pitLoan: Adapter = {
  id: "pitloan",
  open(game) {
    const sc = liveScene(game, "PitLoan");
    if (!sc || covered(game, "PitLoan")) return null;
    return sc;
  },
  build(sc) {
    const items = (sc.items?.() as Bag[]) ?? [];
    const rows: PRow[] = items.map((it, i) => {
      const st = sc.status(it) as { mine: number; now: number };
      const loaned = it.kind === "gun" ? st.now > 0 && !st.mine : st.now > st.mine;
      const owned = it.kind === "gun" ? st.mine > 0 : st.mine >= it.max;
      const col = loaned ? "#facc15" : owned ? "#86efac" : "#ffffff";
      const tag = it.kind === "gun" ? (owned ? "YOURS" : loaned ? "ON LOAN" : "") : loaned ? `ON LOAN (LV ${st.now})` : owned ? "YOURS (MAXED)" : st.mine ? `YOURS LV ${st.mine}/${it.max}` : "";
      const verb = loaned ? "HAND BACK" : it.kind === "gun" ? (owned ? "IN HAND" : "BORROW") : owned ? "" : st.mine ? "BORROW MAX" : "BORROW";
      const go = () => {
        sc.sel = i;
        sc.toggle();
      };
      return {
        id: `${it.kind}-${it.id}`,
        label: String(it.name).toUpperCase(),
        sub: it.desc,
        icon: it.icon,
        color: col,
        right: tag || undefined,
        rightColor: col,
        selected: i === sc.sel,
        onTap: () => {
          if (sc.sel === i) return;
          sc.sel = i;
          synth.play("select");
          sc.render();
        },
        actions: verb ? [{ label: verb, id: `loan-${it.id}`, kind: loaned ? "warn" : "go", fn: go }] : undefined,
      };
    });
    return {
      id: "pitloan",
      memo: sc.tab,
      rect: { x: 120, y: 74, w: 720, h: 460 },
      title: "THE LOANER RACK",
      tabs: (["gun", "perk"] as const).map((t) => ({ label: t === "gun" ? "GUNS" : "PERKS", on: sc.tab === t, color: "#67e8f9", fn: () => sc.setTab(t) })),
      rows,
      foot: [{ label: "DONE", id: "loan-done", kind: "warn", fn: () => sc.close() }],
      note: "Tap one to see it. It all goes back when you leave the range.",
      accent: "#67e8f9",
    };
  },
};

// ------------------------------------------------------------------ the Historical Archive

const archive: Adapter = {
  id: "archive",
  open(game) {
    const sc = liveScene(game, "Archive");
    if (!sc || sc.playing || covered(game, "Archive")) return null;
    return needsList((sc.entries?.() as unknown[])?.length ?? 0, 13) ? sc : null;
  },
  build(sc) {
    const ents = (sc.entries() as Bag[]) ?? [];
    const un: string[] = sc.unlockedIds();
    const rows: PRow[] = ents.map((e) => {
      const ok = un.includes(e.id) || sc.filter === "ban";
      return {
        id: e.id,
        label: ok ? `${e.era === "FGM_ULTRA" ? "◆" : e.era === "PRESENT" ? "●" : "■"} ${e.title}` : "■ ??? (not yet recovered)",
        color: ok ? "#f5ecd0" : "#5a5040",
        disabled: !ok,
        selected: sc.__mfSel === e.id,
        onTap: ok ? () => sc.showEntry(e) : undefined,
      };
    });
    return {
      id: "archive",
      rect: { x: 12, y: 62, w: 340, h: 440 },
      title: `${ents.filter((e) => un.includes(e.id)).length}/${ents.length} records`,
      rows,
      accent: "#c8b88a",
    };
  },
};

// ------------------------------------------------------------------ the pause menu's QUESTS and DIALOGUE LOG

const MENU_RECT = { x: 146, y: 84, w: 668, h: 354 };

/** The Menu scene showing `mode`, with nothing over it. */
function menuOn(game: Phaser.Game, mode: string): Bag | null {
  const m = liveScene(game, "Menu");
  if (!m || m.mode !== mode || covered(game, "Menu")) return null;
  return m;
}

const quests: Adapter = {
  id: "quests",
  open(game) {
    const m = menuOn(game, "quests");
    return m && m.__mfQuest ? m : null;
  },
  build(m) {
    const lines = (m.__mfQuest as { t: string; c: string; b: boolean }[]) ?? [];
    const rows: PRow[] = lines.map((l, i) => (l.b ? { id: `q${i}`, label: touchWording(l.t), heading: true, color: l.c } : { id: `q${i}`, label: touchWording(l.t), text: true, color: l.c }));
    const tabs = ["STORY", "SIDE QUESTS", "FACTS & STATS"].map((t, i) => ({
      label: t,
      on: m.questTab === i,
      fn: () => {
        m.questTab = i;
        m.questScroll = 0;
        m.render("quests");
      },
    }));
    return { id: "quests", memo: String(m.questTab), rect: MENU_RECT, tabs, rows, start: "top", accent: "#a78bfa" };
  },
};

const menuLog: Adapter = {
  id: "log",
  open(game) {
    const m = menuOn(game, "log");
    // (a few lines fit the page as it is)
    return m && needsList(dialogueLog().length, 4) ? m : null;
  },
  build() {
    const all = dialogueLog();
    const rows: PRow[] = all.map((e, i) => ({ id: `l${i}`, label: e.text, text: true, who: e.dir ? undefined : e.who, whoColor: e.color !== undefined ? hexStr(e.color) : "#ffd23f", italic: !!e.dir }));
    return { id: "log", memo: String(all.length), rect: MENU_RECT, title: "Newest at the bottom", rows, start: "bottom", accent: "#ffd23f" };
  },
};

// ------------------------------------------------------------------ Chapter Select (and the debug menu, the same scene)

const chapters: Adapter = {
  id: "chapters",
  open(game) {
    for (const k of ["ChapterSelect", "DebugSkip"]) {
      const sc = liveScene(game, k);
      if (sc && Array.isArray(sc.navs) && sc.navs.length) return sc;
    }
    return null;
  },
  build(sc) {
    const navs = sc.navs as { c: Bag; fn: () => void }[];
    const label = (n: { c: Bag }) => touchWording(String(n.c.label?.text ?? "")).replace(/\s*\((?:C|V|tap to change)\)\s*$/, "");
    const back = navs.find((n) => /BACK/.test(n.c.label?.text ?? "") && n.c.y > 480);
    const toggles = navs.filter((n) => Math.abs(n.c.y - 78) < 2);
    const picked = sc.__mfPick as string | undefined;
    const pickRow = (n: { c: Bag; fn: () => void }, id: string, text: string, color?: string): PRow => ({
      id,
      label: text,
      color,
      selected: picked === id,
      onTap: () => {
        sc.__mfPick = picked === id ? undefined : id;
        synth.play("select");
        host.touch("chapters");
      },
      // (it replaces your save: a tap picks, START goes)
      actions: picked === id ? [{ label: "START ▸", id: "chapter-go", kind: "go", fn: n.fn }] : undefined,
    });
    const host = sc.__mfHost as PhoneLists;
    const rows: PRow[] = [];
    if (sc.page === "bosses") {
      rows.push({ id: "hb", label: "BOSS FIGHTS", heading: true });
      navs.filter((n) => n !== back && !toggles.includes(n)).forEach((n, i) => rows.push(pickRow(n, `b${i}`, label(n))));
    } else {
      const chs = navs.filter((n) => n !== back && !toggles.includes(n) && Math.abs(n.c.x - 150) < 2);
      const arcs = navs.filter((n) => n !== back && !toggles.includes(n) && n.c.x > 400);
      rows.push({ id: "hc", label: "CHAPTERS", heading: true });
      chs.forEach((n, i) => {
        const t = label(n);
        // (BOSS FIGHTS opens its own page: no START needed)
        if (/BOSS FIGHTS/.test(t)) rows.push({ id: "bosses", label: t, color: "#fca5a5", onTap: n.fn });
        else rows.push(pickRow(n, `c${i}`, t));
      });
      rows.push({ id: "ha", label: "SIDE QUESTS (goes straight to the quest)", heading: true });
      arcs.forEach((n, i) => rows.push(pickRow(n, `a${i}`, label(n))));
    }
    const foot = (sc.children?.list as Bag[] | undefined)?.find((o) => o.type === "Text" && Math.abs(o.y - 516) < 2 && o.originX === 0.5);
    return {
      id: "chapters",
      memo: sc.page,
      rect: { x: 8, y: 60, w: 944, h: 474 },
      back: back ? { label: "◀ BACK", id: "chapters-back", fn: back.fn } : undefined,
      head: toggles.map((n, i) => ({ label: label(n), id: `chapters-t${i}`, fn: n.fn })),
      rows,
      cols: 2,
      start: "top",
      note: foot?.text,
      accent: "#ffd23f",
    };
  },
};

// ------------------------------------------------------------------ the wraps (once)

let wrapped = false;

function installWraps(host: PhoneLists) {
  if (wrapped) return;
  wrapped = true;
  // TV: the guide's canvas rows give way to the phone list (when it shows)
  wrap(TVScene.prototype as unknown as Bag, "drawGuide", (sc) => {
    readChannels(sc);
    host.touch("tv");
    if (!tvGuide.open(host.game)) return;
    for (const o of (sc.ui?.list as Bag[]) ?? []) hideObj(o);
  });
  // Home: remember the open panel (its title, close) so the lists know which one is up
  wrap(HomeScene.prototype as unknown as Bag, "panel", (h, args, ret) => {
    h.__mfPanel = { ...(ret as Bag), title: String(args[0] ?? "") };
  });
  wrap(HomeScene.prototype as unknown as Bag, "gunRackPanel", (h, args) => {
    if (h.__mfPanel) h.__mfPanel.sel = args[0];
    host.rack.sel = (args[0] as string) ?? host.rack.sel;
    host.touch("rack");
    if (!gunRack.open(host.game)) return;
    // the canvas list, its instructions and the detail panel are under the phone card
    for (const o of (h.__mfPanel?.root?.list as Bag[]) ?? []) if (o.type === "Container" || (o.type === "Text" && o.y > 60 && o.y < 520 && !/^THE GUN RACK$/.test(o.text))) hideObj(o);
  });
  wrap(HomeScene.prototype as unknown as Bag, "jukeboxPanel", (h) => {
    host.touch("jukebox");
    // (not the panel's own background)
    for (const o of (h.__mfPanel?.root?.list as Bag[]) ?? []) if (o.y > 70 && o.y < 520 && o.type !== "NineSlice" && !(o.width >= 880)) hideObj(o);
  });
  wrap(HomeScene.prototype as unknown as Bag, "trophyPanel", (h) => {
    host.touch("trophies");
    if (!trophies.open(host.game)) return;
    for (const o of (h.__mfPanel?.root?.list as Bag[]) ?? []) if (o.type === "Text" && o.y >= 260 && o.y < 520) hideObj(o);
  });
  // the loaner rack: its rows, ▲ / ▼ more, DONE and the key line give way
  wrap(PitLoanScene.prototype as unknown as Bag, "render", (sc) => {
    host.touch("pitloan");
    for (const o of (sc.root?.list as Bag[]) ?? []) if (o.y > 74) hideObj(o);
  });
  // the archive: the record list and its page buttons give way; the record you open stays the game's
  wrap(ArchiveScene.prototype as unknown as Bag, "renderList", (sc) => {
    host.touch("archive");
    if (!archive.open(host.game)) return;
    for (const o of (sc.listC?.list as Bag[]) ?? []) hideObj(o);
  });
  wrap(ArchiveScene.prototype as unknown as Bag, "showEntry", (sc, args) => {
    sc.__mfSel = (args[0] as Bag)?.id;
    host.touch("archive");
  });
  // the pause menu's pages
  wrap(MenuScene.prototype as unknown as Bag, "render", (m) => {
    const root = m.root as Bag;
    if (m.mode === "quests") {
      // the lines the page drew (in a masked, scrolling container), as they are
      const box = (root.list as Bag[]).find((o) => o.type === "Container" && o.mask);
      m.__mfQuest = box ? (box.list as Bag[]).filter((t) => t.type === "Text").map((t) => ({ t: t.text as string, c: (t.style?.color as string) ?? "#ffffff", b: t.style?.fontStyle === "bold" })) : null;
      host.touch("quests");
      if (box) {
        hideObj(box);
        for (const o of root.list as Bag[]) if ((o.type === "Container" && o.label && /^(▲ UP|DOWN ▼|STORY|SIDE QUESTS|FACTS & STATS)$/.test(o.label.text)) || o === box) hideObj(o);
      }
    } else if (m.mode === "log") {
      host.touch("log");
      if (!menuLog.open(host.game)) return;
      for (const o of root.list as Bag[]) {
        if (o.type === "Text" && o.y > 84 && o.y < 450) hideObj(o);
        if (o.type === "Container" && o.label && /^(▲ OLDER|NEWER ▼)$/.test(o.label.text)) hideObj(o);
      }
    }
  });
  // chapter select: its buttons give way to the phone list
  const onDraw = (sc: Bag) => {
    sc.__mfHost = host;
    sc.__mfPick = undefined;
    host.touch("chapters");
    for (const n of (sc.navs as { c: Bag }[]) ?? []) hideObj(n.c);
    for (const o of (sc.children?.list as Bag[]) ?? []) if (o.type === "Text" && o.y > 90) hideObj(o);
  };
  wrap(DebugScene.prototype as unknown as Bag, "draw", onDraw);
  wrap(DebugScene.prototype as unknown as Bag, "drawBosses", onDraw);
}
