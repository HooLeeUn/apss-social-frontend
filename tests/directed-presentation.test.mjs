import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
  return exports;
}
const { stripLeadingMention } = load("lib/strip-leading-mention.ts");
const { isGroupNotification, notificationHandles, activeRecipientNames } = load("lib/directed-presentation.ts");
test("Detail strips all leading recipients and preserves internal mentions and legacy default", () => {
  for (const prefix of ["@CatherineFX ", "@CatherineFX @DennisseJamaica ", "@A @B @C "]) assert.equal(stripLeadingMention(prefix + "Dog es mi personaje favorito", true), "Dog es mi personaje favorito");
  assert.equal(stripLeadingMention("Dog es mi personaje favorito @CatherineFX", true), "Dog es mi personaje favorito @CatherineFX");
  assert.equal(stripLeadingMention("@A @B Dog"), "@B Dog");
});
test("group notification classification uses metadata and keeps individual dispatch private", () => {
  assert.equal(isGroupNotification({ is_group: true }), true);
  assert.equal(isGroupNotification({ object: { conversation_key: "movie:10:participants:1-2-3" } }), true);
  assert.equal(isGroupNotification({ conversation_key: "movie:10:participants:1-2", body: "@A @B text" }), false);
  assert.equal(isGroupNotification({ individual_dispatch: true, is_group: true }), false);
  assert.equal(isGroupNotification({ is_group: false, conversation_key: "movie:10:participants:1-2-3" }), false);
});
test("group handles put either reply author first and omit the authenticated user", () => {
  const participants = [{ id: 1, username: "Julian" }, { id: 2, username: "Dennisse" }, { id: 3, username: "Catherine" }];
  assert.equal(notificationHandles({ authorUsername: "Dennisse", isGroup: true, participants }, 1), "@Dennisse \u00b7 @Catherine");
  assert.equal(notificationHandles({ authorUsername: "Catherine", isGroup: true, participants }, 1), "@Catherine \u00b7 @Dennisse");
  assert.equal(notificationHandles({ authorUsername: "Dennisse", participants }, 1), "@Dennisse");
});
test("selected recipients track active mentions case-insensitively and restore after deletion", () => {
  assert.equal(activeRecipientNames("@DENNISSE @Catherine @", ["Dennisse", "Catherine"]).join(), "Dennisse,Catherine");
  assert.equal(activeRecipientNames("@Dennisse @", ["Dennisse", "Catherine"]).join(), "Dennisse");
  assert.equal(activeRecipientNames("@DennisseLong @", ["Dennisse"]).length, 0);
  assert.equal(activeRecipientNames("@Unselected @", []).length, 0);
});
test("notification modal renders original body and truncates participant handles", () => {
  const source = readFileSync("components/NotificationCommentViewer.tsx", "utf8");
  assert.match(source, /\{displayedComment.text\}/);
  assert.doesNotMatch(source, /stripLeadingMention/);
  assert.match(source, /className="truncate text-xs text-zinc-400" title=\{handles\}/);
});
