// Asset packs: the game's few hundred pictures and sounds travel as three bundle files (art,
// audio, everything else) with an index, so the published page needs only a handful of files.
// At start-up they're fetched once; after that, any request the game makes for one of the files
// inside (Phaser's loader uses XHR, the audio uses fetch, the HTML uses <img src>) is answered from
// memory. Without packs (local development) nothing changes: files load from their own paths.

interface Entry { pack: string; off: number; len: number; type: string }
const files = new Map<string, Entry>();
const packs = new Map<string, ArrayBuffer>();
const blobUrls = new Map<string, string>();
const baseDir = () => new URL(".", location.href).pathname;

/** "art/fan-rot.png" for anything that points at one of our files, however it was written. */
function norm(url: string | URL): string | null {
  try {
    const u = new URL(String(url), location.href);
    if (u.origin !== location.origin) return null;
    const b = baseDir();
    return u.pathname.startsWith(b) ? decodeURIComponent(u.pathname.slice(b.length)) : null;
  } catch { return null; }
}
const lookup = (url: string | URL) => { const p = norm(url); return p ? files.get(p) : undefined; };
const bytesOf = (e: Entry) => packs.get(e.pack)!.slice(e.off, e.off + e.len);

/** A URL for an asset: a blob URL if it's in a pack, else its own path. For <img src>. */
export function assetURL(path: string): string {
  const e = files.get(path);
  if (!e) return path;
  let u = blobUrls.get(path);
  if (!u) { u = URL.createObjectURL(new Blob([bytesOf(e)], { type: e.type })); blobUrls.set(path, u); }
  return u;
}

/** Fetch the packs (if this build has them) and start answering requests from them. */
export async function loadPacks(progress: (done: number, total: number) => void): Promise<void> {
  let index: { packs: Record<string, number>; files: Record<string, [string, number, number, string]>; v?: string };
  try {
    // Never a stale index: it's tiny, and it names the version of the packs to fetch.
    const r = await fetch(`packs/index.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    index = await r.json();
  } catch { return; }
  const total = Object.values(index.packs).reduce((a, b) => a + b, 0);
  let done = 0;
  await Promise.all(Object.keys(index.packs).map(async (name) => {
    const r = await fetch(`packs/${name}.pack.mp3${index.v ? `?v=${index.v}` : ""}`);
    if (!r.body) { const b = await r.arrayBuffer(); packs.set(name, b); done += b.byteLength; progress(done, total); return; }
    // Read in chunks so there's a progress bar on a slow phone connection.
    const reader = r.body.getReader(), chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      chunks.push(value); got += value.byteLength; done += value.byteLength; progress(done, total);
    }
    const all = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.byteLength; }
    packs.set(name, all.buffer);
  }));
  for (const [path, [pack, off, len, type]] of Object.entries(index.files)) files.set(path, { pack, off, len, type });
  install();
}

function install(): void {
  // fetch(): the sound loader.
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const e = lookup(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!e) return realFetch(input, init);
    return Promise.resolve(new Response(bytesOf(e), { status: 200, headers: { "Content-Type": e.type } }));
  };
  // XMLHttpRequest: Phaser's loader. Answer from the pack, firing the usual events.
  const X = XMLHttpRequest.prototype as XMLHttpRequest & { __pack?: Entry };
  const realOpen = X.open, realSend = X.send;
  X.open = function (this: XMLHttpRequest & { __pack?: Entry }, method: string, url: string | URL, ...rest: unknown[]) {
    this.__pack = lookup(url);
    return (realOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof X.open;
  X.send = function (this: XMLHttpRequest & { __pack?: Entry }, body?: Document | XMLHttpRequestBodyInit | null) {
    const e = this.__pack;
    if (!e) return realSend.call(this, body);
    const bytes = bytesOf(e);
    const rt = this.responseType;
    const text = rt === "" || rt === "text" || rt === "json" ? new TextDecoder().decode(bytes) : null;
    const response = rt === "blob" ? new Blob([bytes], { type: e.type }) : rt === "arraybuffer" ? bytes : rt === "json" ? JSON.parse(text!) : text;
    const def = (k: string, v: unknown) => Object.defineProperty(this, k, { configurable: true, get: () => v });
    setTimeout(() => {
      def("readyState", 4); def("status", 200); def("statusText", "OK"); def("response", response);
      if (text !== null) def("responseText", text);
      def("responseURL", new URL(e.pack, location.href).href);
      this.dispatchEvent(new ProgressEvent("progress", { lengthComputable: true, loaded: e.len, total: e.len }));
      this.dispatchEvent(new Event("readystatechange"));
      this.dispatchEvent(new ProgressEvent("load", { lengthComputable: true, loaded: e.len, total: e.len }));
      this.dispatchEvent(new ProgressEvent("loadend", { lengthComputable: true, loaded: e.len, total: e.len }));
    }, 0);
  } as typeof X.send;
}
