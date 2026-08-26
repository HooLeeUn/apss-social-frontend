import type { MyMessageItem, PaginatedMyMessages } from "../lib/profile-feed/types";

export type MyMessagesPaginationIssue = "empty-page-with-next" | "repeated-cursor" | null;

export interface MyMessagesPageMerge {
  items: MyMessageItem[];
  next: string | null;
  issue: MyMessagesPaginationIssue;
}

export function mergeMyMessagesPage(
  current: MyMessageItem[],
  response: PaginatedMyMessages,
  requestedNext: string,
): MyMessagesPageMerge {
  const existingIds = new Set(current.map((item) => item.id));
  const uniqueNewItems = response.items.filter((item) => !existingIds.has(item.id));
  const items = [...current, ...uniqueNewItems];

  if (response.next === requestedNext) {
    return { items, next: null, issue: "repeated-cursor" };
  }

  if (response.items.length === 0 && response.next !== null) {
    return { items, next: null, issue: "empty-page-with-next" };
  }

  return { items, next: response.next, issue: null };
}
