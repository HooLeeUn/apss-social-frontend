import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activityColumn = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");

test("activity video deletion is gated by canonical can_delete and removes matching local activities", () => {
  assert.match(activityColumn, /canDelete: match\.can_delete === true/);
  assert.match(activityColumn, /video\.canDelete \? <div/);
  assert.match(activityColumn, /apiFetch\(`\/video-comments\/\$\{encodeURIComponent\(video\.commentId\)\}\/`, \{ method: "DELETE" \}\)/);
  assert.match(activityColumn, /deletedVideoCommentIds\.has\(String\(item\.videoCommentId\)\)/);
});

test("activity video keeps native playback controls while suppressing download, speed, and picture-in-picture", () => {
  assert.match(activityColumn, /<video[^>]*controls[^>]*controlsList="nodownload noplaybackrate"/);
  assert.match(activityColumn, /disablePictureInPicture/);
  assert.match(activityColumn, /disableRemotePlayback/);
});
