export function stripLeadingMention(text: string, multiple = false): string {
  if (multiple) return text.replace(/^(?:@[^\s@]+(?:\s+|$))+/u, "");
  return text.replace(/^@[^\s@]+\s?/u, "");
}
