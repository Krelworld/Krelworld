// crop a region of a screenshot by re-rendering it in a page (no image libs available)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const [src, x, y, w, h, scale, out] = process.argv.slice(2); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w * scale, height: h * scale } });
  const data = fs.readFileSync(src).toString('base64');
  await p.setContent(`<body style="margin:0;overflow:hidden"><div style="width:${w * scale}px;height:${h * scale}px;background:url(data:image/png;base64,${data}) -${x * scale}px -${y * scale}px / auto no-repeat;image-rendering:pixelated;background-size:auto"></div></body>`);
  await p.evaluate(([s]) => { const d = document.querySelector('div'); const im = new Image(); im.src = getComputedStyle(d).backgroundImage.slice(5, -2); return im.decode().then(() => { d.style.backgroundSize = (im.width * s) + 'px ' + (im.height * s) + 'px'; }); }, [scale]);
  await p.screenshot({ path: out }); await b.close(); })();
