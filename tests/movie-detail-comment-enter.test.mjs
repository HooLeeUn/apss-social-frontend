import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const composer = fs.readFileSync("components/social/CommentComposer.tsx", "utf8");
const detail = fs.readFileSync("app/movies/[id]/page.tsx", "utf8");

test("authenticated movie comments submit once on Enter while preserving mentions and IME composition", () => {
  assert.match(composer, /event\.nativeEvent\.isComposing \|\| event\.keyCode === 229/);
  assert.match(composer, /event\.key === "Enter"[\s\S]*event\.preventDefault\(\);[\s\S]*!event\.repeat[\s\S]*handleSubmit\(\)/);
  assert.match(composer, /submittingRef\.current/);
  assert.match(composer, /mentionUsername: hasValidSelectedMention|const mentionUsername = hasValidSelectedMention/);
  assert.doesNotMatch(composer, /movieDetailPost/);
});

test("authenticated composer spacing is compact without changing the guest branch", () => {
  assert.match(detail, /!isDesktopGuest \? <CommentComposer/);
  assert.match(detail, /data-mobile-text-comment[\s\S]*!isDesktopGuest \? "-mt-3"/);
  assert.match(detail, /data-desktop-comment-composer[\s\S]*"-mt-3 hidden xl:block"/);
  assert.match(detail, /data-comment-history[\s\S]*!isDesktopGuest \? "-mt-3"/);
});
