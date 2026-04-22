import { useMemo, useState } from "react";
import { formatSocialDate, SocialComment } from "../../lib/social";
import ReactionButtons from "./ReactionButtons";

interface CommentItemProps {
  comment: SocialComment;
  onReact: (commentId: number | string, reaction: "like" | "dislike" | null) => Promise<void>;
  disabled?: boolean;
  showCard?: boolean;
  badgeLabel?: string;
  onAuthorClick?: (username: string) => void;
  canManage?: boolean;
  isEditing?: boolean;
  editValue?: string;
  onEditValueChange?: (nextValue: string) => void;
  onStartEdit?: (comment: SocialComment) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (comment: SocialComment) => void;
  savingEdit?: boolean;
  actionError?: string;
  onDelete?: (comment: SocialComment) => Promise<void>;
  deleting?: boolean;
}

export default function CommentItem({
  comment,
  onReact,
  disabled = false,
  showCard = true,
  badgeLabel,
  onAuthorClick,
  canManage = false,
  isEditing = false,
  editValue = "",
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  savingEdit = false,
  actionError,
  onDelete,
  deleting = false,
}: CommentItemProps) {
  const initial = comment.authorName.charAt(0).toUpperCase() || "U";
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteDisabled = deleting || savingEdit;
  const saveDisabled = savingEdit || !editValue.trim();
  const trimmedLength = useMemo(() => editValue.trim().length, [editValue]);

  return (
    <article className={showCard ? "rounded-xl border border-white/15 bg-zinc-950/65 p-4" : "py-3"}>
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onAuthorClick?.(comment.authorUsername)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-zinc-900 text-xs font-semibold text-zinc-200"
          >
            {comment.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comment.authorAvatar} alt={comment.authorName} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              initial
            )}
          </button>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onAuthorClick?.(comment.authorUsername)}
              className="truncate text-sm font-semibold text-zinc-100 hover:text-white hover:underline"
            >
              {comment.authorName}
            </button>
            <p className="text-xs text-zinc-400">{formatSocialDate(comment.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/15 bg-black/25 px-2 py-1 text-[11px] font-medium text-zinc-300">
            {badgeLabel ?? (comment.type === "public" ? "Público" : "Dirigido")}
          </span>
          {canManage ? (
            <div className="relative">
              <button
                type="button"
                className="rounded-md border border-white/15 px-2 py-1 text-xs text-zinc-300 transition hover:border-white/35 hover:text-white"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Acciones del comentario"
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-white/15 bg-zinc-950/95 p-1 shadow-lg shadow-black/40">
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-white/10"
                    onClick={() => {
                      onStartEdit?.(comment);
                      setMenuOpen(false);
                      setConfirmDeleteOpen(false);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-300 transition hover:bg-rose-500/20"
                    onClick={() => {
                      setConfirmDeleteOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
              {confirmDeleteOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-rose-400/35 bg-zinc-950/95 p-2 shadow-lg shadow-black/50">
                  <p className="text-xs text-zinc-200">¿Seguro que quieres eliminar este comentario?</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-white/20 px-2 py-1 text-xs text-zinc-200 hover:border-white/40"
                      onClick={() => setConfirmDeleteOpen(false)}
                      disabled={deleteDisabled}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={async () => {
                        if (!onDelete) return;
                        await onDelete(comment);
                        setConfirmDeleteOpen(false);
                      }}
                      disabled={deleteDisabled}
                    >
                      {deleting ? "Eliminando..." : "Confirmar"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {isEditing ? (
        <div className="mb-3">
          <textarea
            value={editValue}
            onChange={(event) => onEditValueChange?.(event.target.value)}
            rows={3}
            className="w-full resize-y rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none transition focus:border-[#86ADE0] focus:ring-2 focus:ring-[#86ADE0]/25"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={savingEdit}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSaveEdit?.(comment)}
              disabled={saveDisabled}
              className="rounded-md border border-[#86ADE0]/45 bg-[#86ADE0]/15 px-3 py-1.5 text-xs font-medium text-[#d7e8ff] transition hover:bg-[#86ADE0]/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
          {trimmedLength === 0 ? <p className="mt-1 text-right text-[11px] text-zinc-500">El comentario no puede quedar vacío.</p> : null}
        </div>
      ) : (
        <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{comment.text}</p>
      )}

      {actionError ? <p className="mb-2 text-xs text-rose-300">{actionError}</p> : null}

      <ReactionButtons comment={comment} onReact={onReact} disabled={disabled} />
    </article>
  );
}
