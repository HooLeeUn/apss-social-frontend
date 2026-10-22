import type { ReactNode } from "react";
import ActionsTruncatedText from "./ActionsTruncatedText";

export default function VisitedProfileText({ text, desktop, enabled = true }: { text: string; desktop?: ReactNode; enabled?: boolean }) {
  if (!enabled) return <>{desktop ?? text}</>;
  return <>
    <span className="block xl:hidden"><ActionsTruncatedText key={text} as="span" text={text} popoverLabel={text} className="block truncate" /></span>
    <span className="hidden xl:inline">{desktop ?? text}</span>
  </>;
}
