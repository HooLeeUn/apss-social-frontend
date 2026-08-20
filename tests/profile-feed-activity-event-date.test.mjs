import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activitySource = await readFile(new URL("../components/profile-feed/MyActivityColumn.tsx", import.meta.url), "utf8");
const adapterSource = await readFile(new URL("../lib/profile-feed/adapters.ts", import.meta.url), "utf8");

test("received reaction summaries display the latest reaction event instead of the original object date", () => {
  assert.match(
    activitySource,
    /if \(isReactionSummary\(item\)\) return item\.latestReactionAt \?\? item\.activityAt \?\? item\.updatedAt \?\? item\.createdAt;/,
  );
  assert.doesNotMatch(
    activitySource,
    /if \(isReactionSummary\(item\)\) return item\.objectCreatedAt/,
  );
});

test("activity chronology remains in the authoritative endpoint order and retains both backend timestamps", () => {
  assert.match(adapterSource, /The activity endpoint is authoritative for chronology; retain its exact order/);
  assert.match(adapterSource, /items: mapped/);
  assert.match(adapterSource, /latestReactionAt: isReceivedSummaryType \? latestReactionAt : undefined/);
  assert.match(adapterSource, /objectCreatedAt: isReceivedSummaryType \? objectCreatedAt : undefined/);
});
