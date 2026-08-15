import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("components/profile-feed/MyActivityColumn.tsx", "utf8");
const adapterSource = fs.readFileSync("lib/profile-feed/adapters.ts", "utf8");

test("activity videos resolve canonical VideoComments only from the open handler", () => {
  assert.match(source, /async function resolveActivityVideo/);
  assert.match(source, /`\/movies\/\$\{encodeURIComponent\(movieId\)\}\/video-comments\/`/);
  assert.match(source, /String\(video\.id\) === commentId/);
  assert.match(source, /const video = await resolveActivityVideo\(request\)/);
  assert.match(source, /onOpenVideo=\{\(request\) => \{ void openActivityVideo\(request\); \}\}/);
  assert.doesNotMatch(adapterSource, /resolveActivityVideo/);
});

test("canonical counts, reaction and delete permission initialize one activity modal", () => {
  assert.match(source, /likesCount: Number\.isFinite|likesCount,/);
  assert.match(source, /dislikesCount,/);
  assert.match(source, /myReaction: match\.my_reaction/);
  assert.match(source, /canDelete: match\.can_delete === true/);
  assert.equal((source.match(/function ActivityVideoModal\(/g) ?? []).length, 1);
});

test("activity modal switches reactions with PUT and removes the active reaction with DELETE", () => {
  assert.match(source, /reactionData\.myReaction === reaction[\s\S]*\{ method: "DELETE" \}[\s\S]*\{ method: "PUT", body: JSON\.stringify\(\{ reaction \}\) \}/);
  assert.match(source, /setReactionData\(normalizeVideoCommentReactionData\(data\)\)/);
  assert.doesNotMatch(source, /setReactionData\([^)]*\+\s*1/);
});

test("owned video deletion closes locally without rebuilding activity pagination", () => {
  assert.match(source, /video\.canDelete \?/);
  assert.match(source, /`\/video-comments\/\$\{encodeURIComponent\(video\.commentId\)\}\/`/);
  assert.match(source, /setDeletedVideoCommentIds/);
  assert.match(source, /setActiveVideo\(null\)/);
  assert.doesNotMatch(source, /window\.location\.reload/);
});

test("summary actions and comment text remain independent", () => {
  assert.match(source, /comment_reactions_received_summary"\) return item\.commentText \?\? null/);
  assert.match(adapterSource, /payload\.comment_text/);
  assert.match(source, /onOpenReactionSummary\?\.\(item\)/);
  assert.match(source, /isVideoSummary && selectedVideo/);
});

test("activity video modal restores body overflow on desktop and mobile", () => {
  assert.match(source, /const previousOverflow = document\.body\.style\.overflow/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.body\.style\.overflow = previousOverflow/);
});
