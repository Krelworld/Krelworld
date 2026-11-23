const L = require('./lib.js');
(async () => { const g = await L.boot({ port: 8891, view: 'port', room: 'living' }); await g.calm();
  const r = await g.ev(async () => { G.holding = null; marina.state = 'idle'; marina.x = 60; for (const e of [mommy, rory, niko]) if (e.room === G.room) e.room = 'yard';
    const st = document.getElementById('stage').getBoundingClientRect(); const w = Clarity.fromClient(st.right - 42, st.bottom - 114); daddy.room = G.room; daddy.hidden = false; daddy.state = 'idle'; daddy.x = w[0];
    await new Promise(r => setTimeout(r, 300)); const c = Clarity.toClient(daddy.x, daddy.y - 40); const h = hitTest(...Clarity.fromClient(c[0], c[1]));
    return { w, daddy: [Math.round(daddy.x), Math.round(daddy.y), daddy.room, daddy.state, daddy.here], camX: E.camX, viewW: E.viewW, roomW: ROOMS[G.room].w, client: c.map(Math.round), hit: h && (h.kind + ':' + ((h.ent && (h.ent.name || h.ent.id)) || (h.prop && h.prop.id) || '')) }; });
  console.log(JSON.stringify(r)); await g.close(); })();
