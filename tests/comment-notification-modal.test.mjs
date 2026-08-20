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
  assert.match(feedSource, /setNotificationComment\(\{[\s\S]*comment,[\s\S]*movie:/);
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
  assert.match(feedSource, /allowReactions: fallbackType === "directed" && comment\.type === "directed" && item\.directedCommentId !== null/);
  assert.match(feedSource, /canDirectReply: isNewDirectedMessage/);
  assert.match(feedSource, /replyRecipient: isNewDirectedMessage && item\.actorId !== null && item\.actorUsername/);
  assert.ok(feedSource.indexOf("if (shouldOpenCommentModal)") < feedSource.indexOf("if (isReceivedVideoReaction)"));
});

test("all valid directed-comment modals reuse the canonical reaction controls and endpoint", () => {
  assert.match(modalSource, /<ReactionButtons comment=\{displayedComment\} onReact=\{handleReact\} disabled=\{reacting\}/);
  assert.match(modalSource, /buildReactionEndpoint\(commentId\)/);
  assert.match(modalSource, /reaction === null[\s\S]*method: "DELETE"[\s\S]*method: "PUT"/);
  assert.match(modalSource, /response\.likes_count/);
  assert.match(modalSource, /response\.dislikes_count/);
  assert.match(modalSource, /response\.my_reaction/);
  assert.match(modalSource, /if \(!allowReactions \|\| reactingRef\.current\) return/);
});

test("directed reaction notifications enable controls from the recovered comment, not the notification source", () => {
  assert.match(feedSource, /item\.type === "private_comment_reaction" \|\| item\.type === "directed_comment_reaction"/);
  assert.doesNotMatch(feedSource, /allowReactions: isNewDirectedMessage/);
  assert.match(feedSource, /const fallbackType = isPublicCommentReaction \? "public" : "directed"/);
  assert.match(feedSource, /String\(comment\.id\) !== commentId/);
});

test("directed notification modal replies through the existing directed-comment contract", () => {
  assert.match(modalSource, /recipientId === originalSenderId && recipientId !== currentUserId/);
  assert.match(modalSource, /const payload = \{ body, mentioned_username: recipientUsername, movie_id: String\(movieId\) \}/);
  assert.match(modalSource, /buildMovieDirectedSubmitEndpoints\(movieId\)/);
  assert.match(modalSource, /replyingRef\.current \|\| !body/);
  assert.match(modalSource, /await apiFetch\(endpoints\[index\], \{ method: "POST", body: JSON\.stringify\(payload\), expectJson: false \}\)/);
  assert.doesNotMatch(modalSource, /getCreatedCommentId/);
  assert.doesNotMatch(modalSource, /directed-reply-missing-created-id/);
  assert.doesNotMatch(modalSource, /buildCommentDetailEndpoint\(createdCommentId\)/);
  assert.doesNotMatch(modalSource, /directed-reply-persistence-mismatch/);
  assert.match(modalSource, /setReplyText\(""\)[\s\S]*setReplyStatus\("sent"\)[\s\S]*setTimeout\(onClose, 650\)/);
  assert.doesNotMatch(modalSource, /body:\s*`@\$\{recipientUsername\}/);
});

test("only private-message events expose localized responsive reply controls", () => {
  assert.match(modalSource, /notificationReplyPlaceholder/);
  assert.match(modalSource, /notificationReplyButton/);
  assert.match(modalSource, /flex flex-col gap-2 sm:flex-row/);
  assert.match(modalSource, /\{canDirectReply \? \(/);
  assert.doesNotMatch(modalSource, /\{displayedComment\.type === "directed" \? \(/);
  assert.match(modalSource, /setReplyStatus\("error"\)/);
});
