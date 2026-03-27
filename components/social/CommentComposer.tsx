"use client";

import { KeyboardEvent, useMemo, useRef, useState } from "react";
import { Friend } from "../../lib/social";
import MentionAutocomplete from "./MentionAutocomplete";

interface MentionSelection {
  username: string;
  tokenStart: number;
  tokenEnd: number;
}

interface CommentComposerProps {
  friends: Friend[];
  onSubmit: (payload: { text: string; mentionUsername: string | null }) => Promise<void>;
  loading?: boolean;
  error?: string;
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

export default function CommentComposer({ friends, onSubmit, loading = false, error }: CommentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedMention, setSelectedMention] = useState<MentionSelection | null>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const normalized = mentionQuery.trim().toLowerCase();

    return friends.filter((friend) => {
      if (!normalized) return true;
      return friend.username.toLowerCase().startsWith(normalized);
    });
  }, [friends, mentionQuery]);

  const updateMentionState = (nextText: string, caretIndex: number) => {
    if (selectedMention) {
      const token = nextText.slice(selectedMention.tokenStart, selectedMention.tokenEnd);
      if (token !== `@${selectedMention.username}`) {
        setSelectedMention(null);
      }
    }

    const currentMention = getMentionToken(nextText, caretIndex);
    if (!currentMention) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }

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

    setText(nextText);
    setSelectedMention({ username: friend.username, tokenStart, tokenEnd });
    setMentionQuery(null);
    setMentionStart(null);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextCursor = tokenEnd + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (suggestions.length === 0 ? 0 : (current + 1) % suggestions.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (suggestions.length === 0 ? 0 : (current - 1 + suggestions.length) % suggestions.length));
      return;
    }

    if (event.key === "Enter" && suggestions.length > 0) {
      event.preventDefault();
      handleSelectSuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setMentionQuery(null);
      setMentionStart(null);
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    await onSubmit({
      text: trimmed,
      mentionUsername: selectedMention?.username || null,
    });

    setText("");
    setMentionQuery(null);
    setMentionStart(null);
    setSelectedMention(null);
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-zinc-950/55 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">Comentar película</h3>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          rows={4}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);
            updateMentionState(nextText, event.target.selectionStart ?? nextText.length);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Comparte tu recomendación... Usa @ para mencionar a un amigo"
          className="w-full rounded-xl border border-white/20 bg-black/30 p-3 text-sm text-zinc-100 outline-none transition focus:border-white/40"
        />

        {mentionQuery !== null ? (
          <MentionAutocomplete friends={suggestions} activeIndex={activeIndex} onSelect={handleSelectSuggestion} />
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-400">
          {selectedMention
            ? `Mención válida seleccionada: @${selectedMention.username}`
            : "Si eliges una mención del listado, se enviará como recomendación privada."}
        </p>
        <button
          type="button"
          disabled={loading || text.trim().length === 0}
          onClick={() => void handleSubmit()}
          className="rounded-full border-2 border-white/60 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Publicar"}
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}
