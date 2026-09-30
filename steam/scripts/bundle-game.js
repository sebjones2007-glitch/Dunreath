// Copies the game (../index.html) into game/ and swaps everything it fetches
// from the internet for local copies, so the Steam edition plays offline:
//   three.js      -> game/vendor/three.min.js (from the three package)
//   Google Fonts  -> game/fonts/ (downloaded once, at build time)
//   supabase-js   -> removed (the Steam edition keeps saves in Steam Cloud)
// It stops with an error if the game's <head> no longer looks as expected,
// so a changed index.html can't quietly produce a broken build.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(__dirname, "..", "game");
// Asking as a current desktop browser makes Google serve woff2 files.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function swap(html, pattern, replacement, what) {
  if (!pattern.test(html)) throw new Error(`bundle-game: couldn't find ${what} in index.html`);
  return html.replace(pattern, replacement);
}

async function get(url, as) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`bundle-game: ${res.status} fetching ${url}`);
  return as === "text" ? res.text() : Buffer.from(await res.arrayBuffer());
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true });

  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const f of ["favicon-32.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
    fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
  }

  // three.js r128, the same edition the website loads.
  fs.copyFileSync(require.resolve("three/build/three.min.js"), path.join(OUT, "vendor", "three.min.js"));
  html = swap(html, /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"[^>]*><\/script>/,
    '<script src="vendor/three.min.js"></script>', "the three.js script tag");

  html = swap(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"[^>]*><\/script>\s*/, "", "the supabase script tag");
  html = swap(html, /<link rel="manifest"[^>]*>\s*/, "", "the web app manifest link");
  html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*/g, "");

  // Google Fonts: fetch the stylesheet, download each font file it names.
  const fontLink = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/);
  if (!fontLink) throw new Error("bundle-game: couldn't find the Google Fonts link in index.html");
  let css = await get(fontLink[1].replace(/&amp;/g, "&"), "text");
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+/g) || [])];
  if (!urls.length) throw new Error("bundle-game: the Google Fonts stylesheet named no font files");
  let n = 0;
  for (const u of urls) {
    const name = `f${n++}${path.extname(new URL(u).pathname) || ".woff2"}`;
    fs.writeFileSync(path.join(OUT, "fonts", name), await get(u));
    css = css.split(u).join(name);
  }
  fs.writeFileSync(path.join(OUT, "fonts", "fonts.css"), css);
  html = html.replace(fontLink[0], '<link href="fonts/fonts.css" rel="stylesheet">');

  const left = html.match(/(src|href)="https?:\/\/[^"]+"/g);
  if (left) throw new Error("bundle-game: index.html still loads from the internet: " + left.join(", "));

  fs.writeFileSync(path.join(OUT, "index.html"), html);
  console.log(`bundle-game: game/ ready (${urls.length} font files).`);
}

main().catch(e => { console.error(e.message || e); process.exit(1) });
