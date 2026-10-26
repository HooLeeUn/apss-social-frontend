"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../hooks/useI18n";
import { Friend } from "../../lib/social";
import { activeRecipientNames } from "../../lib/directed-presentation";
import MentionAutocomplete from "./MentionAutocomplete";

interface MentionSelection {
  username: string;
  tokenStart: number;
  tokenEnd: number;
}

function normalizeMentionUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

interface CommentComposerProps {
  authenticatedUsername?: string;
  friends: Friend[];
  searchMentionSuggestions: (query: string) => Promise<Friend[]>;
  onSubmit: (payload: { text: string; mentionUsername: string | null; mentionUsernames?: string[] }) => Promise<boolean>;
  loading?: boolean;
  error?: string;
  placeholder?: string;
}

function getMentionToken(value: string, caretIndex: number): { start: number; query: string } | null {
  const uptoCaret = value.slice(0, caretIndex);
  const match = uptoCaret.match(/(?:^|\s)@([\w.]*)$/);
  if (!match || match.index === undefined) return null;

  const atPosition = match.index + match[0].lastIndexOf("@");
  return {
    start: atPosition,
    query: match[1] || "",
  };
}

export default function CommentComposer({ authenticatedUsername, friends, searchMentionSuggestions, onSubmit, loading = false, error, placeholder }: CommentComposerProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedMention, setSelectedMention] = useState<MentionSelection | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [rawMentionSuggestions, setMentionSuggestions] = useState<Friend[]>([]);
  const mentionRequestIdRef = useRef(0);
  const submittingRef = useRef(false);

  const activeRecipients = useMemo(() => activeRecipientNames(text, selectedRecipients), [text, selectedRecipients]);
  const mentionSuggestions = rawMentionSuggestions.filter(friend =>
    friend.username.toLowerCase() !== authenticatedUsername?.toLowerCase() &&
    !activeRecipients.some(name => name.toLowerCase() === friend.username.toLowerCase()));
  const hasValidSelectedMention = activeRecipients.length > 0;

  useEffect(() => {
    const requestId = mentionRequestIdRef.current + 1;
    mentionRequestIdRef.current = requestId;

    if (mentionQuery === null) return;

    console.log("[mentions-debug] Mention search term:", mentionQuery);

    void searchMentionSuggestions(mentionQuery).then(
      (nextSuggestions) => {
        if (mentionRequestIdRef.current !== requestId) return;
        setMentionSuggestions(nextSuggestions);
      },
      () => {
        if (mentionRequestIdRef.current !== requestId) return;
        setMentionSuggestions([]);
      },
    );
  }, [mentionQuery, searchMentionSuggestions]);

  const updateMentionState = (nextText: string, caretIndex: number) => {
    setSelectedRecipients(current => activeRecipientNames(nextText, current));
    if (selectedMention) {
      const token = nextText.slice(selectedMention.tokenStart, selectedMention.tokenEnd);
      if (token !== `@${selectedMention.username}`) {
        setSelectedMention(null);
      }
    }

    const currentMention = getMentionToken(nextText, caretIndex);
    if (!currentMention) {
      setMentionSuggestions([]);
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }

    setMentionSuggestions([]);
    setMentionQuery(currentMention.query);
    setMentionStart(currentMention.start);
    setActiveIndex(0);
  };

  const handleSelectSuggestion = (friend: Friend) => {
    if (mentionStart === null) return;

    const textarea = textareaRef.current;
    const caretIndex = textarea?.selectionStart ?? text.length;

    const nextText = `${text.slice(0, mentionStart)}@${friend.username} ${text.slice(caretIndex)}`;
    const tokenStart = mentionStart;
    const tokenEnd = mentionStart + friend.username.length + 1;
    const nextSelection = { username: friend.username, tokenStart, tokenEnd };

    setText(nextText);
    setSelectedMention(nextSelection);
    setSelectedRecipients(current => [...activeRecipientNames(nextText, current), friend.username]);
    setMentionSuggestions([]);
    setMentionQuery(null);
    setMentionStart(null);
    console.log("[mentions-debug] selected friend object:", friend);
    console.log("[mentions-debug] selected mention object:", nextSelection);
    console.log("[mentions-debug] textarea after selection:", nextText);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextCursor = tokenEnd + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading || submittingRef.current) return;

    const mentionUsername = hasValidSelectedMention ? normalizeMentionUsername(activeRecipients[0] ?? "") : null;
    console.log("[mentions-debug] submit mode:", mentionUsername ? "directed" : "public");
    console.log("[mentions-debug] selected mention object:", selectedMention);
    console.log("[mentions-debug] mentioned_username final:", mentionUsername);
    console.log("[mentions-debug] textarea value:", trimmed);

    submittingRef.current = true;
    try {
      const submitted = await onSubmit({
        text: trimmed,
        mentionUsername,
        mentionUsernames: [...new Set(Array.from(trimmed.matchAll(/(?:^|\s)@([\w.@+-]+)/g), (match) => match[1]))],
      });
      if (!submitted) return;

      setText("");
      setMentionSuggestions([]);
      setMentionQuery(null);
      setMentionStart(null);
      setSelectedMention(null);
      setSelectedRecipients([]);
      textareaRef.current?.blur();
    } finally {
      submittingRef.current = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;

    if (mentionQuery !== null && event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (mentionSuggestions.length === 0 ? 0 : (current + 1) % mentionSuggestions.length));
      return;
    }

    if (mentionQuery !== null && event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (mentionSuggestions.length === 0 ? 0 : (current - 1 + mentionSuggestions.length) % mentionSuggestions.length));
      return;
    }

    if (mentionQuery !== null && event.key === "Enter" && mentionSuggestions.length > 0) {
      event.preventDefault();
      handleSelectSuggestion(mentionSuggestions[activeIndex]);
      return;
    }

    if (mentionQuery !== null && event.key === "Escape") {
      setMentionSuggestions([]);
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }

  };

  return (
    <section className="rounded-2xl bg-zinc-950/55 p-4">
      <div className="relative">
        <textarea autoCorrect="off" spellCheck={false} autoCapitalize="sentences"
          ref={textareaRef}
          value={text}
          rows={2}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);
            updateMentionState(nextText, event.target.selectionStart ?? nextText.length);
          }}
          onKeyDown={handleKeyDown}
          enterKeyHint="enter"
          placeholder={placeholder ?? t("movieDetailCommentPlaceholder")}
          className="block max-h-[4.5rem] min-h-[4.5rem] w-full resize-none overflow-y-auto rounded-xl border border-white/30 bg-black/30 p-3 pr-12 text-sm leading-5 text-zinc-100 placeholder:text-zinc-400/65 outline-none transition focus:border-white/45"
        />
        <button
          type="button"
          aria-label={t("movieDetailPost")}
          disabled={!text.trim() || loading}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void handleSubmit()}
          className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#86ADE0] p-0 leading-none text-white enabled:hover:bg-blue-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86ADE0] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block h-5 w-5 shrink-0">
            <path d="M4 12h16m-7-7 7 7-7 7" />
          </svg>
        </button>

        {mentionQuery !== null ? (
          <MentionAutocomplete anchorRef={textareaRef} friends={mentionSuggestions} activeIndex={activeIndex} onSelect={handleSelectSuggestion} />
        ) : null}
      </div>

      {hasValidSelectedMention && selectedMention ? (
        <p className="mt-2 text-xs text-zinc-400">{`${t("movieDetailValidMention")}: @${selectedMention.username}`}</p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}
