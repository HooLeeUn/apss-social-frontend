import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const feedSource = await readFile(new URL("../app/feed/page.tsx", import.meta.url), "utf8");
const modalSource = await readFile(new URL("../components/NotificationCommentViewer.tsx", import.meta.url), "utf8");

test("received public and directed comment reactions open an exact Feed modal before existing navigation", () => {
  assert.match(feedSource, /item\.type === "public_comment_reaction" && item\.commentId !== null/);
  assert.match(feedSource, /item\.type === "private_comment_reaction" \|\| item\.type === "directed_comment_reaction"/);
  assert.match(feedSource, /buildCommentDetailEndpoint\(commentId\)/);
  assert.match(feedSource, /String\(comment\.id\) !== commentId/);
  assert.ok(feedSource.indexOf("if (isReceivedCommentReaction)") < feedSource.indexOf("if (isReceivedVideoReaction)"));
  assert.match(feedSource, /setNotificationComment\(\{ comment, movie:/);
});

test("comment notification modal preserves Feed on close and only opens Detail from metadata", () => {
  assert.match(modalSource, /event\.target === event\.currentTarget\) onClose\(\)/);
  assert.match(modalSource, /event\.stopPropagation\(\)/);
  assert.match(modalSource, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(feedSource, /onClose=\{\(\) => setNotificationComment\(null\)\}/);
  assert.match(feedSource, /router\.push\(`\/movies\/\$\{encodeURIComponent\(movieId\)\}`\)/);
});

test("a new private-message notification reuses the exact directed-comment modal", () => {
  assert.match(feedSource, /item\.type === "private_message" && item\.directedCommentId !== null/);
  assert.match(feedSource, /item\.movieId !== null && \(isReceivedCommentReaction \|\| isNewDirectedMessage\)/);
  assert.match(feedSource, /String\(isPublicCommentReaction \? item\.commentId : item\.directedCommentId\)/);
  assert.ok(feedSource.indexOf("if (shouldOpenCommentModal)") < feedSource.indexOf("if (isReceivedVideoReaction)"));
});
