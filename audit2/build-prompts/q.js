const L = require('./lib.js');
(async () => { const g = await L.boot({ port: 8852, room: 'playroom', settle: 1500 });
  console.log(await g.ev(() => Object.entries(PROPS).map(([r, l]) => r + ': ' + l.filter(p => ['toy', 'toybox', 'books', 'basket'].includes(p.a)).map(p => p.id + '/' + p.a).join(' ')).filter(s => !s.endsWith(': ')).join('\n')));
  console.log(await g.ev(() => ['nunuroom', 'den', 'storage', 'laundry', 'parents', 'uphall', 'mroom', 'milesroom', 'pool', 'yard', 'backyard'].map(r => r + ' L=' + ROOMS[r].left + ' R=' + ROOMS[r].right + ' w=' + ROOMS[r].w).join('\n')));
  await g.close(); })();
