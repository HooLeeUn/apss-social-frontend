// Standalone real-layout check; run with node tests/detail-video-fit.browser.mjs.
// Uses installed Chrome/Edge, no browser downloads or production measurements.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const browser = process.env.DETAIL_TEST_BROWSER ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(existsSync);
assert.ok(browser, "Set DETAIL_TEST_BROWSER to a Chromium executable");
const css = readFileSync("app/globals.css", "utf8");
const relevantCss = css.slice(css.indexOf("/* The existing detail content"), css.indexOf(".activity-scrollbar::-webkit-scrollbar"));
const compile = path => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const hook = compile("hooks/useDetailVideoSpace.ts");
const reference = compile("hooks/detailVideoReference.ts");
const baseCss = `
* { box-sizing: border-box; } body { margin: 0; }
[data-detail-movie-content] { width:100%; padding:4px 16px 12px; }
[data-detail-movie-content] > :not(:last-child) { margin-block-end:24px; }
[data-video-comment-card] > :not(:last-child) { margin-block-end:6px; }
[data-mobile-detail-sticky] { height:var(--header-height); }
[data-video-reaction-section] { margin-top:24px; }
[data-mobile-video-reaction] { padding:16px; }
[data-mobile-video-reaction-scroll-container] { max-height:50dvh; }
.recorder { height:96px; }
[data-history-carousel-viewport] { position:relative; }
[data-desktop-video-reaction-history] { margin-top:20px; }
[data-video-comment-card] { padding:10px; }
.author { height:36px; }
.slot { display:flex; width:100%; justify-content:center; align-items:center; overflow:hidden; background:black; }
.player { position:relative; display:inline-flex; max-width:100%; overflow:hidden; }
video { display:block; object-fit:contain; }
`;
const markup = `<main data-mobile-detail-layout="true" data-normal-mobile-detail="true">
<div data-detail-movie-content><div data-mobile-detail-sticky="true"></div>
<div data-video-reaction-section><section data-mobile-video-reaction data-active="true" data-recording-overlay="false">
<div data-mobile-video-reaction-scroll-container="true"><div class="recorder"></div>
<div data-history-carousel-viewport><div data-desktop-video-reaction-history>
${Array.from({length:2}, (_, id) => `<article data-video-comment-card="${id}"><div class="author"></div><div class="slot"><div class="player"><video data-video-comment-player></video></div></div></article>`).join("")}
</div></div></div></section></div></div></main>`;
const frameDoc = `<style>${baseCss}${relevantCss}</style>${markup}`;
const script = `
const errors = [];
let checks = 0;
function check(condition, message) { checks++; if (!condition) throw Error(message); }
const near = (a,b) => Math.abs(a-b)<0.08;
const nextPaint = win => new Promise(resolve => win.setTimeout(resolve, 100));
(async () => {
try {
  const scenarios = [[360,960,280],[360,800,280],[360,700,280],[320,640,260],[600,1100,280]];
  for (const [width,height,header] of scenarios) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'display:block;border:0;width:'+width+'px;height:'+height+'px';
    const loaded = new Promise(resolve => frame.onload = resolve);
    frame.srcdoc = ${JSON.stringify(frameDoc)};
    document.body.append(frame); await loaded;
    const win = frame.contentWindow, doc = frame.contentDocument;
    doc.documentElement.style.setProperty('--header-height',header+'px');
    const ref = {};
    win.Function('exports', ${JSON.stringify(reference)})(ref);
    let cleanup;
    const exports = {};
    win.Function('exports', 'require', ${JSON.stringify(hook)})(exports, name => name==='react' ? {useLayoutEffect: fn => { cleanup?.(); cleanup=fn(); }} : ref);
    const root = { current: doc.querySelector('[data-history-carousel-viewport]') };
    const run = suspended => exports.useDetailVideoSpace(root,true,suspended);
    const read = () => {
      const player=doc.querySelector('.player'), video=player.querySelector('video'), slot=player.parentElement;
      const rect=player.getBoundingClientRect(), bounds=slot.getBoundingClientRect(), media=video.getBoundingClientRect();
      const author=doc.querySelector('.author').getBoundingClientRect();
      const area=doc.querySelector('[data-detail-movie-content]').getBoundingClientRect();
      check(rect.width>0 && rect.height>0, 'nonempty player '+[width,height]);
      check(rect.left>=bounds.left-.08 && rect.right<=bounds.right+.08, 'horizontal overflow');
      check(rect.top>=bounds.top-.08 && rect.bottom<=bounds.bottom+.08, 'vertical overflow');
      check(bounds.top>=author.bottom-.08, 'author overlap');
      check(near(bounds.top-author.bottom,6), 'author spacing changed');
      check(near(doc.querySelector('[data-video-reaction-section]').getBoundingClientRect().top-doc.querySelector('[data-mobile-detail-sticky]').getBoundingClientRect().bottom,24), 'upper layout spacing changed');
      check(bounds.bottom<=area.bottom+.08, 'slot exceeds allocated area');
      check(near(rect.width/rect.height,9/16), 'aspect ratio');
      check(near(rect.width,bounds.width) || near(rect.height,bounds.height), 'not maximal fit');
      check(near((rect.left+rect.right)/2,(bounds.left+bounds.right)/2), 'horizontal centering');
      check(near((rect.top+rect.bottom)/2,(bounds.top+bounds.bottom)/2), 'vertical centering');
      check(near(rect.width,media.width) && near(rect.height,media.height), 'media exceeds player');
      return [rect.width,rect.height];
    };
    run(false); const initial=read(); await nextPaint(win);
    check(read().every((value,index)=>near(value,initial[index])), 'post-paint resize');
    for (let mount=0;mount<40;mount++) {
      run(true);
      doc.body.classList.add('detail-trailer-active');
      check(win.getComputedStyle(doc.querySelector('.slot')).containerType==='normal', 'trailer layout was changed');
      doc.body.classList.remove('detail-trailer-active');
      const oldRoot=root.current;
      root.current=oldRoot.cloneNode(true);
      oldRoot.replaceWith(root.current);
      run(false);
      check(read().every((value,index)=>near(value,initial[index])), 'remount/trailer mismatch');
    }
    // A fresh iframe document models a fresh navigation without retained state.
    cleanup?.();
    doc.querySelector('[data-mobile-video-reaction]').dataset.active='false';
    check(win.getComputedStyle(doc.querySelector('.slot')).containerType==='normal', 'inactive reaction layout was changed');
    frame.style.width='1400px';
    doc.querySelector('[data-mobile-video-reaction]').dataset.active='true';
    check(win.getComputedStyle(doc.querySelector('.slot')).containerType==='normal', 'desktop layout was changed');
    frame.remove();
  }
} catch(error) { errors.push(error.stack); }
document.getElementById('results').textContent=JSON.stringify({checks,errors});
})();`;
const directory = resolve(".next/detail-video-fit-browser");
mkdirSync(directory, { recursive: true });
const fixture = resolve(directory, "fixture.html");
writeFileSync(fixture, `<!doctype html><meta charset="utf-8"><pre id="results">pending</pre><script>${script}</script>`);
const result = spawnSync(browser, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${resolve(directory,"profile")}`, "--virtual-time-budget=10000", "--run-all-compositor-stages-before-draw", "--dump-dom", pathToFileURL(fixture).href], { encoding:"utf8", timeout:60000, maxBuffer:8*1024*1024 });
writeFileSync(resolve(directory,"last-dom.html"),result.stdout ?? "");
assert.ifError(result.error);
assert.equal(result.status,0,result.stderr);
const serialized = result.stdout.match(/<pre id="results">([^<]+)<\/pre>/)?.[1];
assert.ok(serialized && serialized!=="pending", "Browser did not finish: "+result.stderr.slice(-1000));
const output = JSON.parse(serialized.replaceAll("&gt;",">").replaceAll("&lt;","<").replaceAll("&amp;","&"));
assert.deepEqual(output.errors,[]);
console.log(`Chromium layout: ${output.checks} checks passed across five layouts and 40 remounts/trailer cycles each.`);
