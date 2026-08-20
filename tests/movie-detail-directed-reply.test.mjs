import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detailSource = readFileSync(new URL("../app/movies/[id]/page.tsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

test("expanded directed conversations submit compact replies through the existing contract", () => {
  assert.match(detailSource, /const recipientUsername = conversation\.otherUsername;/);
  assert.match(detailSource, /buildMovieDirectedSubmitEndpoints\(movieId\)/);
  assert.match(detailSource, /\{ body, mentioned_username: recipientUsername, movie_id: movieId \}/);
  assert.match(detailSource, /enterKeyHint="send"/);
  assert.match(detailSource, /event\.key !== "Enter" \|\| event\.nativeEvent\.isComposing/);
  assert.match(detailSource, /event\.preventDefault\(\);/);
});

test("direct reply drafts and in-flight locks are isolated by conversation", () => {
  assert.match(detailSource, /directReplyDrafts\[conversation\.key\]/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.has\(conversationKey\)/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.add\(conversationKey\)/);
  assert.match(detailSource, /directReplySubmittingRef\.current\.delete\(conversationKey\)/);
  assert.match(detailSource, /\[conversationKey\]: ""/);
});

test("direct reply placeholder is localized in Spanish and English", () => {
  assert.match(i18nSource, /movieDetailDirectReplyPlaceholder: "Escribe un mensaje\.\.\."/);
  assert.match(i18nSource, /movieDetailDirectReplyPlaceholder: "Write a message\.\.\."/);
});

test("direct reply refreshes merge snapshots without discarding existing history", () => {
  assert.match(detailSource, /function mergeDirectedConversationSnapshots/);
  assert.match(detailSource, /messages: mergeUniqueMessages\(current\.messages, conversation\.messages\)/);
  assert.match(detailSource, /setDirectedConversations\(\(current\) => mergeDirectedConversationSnapshots\(current, snapshots\)\)/);
  assert.match(detailSource, /messages: mergeUniqueMessages\(item\.messages, \[nextMessage\]\)/);
});

test("only the visible expanded conversation is polled without overlapping requests", () => {
  assert.match(detailSource, /window\.setInterval\(\(\) => void refreshExpandedConversation\(\), 4_000\)/);
  assert.match(detailSource, /directedPollingInFlightRef\.current/);
  assert.match(detailSource, /document\.visibilityState !== "visible"/);
  assert.match(detailSource, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(detailSource, /window\.clearInterval\(intervalId\)/);
  assert.match(detailSource, /conversation\.key !== expandedConversationKey/);
});

test("visible private-message notifications are matched by message and movie ids before mark-read", () => {
  assert.match(detailSource, /notification\.type === "private_message"/);
  assert.match(detailSource, /String\(notification\.movieId\) === movieId/);
  assert.match(detailSource, /receivedMessageIds\.has\(String\(notification\.directedCommentId\)\)/);
  assert.match(detailSource, /markNotificationsAsReadBatch\(matchingIds\)/);
  assert.match(detailSource, /processedDirectedNotificationIdsRef\.current/);
});
