// Desktop fingerprint: what gets written down for one game state. `pageDump` runs inside the page.
//
// To keep the files small and the diffs readable, a game object's line leaves out anything at its default:
//   o (origin) 0.5,0.5 · s (scale) 1,1 · rot 0 · d (depth) 0 · a (alpha) 1 · sf (scroll factor) 1,1 · no tint · no flip
// Only objects that are visible (themselves and every container above them) get a line; the hidden ones are counted
// per scene in `count`, so an object added to the laptop's display list shows up either way.

function pageDump(opts) {
  const fp = window.__fp;
  // `detail`: only these scenes get their objects listed line by line; the rest (say, the town standing paused
  // under a menu, already listed in full by another state) are boiled down to a count and a hash of the same lines
  const detail = opts && opts.detail ? new Set(opts.detail) : null;
  const k = window.__krel;
  const g = k.game;
  const r2 = (v) => (typeof v === "number" ? (Number.isFinite(v) ? Math.round(v * 100) / 100 : String(v)) : v);
  const r3 = (v) => (typeof v === "number" ? (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : String(v)) : v);
  const hex = (n) => "#" + (n >>> 0).toString(16).padStart(6, "0");
  const hash = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const counts = (em) => {
    const out = {};
    if (!em || !em.eventNames) return out;
    for (const n of em.eventNames().map(String).sort()) out[n] = em.listenerCount(n);
    return out;
  };

  // ------------------------------------------------------------ one game object
  const FONT_NAMES = { '"Krel Regular", "Trebuchet MS", sans-serif': "Krel Regular", '"Krel Bold", "Trebuchet MS", sans-serif': "Krel Bold" };
  const hitArea = (o) => {
    const inp = o.input;
    if (!inp) return undefined;
    const ha = inp.hitArea;
    const out = {};
    if (!inp.enabled) out.off = true;
    if (ha) {
      const C = (ha.constructor && ha.constructor.name) || "";
      if (ha.radius !== undefined && ha.width === undefined) Object.assign(out, { shape: "circle", x: r2(ha.x), y: r2(ha.y), r: r2(ha.radius) });
      else if (ha.points) Object.assign(out, { shape: "polygon", pts: ha.points.map((p) => [r2(p.x), r2(p.y)]) });
      else if (ha.x1 !== undefined) Object.assign(out, { shape: "triangle", pts: [[r2(ha.x1), r2(ha.y1)], [r2(ha.x2), r2(ha.y2)], [r2(ha.x3), r2(ha.y3)]] });
      else if (ha.width !== undefined) Object.assign(out, { shape: /Ellipse/.test(C) ? "ellipse" : "rect", x: r2(ha.x), y: r2(ha.y), w: r2(ha.width), h: r2(ha.height) });
      else out.shape = "custom";
    }
    if (inp.cursor) out.cursor = inp.cursor;
    if (inp.draggable) out.drag = true;
    if (inp.dropZone) out.drop = true;
    if (inp.alwaysEnabled) out.always = true;
    return out;
  };
  const SHAPES = new Set(["Rectangle", "Arc", "Ellipse", "Triangle", "Star", "Line", "Polygon", "Curve", "Grid", "IsoBox", "IsoTriangle"]);
  const one = (o) => {
    const e = { t: o.type || (o.constructor && o.constructor.name) || "?" };
    // (the bundler renames Phaser's own classes "Text2", "Image3"...: only a class of the game's own is worth a note)
    const cls = ((o.constructor && o.constructor.name) || "").replace(/\d+$/, "");
    if (cls && cls !== e.t && cls.length > 2) e.cls = cls;
    if (o.name) e.name = String(o.name);
    if (typeof o.x === "number") {
      e.x = r2(o.x);
      e.y = r2(o.y);
    }
    if (typeof o.displayWidth === "number") {
      e.w = r2(o.displayWidth);
      e.h = r2(o.displayHeight);
    } else if (typeof o.width === "number") {
      e.w = r2(o.width);
      e.h = r2(o.height);
    }
    if (typeof o.originX === "number" && (o.originX !== 0.5 || o.originY !== 0.5)) e.o = [r3(o.originX), r3(o.originY)];
    if (typeof o.scaleX === "number" && (o.scaleX !== 1 || o.scaleY !== 1)) e.s = [r3(o.scaleX), r3(o.scaleY)];
    if (o.rotation) e.rot = r3(o.rotation);
    if (o.depth) e.d = r2(o.depth);
    if (typeof o.alpha === "number" && o.alpha !== 1) e.a = r3(o.alpha);
    if (typeof o.scrollFactorX === "number" && (o.scrollFactorX !== 1 || o.scrollFactorY !== 1)) e.sf = [r3(o.scrollFactorX), r3(o.scrollFactorY)];
    if (typeof o.tintTopLeft === "number" && (o.isTinted || o.tintTopLeft !== 0xffffff)) {
      const ts = [o.tintTopLeft, o.tintTopRight, o.tintBottomLeft, o.tintBottomRight];
      e.tint = ts.every((t) => t === ts[0]) ? hex(ts[0]) : ts.map(hex).join(",");
      if (o.tintFill) e.tint += " fill";
    }
    if (o.flipX || o.flipY) e.flip = (o.flipX ? "x" : "") + (o.flipY ? "y" : "");
    if (o.blendMode && !(o.type === "Container" && o.blendMode === -1)) e.blend = o.blendMode;
    if (o.mask) e.mask = true;
    if (o.texture && o.frame && o.type !== "Text" && o.type !== "Graphics") e.tex = o.texture.key + ":" + o.frame.name;
    if (o.anims && o.anims.currentAnim && o.anims.isPlaying) e.anim = o.anims.currentAnim.key;
    if (o.type === "Text") {
      const st = o.style;
      e.text = o.text;
      // family, size, style. The game's two pixel-font stacks are written by their first name (see FONT_NAMES).
      e.font = `${FONT_NAMES[st.fontFamily] || st.fontFamily} ${st.fontSize}${st.fontStyle ? " " + st.fontStyle : ""}`;
      // what the scene asked for before ui/fontPatch.ts swapped in the pixel font
      if (st.__krel) e.asked = `${st.__krel.kind} ${st.__krel.size}px${st.__krel.bold ? " bold" : ""}${st.__krel.rest ? " " + st.__krel.rest : ""}`;
      e.color = String(st.color);
      if (st.strokeThickness) e.stroke = `${st.stroke} ${st.strokeThickness}`;
      if (st.backgroundColor) e.bg = st.backgroundColor;
      if (st.align && st.align !== "left") e.align = st.align;
      if (st.wordWrapWidth) e.wrap = r2(st.wordWrapWidth);
      if (o.lineSpacing) e.lineSpacing = r2(o.lineSpacing);
      if (o.padding && (o.padding.left || o.padding.top || o.padding.right || o.padding.bottom)) e.pad = [o.padding.left, o.padding.top, o.padding.right, o.padding.bottom];
      if (st.shadowOffsetX || st.shadowOffsetY || st.shadowBlur) e.shadow = `${st.shadowOffsetX},${st.shadowOffsetY} ${st.shadowColor} ${st.shadowBlur}`;
    } else if (o.type === "BitmapText" || o.type === "DynamicBitmapText") {
      e.text = o.text;
      e.font = { family: o.font, size: o.fontSize };
    } else if (SHAPES.has(o.type)) {
      if (o.isFilled) e.fill = `${hex(o.fillColor)} ${r3(o.fillAlpha)}`;
      if (o.isStroked) e.line = `${hex(o.strokeColor)} ${r3(o.strokeAlpha)} ${r2(o.lineWidth)}`;
      if (o.type === "Arc") e.r = r2(o.radius);
    } else if (o.type === "Graphics") {
      // what has been drawn into it: how many drawing commands, and a hash of them
      const cb = o.commandBuffer || [];
      e.gfx = { n: cb.length, h: hash(cb.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : String(v))).join(",")) };
    } else if (o.type === "TileSprite") {
      e.tile = [r2(o.tilePositionX), r2(o.tilePositionY)];
    } else if (o.type === "ParticleEmitter") {
      e.particles = typeof o.getAliveParticleCount === "function" ? o.getAliveParticleCount() : 0;
      if (o.emitting === false) e.emitting = false;
    }
    if (o.body && typeof o.body.width === "number") {
      const b = o.body;
      e.body = { w: r2(b.width), h: r2(b.height), ox: r2(b.offset ? b.offset.x : 0), oy: r2(b.offset ? b.offset.y : 0) };
      if (b.isCircle) e.body.circle = true;
      if (b.enable === false) e.body.off = true;
      if (b.immovable) e.body.immovable = true;
      if (b.allowGravity === false) e.body.noGravity = true;
    }
    const hit = hitArea(o);
    if (hit) e.hit = hit;
    return e;
  };

  // ------------------------------------------------------------ one scene
  const STATUS = ["PENDING", "INIT", "START", "LOADING", "CREATING", "RUNNING", "PAUSED", "SLEEPING", "SHUTDOWN", "DESTROYED"];
  const camera = (c) => {
    const out = { x: r2(c.x), y: r2(c.y), w: r2(c.width), h: r2(c.height), scrollX: r2(c.scrollX), scrollY: r2(c.scrollY), zoom: [r3(c.zoomX), r3(c.zoomY)] };
    if (c.rotation) out.rot = r3(c.rotation);
    if (c.alpha !== 1) out.a = r3(c.alpha);
    if (!c.visible) out.hidden = true;
    out.bg = c.backgroundColor ? [c.backgroundColor.red, c.backgroundColor.green, c.backgroundColor.blue, c.backgroundColor.alpha].join(",") : "";
    out.roundPixels = !!c.roundPixels;
    if (c.useBounds) {
      const b = c.getBounds();
      out.bounds = [r2(b.x), r2(b.y), r2(b.width), r2(b.height)];
    }
    if (c._follow) out.follow = { lerp: [r3(c.lerp.x), r3(c.lerp.y)], offset: [r2(c.followOffset.x), r2(c.followOffset.y)], deadzone: c.deadzone ? [r2(c.deadzone.width), r2(c.deadzone.height)] : null };
    const fx = [];
    if (c.fadeEffect && c.fadeEffect.isRunning) fx.push("fade " + r3(c.fadeEffect.progress));
    if (c.flashEffect && c.flashEffect.isRunning) fx.push("flash " + r3(c.flashEffect.progress));
    if (c.shakeEffect && c.shakeEffect.isRunning) fx.push("shake " + r3(c.shakeEffect.progress));
    if (c.zoomEffect && c.zoomEffect.isRunning) fx.push("zoom " + r3(c.zoomEffect.progress));
    if (c.panEffect && c.panEffect.isRunning) fx.push("pan " + r3(c.panEffect.progress));
    if (fx.length) out.fx = fx;
    if (c.postFX && c.postFX.list && c.postFX.list.length) out.postFX = c.postFX.list.length;
    return out;
  };
  const scene = (sc) => {
    const sys = sc.sys;
    const out = { key: sys.settings.key, status: STATUS[sys.settings.status] || String(sys.settings.status) };
    const cnt = { top: sc.children.list.length, all: 0, hidden: 0, interactive: 0 };
    const walk = (o, vis) => {
      cnt.all++;
      const v = vis && o.visible !== false;
      if (!v) cnt.hidden++;
      if (o.input && o.input.enabled) cnt.interactive++;
      let e = null;
      if (v) e = one(o);
      if (o.list && Array.isArray(o.list) && o.type === "Container") {
        const kids = [];
        for (const c of o.list) {
          const ce = walk(c, v);
          if (ce) kids.push(ce);
        }
        if (e) {
          e.n = o.list.length;
          if (kids.length) e.kids = kids;
        }
      }
      return e;
    };
    const objs = [];
    for (const o of sc.children.list) {
      const e = walk(o, true);
      if (e) objs.push(e);
    }
    out.count = cnt;
    const cams = sc.cameras ? sc.cameras.cameras : [];
    out.cam = sc.cameras && sc.cameras.main ? camera(sc.cameras.main) : null;
    if (cams.length !== 1) out.cams = cams.map(camera);
    const inp = sc.input;
    if (inp) {
      out.input = { enabled: !!inp.enabled, topOnly: !!inp.topOnly, listeners: counts(inp) };
      const kb = inp.keyboard;
      if (kb) {
        // `keys`: the key codes this scene has made Key objects for (what it polls)
        const codes = [];
        for (let i = 0; i < kb.keys.length; i++) if (kb.keys[i]) codes.push(i);
        out.input.keyboard = { enabled: !!kb.enabled, keys: codes, listeners: counts(kb) };
      }
    }
    out.timers = sc.time ? sc.time._active.length + sc.time._pendingInsertion.length : 0;
    out.tweens = sc.tweens ? sc.tweens.getTweens().length : 0;
    if (sc.physics && sc.physics.world) {
      const w = sc.physics.world;
      out.physics = { bodies: w.bodies.size, statics: w.staticBodies.size, gravity: [r2(w.gravity.x), r2(w.gravity.y)], fps: w.fps, timeScale: w.timeScale, paused: !!w.isPaused, bounds: [r2(w.bounds.x), r2(w.bounds.y), r2(w.bounds.width), r2(w.bounds.height)] };
    }
    if (detail && !detail.has(out.key)) out.objsHash = `${objs.length} top-level, #${hash(JSON.stringify(objs))}`;
    else out.objs = objs;
    return out;
  };

  // ------------------------------------------------------------ the page
  const rect = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return [r2(b.x), r2(b.y), r2(b.width), r2(b.height)];
  };
  const css = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  const elem = (el) => {
    const out = { tag: el.tagName.toLowerCase() };
    if (el.id) out.id = el.id;
    if (el.className && typeof el.className === "string") out.class = el.className;
    const st = el.getAttribute("style");
    if (st) out.style = st.length > 200 ? st.slice(0, 200) + "… #" + hash(st) : st;
    return out;
  };
  const canvas = g.canvas;
  const SHELL_PROPS = ["display", "position", "overflow", "margin", "padding", "width", "height", "background-color", "touch-action", "user-select", "-webkit-user-select", "overscroll-behavior", "cursor"];
  const dom = {
    window: [window.innerWidth, window.innerHeight],
    dpr: window.devicePixelRatio,
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    htmlAttrs: [...document.documentElement.attributes].map((a) => `${a.name}=${a.value}`),
    bodyAttrs: [...document.body.attributes].map((a) => `${a.name}=${a.value}`),
    head: [...document.head.children].map((el) => el.tagName.toLowerCase() + (el.getAttribute("name") ? `[name=${el.getAttribute("name")}]` : "") + (el.getAttribute("rel") ? `[rel=${el.getAttribute("rel")}]` : "") + (el.id ? `#${el.id}` : "") + (el.tagName === "STYLE" ? ` ${el.textContent.length}ch #${hash(el.textContent)}` : "")),
    viewportMeta: (document.querySelector('meta[name="viewport"]') || { content: "" }).content,
    body: [...document.body.children].map(elem),
    game: { rect: rect(document.getElementById("game")), children: [...(document.getElementById("game") || { children: [] }).children].map(elem) },
    canvas: { rect: rect(canvas), width: canvas.width, height: canvas.height, style: canvas.getAttribute("style") || "", attrs: [...canvas.attributes].map((a) => a.name).sort() },
    css: { html: css(document.documentElement, SHELL_PROPS), body: css(document.body, SHELL_PROPS), game: css(document.getElementById("game"), SHELL_PROPS), canvas: css(canvas, [...SHELL_PROPS, "image-rendering", "margin-left", "margin-top"]) },
    active: document.activeElement ? document.activeElement.tagName.toLowerCase() : null,
    fullscreen: !!document.fullscreenElement,
    pointerLock: document.pointerLockElement ? document.pointerLockElement.tagName.toLowerCase() : null,
    on: { window: Object.keys(window).filter((n) => /^on/.test(n) && typeof window[n] === "function").sort(), document: Object.getOwnPropertyNames(Document.prototype).filter((n) => /^on/.test(n) && typeof document[n] === "function").sort() },
    globals: Object.getOwnPropertyNames(window).filter((n) => !fp.baseGlobals.has(n) && !/^__(fp|pw|playwright)/.test(n) && !/^\d+$/.test(n)).sort(),
  };

  // ------------------------------------------------------------ the game
  const cfg = g.config;
  const sm = g.scale;
  const game = {
    width: cfg.width, height: cfg.height, zoom: cfg.zoom, parent: typeof cfg.parent === "string" ? cfg.parent : cfg.parent && cfg.parent.id,
    scaleMode: cfg.scaleMode, autoCenter: cfg.autoCenter, autoRound: cfg.autoRound, expandParent: cfg.expandParent, fullscreenTarget: cfg.fullscreenTarget ? String(cfg.fullscreenTarget.id || cfg.fullscreenTarget) : null,
    renderType: cfg.renderType, renderer: g.renderer.type, pixelArt: cfg.pixelArt, roundPixels: cfg.roundPixels, antialias: cfg.antialias, antialiasGL: cfg.antialiasGL, transparent: cfg.transparent,
    clearBeforeRender: cfg.clearBeforeRender, preserveDrawingBuffer: cfg.preserveDrawingBuffer, premultipliedAlpha: cfg.premultipliedAlpha, powerPreference: cfg.powerPreference, batchSize: cfg.batchSize, maxLights: cfg.maxLights, mipmapFilter: cfg.mipmapFilter,
    backgroundColor: cfg.backgroundColor ? cfg.backgroundColor.rgba : null,
    fps: cfg.fps ? { min: cfg.fps.min, target: cfg.fps.target, limit: cfg.fps.limit, forceSetTimeOut: cfg.fps.forceSetTimeOut, smoothStep: cfg.fps.smoothStep, deltaHistory: cfg.fps.deltaHistory, panicMax: cfg.fps.panicMax } : null,
    loop: { targetFps: g.loop.targetFps, fpsLimit: g.loop.fpsLimit, smoothStep: g.loop.smoothStep, delta: r3(g.loop.delta), running: g.loop.running },
    input: {
      keyboard: cfg.inputKeyboard, keyboardCapture: cfg.inputKeyboardCapture, mouse: cfg.inputMouse, mousePreventDefaultDown: cfg.inputMousePreventDefaultDown, mousePreventDefaultUp: cfg.inputMousePreventDefaultUp, mousePreventDefaultMove: cfg.inputMousePreventDefaultMove, mousePreventDefaultWheel: cfg.inputMousePreventDefaultWheel,
      touch: cfg.inputTouch, touchCapture: cfg.inputTouchCapture, activePointers: cfg.inputActivePointers, smoothFactor: cfg.inputSmoothFactor, windowEvents: cfg.inputWindowEvents, gamepad: cfg.inputGamepad, disableContextMenu: cfg.disableContextMenu,
      pointers: g.input.pointers.length, touchManager: !!g.input.touch, mouseManager: !!(g.input.mouse && g.input.mouse.enabled), mouseLocked: !!(g.input.mouse && g.input.mouse.locked), defaultCursor: g.input.defaultCursor,
    },
    physics: cfg.physics, audio: cfg.audio,
    device: { desktop: g.device.os.desktop, touch: g.device.input.touch, fullscreen: g.device.fullscreen.available, webGL: g.device.features.webGL },
    scale: { size: [sm.width, sm.height], display: [r2(sm.displaySize.width), r2(sm.displaySize.height)], parent: [r2(sm.parentSize.width), r2(sm.parentSize.height)], displayScale: [r3(sm.displayScale.x), r3(sm.displayScale.y)], orientation: sm.orientation, fullscreen: sm.isFullscreen },
    listeners: { game: counts(g.events), scale: counts(sm), input: counts(g.input.events), textures: counts(g.textures) },
    textures: Object.keys(g.textures.list).length,
    anims: g.anims.anims.size,
  };

  // ------------------------------------------------------------ everything else
  const scenes = g.scene.scenes.map((s) => {
    const st = s.sys.settings.status;
    return { key: s.sys.settings.key, status: STATUS[st] || String(st), active: s.sys.isActive(), visible: s.sys.isVisible() };
  });
  const running = g.scene.scenes.filter((s) => s.sys.settings.status >= 5 && s.sys.settings.status <= 7);
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const raw = localStorage.getItem(key);
    let val = raw;
    try {
      val = JSON.parse(raw);
    } catch (e) {
      /* a plain string */
    }
    storage[key] = val;
  }
  const sortObj = (o) => {
    if (Array.isArray(o)) return o.map(sortObj);
    if (o && typeof o === "object") {
      const out = {};
      for (const kk of Object.keys(o).sort()) out[kk] = sortObj(o[kk]);
      return out;
    }
    return typeof o === "number" ? r3(o) : o;
  };
  const sorted = (o) => {
    const out = {};
    for (const a of Object.keys(o).sort()) {
      out[a] = {};
      for (const b of Object.keys(o[a]).sort()) out[a][b] = o[a][b];
    }
    return out;
  };
  const synth = k.synth;
  return {
    // the fake clock when this was taken: [performance.now(), Date.now()]. Both move 16 ms per stepped frame, so a
    // change here means the state was reached in a different number of frames.
    clock: [Math.round(performance.now() * 1000) / 1000, Date.now()],
    // `live`: the scenes that are running, paused or asleep. `order`: every registered scene, in draw order (the
    // order of the list in main.ts until a scene is brought to the top).
    scenes: { live: scenes.filter((s) => s.status === "RUNNING" || s.status === "PAUSED" || s.status === "SLEEPING" || s.status === "CREATING" || s.status === "LOADING").map((s) => `${s.key} ${s.status}${s.active ? " active" : ""}${s.visible ? " visible" : ""}`), order: scenes.map((s) => s.key) },
    display: running.map(scene),
    game,
    dom,
    listeners: { added: sorted(fp.listeners.add), removed: sorted(fp.listeners.remove) },
    storage: { written: Object.keys(fp.storage.set).sort(), removed: Object.keys(fp.storage.remove).sort(), now: sortObj(storage) },
    audio: { contexts: fp.audio.contexts, elements: fp.audio.created.map((el) => { const s = fp.audio.state(el); return `${s.src}${s.playing ? " playing" : " paused"}${el.loop ? " loop" : ""} vol ${Math.round(el.volume * 100) / 100} rate ${el.playbackRate}`; }), music: synth && synth.trackId !== undefined ? String(synth.trackId || synth.elId || "") : "" },
    media: { coarse: matchMedia("(pointer: coarse)").matches, fine: matchMedia("(pointer: fine)").matches, hover: matchMedia("(hover: hover)").matches, anyCoarse: matchMedia("(any-pointer: coarse)").matches, maxTouchPoints: navigator.maxTouchPoints, ontouchstart: "ontouchstart" in window, landscape: matchMedia("(orientation: landscape)").matches, standalone: matchMedia("(display-mode: standalone)").matches },
    run: k.G.hasRun() ? { player: k.G.s.player, chapter: k.G.s.chapter, phase: k.G.s.phase, hp: r2(k.G.s.hp), coins: k.G.s.coins, krezz: r2(k.G.s.krezz), gun: k.G.s.gun || null, difficulty: k.G.s.difficulty, banter: k.G.s.banter, playtimeMs: r2(k.G.s.playtimeMs) } : null,
  };
}

/** One object per line for the display list; everything else pretty-printed. Stable, so two equal dumps are equal text. */
function format(v, ind = 0) {
  const s = JSON.stringify(v);
  if (s === undefined) return "null";
  if (v === null || typeof v !== "object") return s;
  const pad = " ".repeat(ind + 1);
  const end = " ".repeat(ind);
  if (Array.isArray(v)) {
    if (s.length <= 120 && !v.some((x) => x && typeof x === "object" && x.kids)) return s;
    if (v.every((x) => x === null || typeof x !== "object")) {
      // a long list of plain values: wrapped, not one per line
      const rows = [];
      let row = "";
      for (const x of v) {
        const t = JSON.stringify(x);
        if (row && row.length + t.length + 2 > 112) {
          rows.push(row);
          row = "";
        }
        row += (row ? ", " : "") + t;
      }
      if (row) rows.push(row);
      return "[\n" + rows.map((r) => pad + r).join(",\n") + "\n" + end + "]";
    }
    return "[\n" + v.map((x) => pad + format(x, ind + 1)).join(",\n") + "\n" + end + "]";
  }
  if (Array.isArray(v.kids)) {
    // a container: its own line, then its children underneath
    const { kids, ...rest } = v;
    return JSON.stringify(rest).slice(0, -1) + ',"kids":' + format(kids, ind) + "}";
  }
  // a game object (has a type): always one line, however long its text
  if (typeof v.t === "string" || s.length <= 120) return s;
  return "{\n" + Object.keys(v).map((key) => pad + JSON.stringify(key) + ": " + format(v[key], ind + 1)).join(",\n") + "\n" + end + "}";
}

module.exports = { pageDump, format };
