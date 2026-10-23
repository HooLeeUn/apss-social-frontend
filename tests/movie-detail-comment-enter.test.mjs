import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composer = fs.readFileSync("components/social/CommentComposer.tsx", "utf8");
const detail = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");

test("authenticated movie comments preserve native newlines, mentions and IME composition", () => {
  assert.match(composer, /event\.nativeEvent\.isComposing \|\| event\.keyCode === 229/);
  const keyHandler = composer.slice(composer.indexOf("const handleKeyDown"), composer.indexOf("    <section"));
  assert.doesNotMatch(keyHandler, /handleSubmit/);
  assert.match(keyHandler, /mentionQuery !== null && event\.key === "Enter" && mentionSuggestions\.length > 0/);
  assert.match(composer, /enterKeyHint="enter"/);
  assert.match(composer, /rows=\{2\}/);
  assert.match(composer, /autoCorrect="off" spellCheck=\{false\} autoCapitalize="sentences"/);
});

test("the compact arrow reuses submission and preserves empty and duplicate guards", () => {
  assert.match(composer, /onClick=\{\(\) => void handleSubmit\(\)\}/);
  assert.match(composer, /aria-label=\{t\("movieDetailPost"\)\}/);
  assert.match(composer, /disabled=\{!text\.trim\(\) \|\| loading\}/);
  assert.match(composer, /if \(!trimmed \|\| loading \|\| submittingRef\.current\) return/);
  assert.match(composer, /absolute bottom-2 right-2/);
  assert.match(composer, /p-3 pr-12/);
  assert.match(composer, /submittingRef\.current/);
  assert.match(composer, /mentionUsername: hasValidSelectedMention|const mentionUsername = hasValidSelectedMention/);
});

test("authenticated composer spacing is compact without changing the guest branch", () => {
  assert.match(detail, /!isDesktopGuest \? <CommentComposer/);
  assert.match(detail, /data-mobile-text-comment[\s\S]*!isDesktopGuest \? "-mt-3"/);
  assert.match(detail, /data-desktop-comment-composer[\s\S]*"-mt-3 hidden xl:block"/);
  assert.match(detail, /data-comment-history[\s\S]*!isDesktopGuest \? "-mt-3"/);
});
