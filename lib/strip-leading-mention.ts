export function stripLeadingMention(text: string): string {
  return text.replace(/^@[^\s@]+\s?/u, "");
}
