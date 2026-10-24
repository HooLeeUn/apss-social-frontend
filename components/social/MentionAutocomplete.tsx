import { type RefObject, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../hooks/useI18n";
import { Friend } from "../../lib/social";
import { mentionPopupPosition } from "../../lib/mention-popup-position";

interface MentionAutocompleteProps {
  friends: Friend[];
  activeIndex: number;
  onSelect: (friend: Friend) => void;
  anchorRef: RefObject<HTMLTextAreaElement | null>;
}

const mobileQuery = "(max-width: 1279px)";
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const isMobile = () => window.matchMedia(mobileQuery).matches;
const serverMobile = () => false;

export default function MentionAutocomplete({ friends, activeIndex, onSelect, anchorRef }: MentionAutocompleteProps) {
  const { t } = useI18n();
  const mobile = useSyncExternalStore(subscribeMobile, isMobile, serverMobile);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!mobile) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;
    const viewport = window.visualViewport;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const bounds = mentionPopupPosition(rect, {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      }, Math.min(208, panel.scrollHeight));
      Object.assign(panel.style, {
        left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`,
        maxHeight: `${bounds.maxHeight}px`, visibility: "visible",
      });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    viewport?.addEventListener("resize", position);
    viewport?.addEventListener("scroll", position);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", position);
      viewport?.removeEventListener("scroll", position);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [mobile, anchorRef, friends]);

  const content = friends.length === 0 ? (
      <div className="rounded-xl border border-white/15 bg-zinc-950/95 p-3 text-sm text-zinc-400 shadow-xl">
        {t("movieDetailNoFriendMatches")}
      </div>
    ) : (
    <ul className={`${mobile ? "" : "max-h-52 overflow-y-auto"} rounded-xl border border-white/20 bg-zinc-950/95 p-1 shadow-xl`}>
      {friends.map((friend, index) => (
        <li key={friend.id}>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onSelect(friend)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              index === activeIndex ? "bg-white/10 text-zinc-100" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/30 text-[11px] font-semibold">
              {friend.username.charAt(0).toUpperCase()}
            </span>
            <span>@{friend.username}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  return mobile ? createPortal(
    <div ref={panelRef} style={{ position: "fixed", visibility: "hidden" }} className="z-[1300] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl">{content}</div>,
    document.body,
  ) : <div className="absolute left-0 right-0 top-full z-20 mt-2">{content}</div>;
}
