const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const g = await L.boot({ view: 'port', room: 'kitchen', off: 'G22', port: 8881 });
  const d = await g.page.evaluate(() => ({ icons: { ...SAY_ICON } }));
  fs.writeFileSync(L.OUT + 'say_icon_today.json', JSON.stringify(d.icons, null, 0));
  console.log(Object.keys(d.icons).length, L.real(g.errors)); await g.close();
})();
