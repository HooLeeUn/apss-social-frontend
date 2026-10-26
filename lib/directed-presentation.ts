export function isGroupNotification(record: Record<string, unknown>): boolean {
  const object = record.object as Record<string, unknown> | undefined;
  if (record.individual_dispatch === true || object?.individual_dispatch === true) return false;
  const explicit = record.is_group ?? object?.is_group;
  if (typeof explicit === "boolean") return explicit;
  const key = record.conversation_key ?? object?.conversation_key;
  return typeof key === "string" && /:participants:\d+(?:-\d+){2,}$/.test(key);
}
export function notificationHandles(comment: { authorUsername: string; isGroup?: boolean; participants?: { id: number | string | null; username: string | null }[] }, userId: number | string | null): string {
  const names = [comment.authorUsername];
  if (comment.isGroup) {
    for (const user of comment.participants ?? []) {
      if (userId !== null && String(user.id) === String(userId)) continue;
      if (user.username && !names.some(name => name.toLowerCase() === user.username!.toLowerCase())) names.push(user.username);
    }
  }
  return names.filter(Boolean).map(name => `@${name}`).join(" \u00b7 ");
}
export function activeRecipientNames(text: string, selected: string[]): string[] {
  const tokens = new Set(Array.from(text.matchAll(/(?:^|\s)@([\w.@+-]+)(?=\s|$)/g), match => match[1].toLowerCase()));
  return selected.filter(name => tokens.has(name.toLowerCase()));
}
