import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modal = readFileSync("components/TrailerModal.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("trailer header orders title, YouTube link and close with existing navigation handlers", () => {
  const header = modal.slice(modal.indexOf('<div className="trailer-modal-header'), modal.indexOf('<div className="trailer-modal-content'));
  assert.match(header, /<h2[\s\S]*watchUrl && !isYouTubeFallback[\s\S]*<a href=\{watchUrl\} target="_blank" rel="noopener noreferrer" onClick=\{onClose\}[\s\S]*trailer-youtube-header-link hidden[\s\S]*<button[\s\S]*onClick=\{onClose\}/);
  assert.match(modal, /onClick=\{handleFallbackWatchClick\}/);
  assert.match(modal, /allowFullScreen/);
});

test("only mobile Detail hides the footer link and displays a compact single-row header", () => {
  const start = css.indexOf("@media (max-width: 1279px)", css.indexOf("body.detail-trailer-active:not"));
  const mobile = css.slice(start, css.indexOf("@media", start + 1));
  assert.match(mobile, /\.detail-trailer-active \.trailer-youtube-link\s*\{\s*display: none;/);
  assert.match(mobile, /\.detail-trailer-active \.trailer-modal-header\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto auto;/);
  assert.match(mobile, /\.detail-trailer-active \.trailer-youtube-header-link\s*\{[^}]*display: inline-flex;[^}]*min-height: 2rem;[^}]*white-space: nowrap;/);
  assert.match(mobile, /\.detail-trailer-active \.trailer-modal-header > button\s*\{[^}]*grid-column: 3;/);
});
