import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const activityColumn = readFileSync(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");
const messagesHook = readFileSync(new URL("../hooks/useInfiniteMyMessages.ts", import.meta.url), "utf8");

test("private inbox marks messages only after the initial GET has rendered", () => {
  assert.match(messagesHook, /hasLoaded: boolean/);
  assert.match(messagesHook, /if \(mode === "reset"\) setHasLoaded\(true\)/);
  assert.match(activityColumn, /if \(!messages\.hasLoaded \|\| messages\.loading \|\| messages\.error/);
  assert.match(activityColumn, /await markMyMessagesAsRead\(abortController\.signal\)/);
});

test("mark-as-read never reloads or clears visible inbox messages", () => {
  const markAsReadEffect = activityColumn.slice(
    activityColumn.indexOf("hasRequestedMessagesMarkAsReadRef.current = false"),
    activityColumn.indexOf("const handleScroll"),
  );
  assert.doesNotMatch(markAsReadEffect, /reloadMessages|messages\.reload|setItems/);
  assert.match(markAsReadEffect, /console\.warn\("No se pudieron marcar mensajes como leídos\."/);
});

test("tab churn cannot start duplicate mark-as-read requests for one inbox load", () => {
  assert.match(activityColumn, /hasRequestedMessagesMarkAsReadRef\.current/);
  assert.match(activityColumn, /messages\.hasLoaded[\s\S]*hasRequestedMessagesMarkAsReadRef\.current = true/);
  assert.match(messagesHook, /abortControllerRef\.current\?\.abort\(\)/);
  assert.match(messagesHook, /requestId !== requestIdRef\.current/);
});

test("inbox empty state remains distinct from its initial loading state", () => {
  assert.match(activityColumn, /messages\.loading \? <MyActivitySkeleton/);
  assert.match(activityColumn, /!messages\.loading && !messages\.error && messages\.items\.length === 0/);
});

test("private inbox keeps its tour targets and native iOS touch path", () => {
  assert.match(activityColumn, /data-tour=\{tab\.value === "messages" \? "profile-inbox"/);
  assert.match(activityColumn, /profile-\$\{effectiveActiveTab === "messages" \? "inbox"/);
  assert.match(activityColumn, /if \(effectiveActiveTab === "messages" \|\| !window\.matchMedia/);
});
