import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("components/profile-feed/VisitedProfileVideoReactions.tsx", "utf8");
const headerStart = source.indexOf('{source === "following" ? <div data-following-reaction-header');
const header = source.slice(headerStart, source.indexOf("</div> : null}", headerStart));

test("only Following mobile uses the two-row header with a fixed poster and shrinkable text", () => {
  assert.ok(headerStart > 0);
  assert.match(header, /grid-cols-\[2\.5rem_minmax\(0,1fr\)\][^"\n]*xl:hidden/);
  assert.match(header, /<PosterImage posterSrc=\{item\.movie\.image\}/);
  assert.match(header, /<ActionsTruncatedText text=\{`@\$\{item\.actor\.username\}`\} href=\{`\/users\//);
  assert.match(header, /<ActionsTruncatedText text=\{title\} href=\{`\/movies\//);
  assert.equal((header.match(/min-w-0 flex-1 truncate/g) ?? []).length, 2);
  assert.match(header, /<time[^>]*shrink-0 whitespace-nowrap/);
  assert.match(header, /<UgcModerationMenu[^>]*actionsMobileViewport/);
  assert.doesNotMatch(header, /reactionButtons/);
  assert.match(source, /source === "following" \? "hidden min-h-14 items-center gap-3 xl:flex" : "flex min-h-14 items-center gap-3"/);
});

test("Following mobile overlays the existing reaction buttons above video without moving bottom controls", () => {
  const videoStart = source.indexOf('<div className="group relative');
  const videoEnd = source.indexOf("</article>", videoStart);
  const video = source.slice(videoStart, videoEnd);
  assert.match(video, /source === "following" \? <div data-following-reaction-overlay[^>]*absolute right-2 top-2 z-20[^>]*bg-black\/55[^>]*xl:hidden">\{reactionButtons\}/);
  assert.match(video, /xl:group-hover:pointer-events-auto xl:group-hover:opacity-100/);
  assert.match(video, /absolute bottom-2 right-2 z-30[^\n]*openExpandedViewer\(index\)/);
  assert.match(source, /data-video-mute-control[^\n]*absolute bottom-2 left-2 z-30/);
  assert.match(source, /event\.preventDefault\(\); event\.stopPropagation\(\); void reactToVideo\(item\.id, commentId, reaction\)/);
});
