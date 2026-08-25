"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppLogo from "../../../components/AppLogo";
import CommentComposer from "../../../components/social/CommentComposer";
import CommentsList from "../../../components/social/CommentsList";
import MovieCard from "../../../components/MovieCard";
import StreamingProviders from "../../../components/StreamingProviders";
import MovieDetailStreamingCountrySelector from "../../../components/MovieDetailStreamingCountrySelector";
import VideoReactionMovieMetadata from "../../../components/VideoReactionMovieMetadata";
import { apiFetch, ApiError, API_BASE_URL } from "../../../lib/api";
import { getToken } from "../../../lib/auth";
import {
  buildMovieDetailEndpoint,
  MOVIE_DETAIL_ENDPOINT_TEMPLATE,
  MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES,
  Movie,
  normalizeMovie,
} from "../../../lib/movies";
import { fetchMovieCredits } from "../../../lib/people";
import {
  buildCommentDetailEndpoint,
  buildReactionEndpoint,
  Friend,
  FRIENDS_ENDPOINT,
  FRIENDS_FALLBACK_ENDPOINTS,
  parseComments,
  parseCommentsPage,
  parseFriends,
  ReactionType,
  SocialComment,
  getUserIdentity,
  UserIdentity,
} from "../../../lib/social";
import { useAppBranding } from "../../../hooks/useAppBranding";
import { useI18n } from "../../../hooks/useI18n";
import { stripLeadingMention } from "../../../lib/strip-leading-mention";
import { getProfilePrivacySettings } from "../../../lib/privacy";
import {
  getMyNotificationsSummary,
  getMyProfile,
  getTopFollowing,
  isRealNotificationId,
  markNotificationsAsReadBatch,
} from "../../../lib/profile-feed/adapters";
import { SocialUser } from "../../../lib/profile-feed/types";
import { resolveMovieTitles, t as translate } from "../../../lib/i18n";
import { onboardingPrepareStepEventName } from "../../../lib/onboarding/types";
import type { OnboardingPrepareAction } from "../../../lib/onboarding/types";

type CommentInputMode = "text-comment" | "video-comment";
type TrailerCompanionView = "reaction" | "public-comments" | "directed-comments";
const TRAILER_COMPANION_SWIPE_THRESHOLD_PX = 56;
const TRAILER_COMPANION_HORIZONTAL_DOMINANCE = 1.25;
const TRAILER_COMPANION_SWIPE_TRANSITION_MS = 260;

const VIDEO_COMMENT_MAX_SECONDS = 20;
const VIDEO_COMMENT_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_COMMENT_PERMISSION_SESSION_KEY = "qnext_video_comment_permission_info_accepted";
const VIDEO_COMMENT_SOUND_SESSION_KEY = "qnext-video-sound";
const VIDEO_COMMENT_VISIBILITY_THRESHOLD = 0.15;
const VIDEO_COMMENT_DOMINANCE_MARGIN = 0.08;
const DESKTOP_CAROUSEL_QUEUE_VISIBILITY_THRESHOLD = 0.5;
// Pause before the phone reaches landscape and resume only after it is clearly
// back inside portrait, avoiding rapid pause/resume around the boundary.
// Preventive physical-tilt hysteresis: stop composing well before landscape,
// and require a stable near-portrait position before recording resumes.
const VIDEO_REACTION_TILT_PAUSE_DEGREES = 65;
const VIDEO_REACTION_TILT_RESUME_DEGREES = 35;
const VIDEO_REACTION_TILT_CONFIRMATION_SAMPLES = 2;
const VIDEO_COMMENT_EXPANDED_SWIPE_THRESHOLD = 56;
const VIDEO_COMMENT_EXPANDED_SWIPE_INTENT_PX = 8;
const VIDEO_COMMENT_EXPANDED_SWIPE_TRANSITION_MS = 200;
const VIDEO_COMMENT_EXPANDED_SWIPE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const VIDEO_REACTION_WIDTH = 720;
const VIDEO_REACTION_HEIGHT = 1280;
// Keep the physically negotiated camera mode independent from the portrait
// recording canvas. This is the front-camera mode used by the proven framing
// reference; the recorded output remains VIDEO_REACTION_WIDTH x HEIGHT.
const VIDEO_REACTION_SOURCE_WIDTH = 1280;
const VIDEO_REACTION_SOURCE_HEIGHT = 720;
const VIDEO_REACTION_SOURCE_ASPECT_RATIO = 16 / 9;
type VideoSoundPreference = "muted" | "sound-on";
const VIDEO_COMMENT_ALLOWED_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
const VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT = "min(calc(100dvh - var(--video-recording-controls-space, 116px) - env(safe-area-inset-bottom)), calc((100vw - 24px) * 16 / 9))";
const VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "clamp(14rem, 36dvh, 18rem)";
const VIDEO_NOTIFICATION_EXTRA_TARGET_LIFT_PX = 24;
const VIDEO_COMMENT_MIME_CANDIDATES = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
const IOS_VIDEO_COMMENT_MIME_CANDIDATES = ["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/webm"];
const VIDEO_COMMENT_DIAGNOSTIC_MIMES = ["video/mp4", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"];
type VideoRecorderState = "idle" | "menu" | "permissionInfo" | "requestingPermission" | "preparingRecorder" | "recording" | "validatingSelected" | "previewRecorded" | "previewSelected" | "uploading" | "error";
interface VideoCommentUser { id: string | number; username: string; avatar: string | null; }
type VideoCommentReaction = "like" | "dislike";
interface VideoComment { id: string | number; user: VideoCommentUser; video_url: string; duration_seconds: number | null; mime_type: string | null; file_size: number | null; created_at: string; updated_at: string; can_delete: boolean; likes_count: number; dislikes_count: number; my_reaction: VideoCommentReaction | null; }
interface VideoCommentsPage { count: number; next: string | null; previous: string | null; results: VideoComment[]; }
interface VideoCommentReactionResponse { video_comment_id: string | number; my_reaction: VideoCommentReaction | null; likes_count: number; dislikes_count: number; }

function waitForNotificationScroll(target: Window | HTMLElement, reducedMotion: boolean): Promise<void> {
  if (reducedMotion) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      target.removeEventListener("scrollend", finish);
      window.clearTimeout(fallback);
      resolve();
    };
    const fallback = window.setTimeout(finish, 800);
    target.addEventListener("scrollend", finish, { once: true });
  });
}

type NotificationDiagnosticLogger = (event: string, details?: Record<string, unknown>) => void;

function AuthenticatedProfileAvatar({ user, label, className, tourTarget, mobileTourTarget }: { user: SocialUser | null; label: string; className: string; tourTarget?: string; mobileTourTarget?: string }) {
  const initials = (user?.username || "U").slice(0, 2).toUpperCase();
  return <Link data-tour-desktop={tourTarget} data-tour-mobile={mobileTourTarget} href="/profile-feed" aria-label={label} className={`block overflow-hidden rounded-full border border-white/20 bg-zinc-800/90 [clip-path:circle(50%)] ${className}`}>
    {user?.avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="" className="block h-full w-full object-cover" />
    ) : <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-200">{initials}</span>}
  </Link>;
}

function VideoCommentReactionButtons({ comment, disabled, expanded = false, className = "", t, onReact }: { comment: VideoComment; disabled: boolean; expanded?: boolean; className?: string; t: (key: Parameters<typeof translate>[1]) => string; onReact: (id: string | number, reaction: VideoCommentReaction) => void }) {
  return <div className={`flex items-center gap-1 ${className}`}>
    {(["like", "dislike"] as const).map((reaction) => {
      const selected = comment.my_reaction === reaction;
      const label = t(reaction === "like" ? "movieDetailLike" : "movieDetailDislike");
      return <button key={reaction} type="button" disabled={disabled} aria-label={label} aria-pressed={selected} title={label} className={`rounded-full font-semibold leading-none transition disabled:opacity-50 ${expanded ? "min-h-9 px-2 py-1.5 text-sm [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]" : "px-1.5 py-1 text-[11px]"} ${selected ? reaction === "like" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200" : expanded ? "bg-transparent text-white hover:bg-white/10" : "bg-black/20 text-zinc-200 hover:bg-black/40"}`} onClick={(event) => { event.stopPropagation(); onReact(comment.id, reaction); }}>
        <span aria-hidden="true">{reaction === "like" ? "👍" : "👎"}</span> {reaction === "like" ? comment.likes_count ?? 0 : comment.dislikes_count ?? 0}
      </button>;
    })}
  </div>;
}
function isIOSWebKitEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Apple Computer/.test(navigator.vendor) && navigator.maxTouchPoints > 1;
}
function getRecorderConfiguration(isIOSWebKit = isIOSWebKitEnvironment()): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return { mimeType: "", extension: "video" };
  const mimeType = (isIOSWebKit ? IOS_VIDEO_COMMENT_MIME_CANDIDATES : VIDEO_COMMENT_MIME_CANDIDATES).find((mime) => MediaRecorder.isTypeSupported(mime)) ?? "";
  const base = mimeType.split(";")[0];
  return { mimeType, extension: base === "video/mp4" ? "mp4" : base === "video/webm" ? "webm" : "video" };
}
function getVideoFileName(mimeType: string): string {
  const base = mimeType.split(";")[0];
  const ext = base === "video/mp4" ? "mp4" : base === "video/webm" ? "webm" : "video";
  return `video-comment-${Date.now()}.${ext}`;
}
function createVideoCommentFile(blob: Blob, actualMimeType: string): File {
  const mimeType = actualMimeType || blob.type || "video/webm";
  return new File([blob], getVideoFileName(mimeType), { type: mimeType });
}
function formatVideoDuration(seconds: number): string {
  const safe = Math.max(0, Math.min(5999, Math.floor(seconds)));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
function hasVideoLikeExtension(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_COMMENT_ALLOWED_EXTENSIONS.includes(extension);
}
function prepareVideoPreview(file: File): string {
  if (file.size <= 0) throw new Error("empty-preview-file");
  return URL.createObjectURL(file);
}
type ContainDestinationRect = { dx: number; dy: number; dw: number; dh: number };
function calculateContainDestinationRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): ContainDestinationRect {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const dw = sourceWidth * scale;
  const dh = sourceHeight * scale;
  return { dx: (targetWidth - dw) / 2, dy: (targetHeight - dh) / 2, dw, dh };
}
function isLandscapeViewport(): boolean {
  if (typeof window === "undefined") return false;
  const orientationType = window.screen.orientation?.type;
  if (orientationType?.startsWith("landscape")) return true;
  if (orientationType?.startsWith("portrait")) return false;
  return window.matchMedia?.("(orientation: landscape)").matches ?? window.innerWidth > window.innerHeight;
}
function calculatePlayableIntersectionRatio(rect: DOMRect, viewportHeight: number, stickyBottom: number): number {
  const visibleTop = Math.max(rect.top, stickyBottom, 0);
  const visibleBottom = Math.min(rect.bottom, viewportHeight);
  return Math.max(0, visibleBottom - visibleTop) / Math.max(1, rect.height);
}
function dedupeVideoComments(existing: VideoComment[], incoming: VideoComment[]): VideoComment[] {
  const seen = new Set<string>();
  return [...existing, ...incoming].filter((item) => {
    const key = String(item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function normalizeVideoCommentsNext(nextValue: string | null): string | null {
  return normalizeEndpointPath(nextValue);
}
function mapVideoCommentError(error: unknown, t: (key: Parameters<typeof translate>[1]) => string): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return t("movieDetailVideoPermissionDenied");
    if (error.name === "NotFoundError") return t("movieDetailVideoCameraUnavailable");
    if (error.name === "NotReadableError" || error.name === "AbortError") return t("movieDetailVideoCameraBusy");
  }
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return t("movieDetailVideoAuthError");
    if (error.status === 413) return t("movieDetailVideoTooLarge");
    if (error.status === 400) {
      const msg = error.message.toLowerCase();
      if (msg.includes("duration") || msg.includes("long") || msg.includes("largo")) return t("movieDetailVideoTooLong");
      if (msg.includes("format") || msg.includes("mime") || msg.includes("unsupported")) return t("movieDetailVideoUnsupportedFormat");
      if (msg.includes("size") || msg.includes("large")) return t("movieDetailVideoTooLarge");
    }
    if (error.status >= 500) return t("movieDetailVideoServerError");
  }
  return t("movieDetailVideoNetworkError");
}
function logVideoCommentDevError(message: string, error: unknown): void {
  if (process.env.NODE_ENV !== "production") console.error(`[video-comments] ${message}`, error);
}
function logRecorderPhaseError(phase: string, error: unknown, mimeType: string, recorder: MediaRecorder | null, stream: MediaStream | null): void {
  if (process.env.NODE_ENV === "production") return;
  console.error("[video-comments] recorder phase failed", {
    phase,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    mimeType,
    recorderState: recorder?.state ?? null,
    audioTracks: stream?.getAudioTracks().length ?? 0,
    videoTracks: stream?.getVideoTracks().length ?? 0,
  });
}


function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function joinApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

function buildMoviePublicSubmitEndpoint(movieId: string): string {
  return `/movies/${encodeURIComponent(movieId)}/comments/`;
}

function buildMovieDirectedSubmitEndpoints(movieId: string): string[] {
  const encodedMovieId = encodeURIComponent(movieId);
  return [`/comments/directed/?movie_id=${encodedMovieId}`, `/movies/${encodedMovieId}/comments/directed/`];
}

function buildMovieDirectedFetchEndpoints(movieId: string): string[] {
  const encodedMovieId = encodeURIComponent(movieId);
  return [
    `/movies/${encodedMovieId}/comments/directed/`,
    `/movies/${encodedMovieId}/comments/directed/received/`,
    `/comments/directed/?movie_id=${encodedMovieId}`,
    `/comments/directed/received/?movie_id=${encodedMovieId}`,
    `/me/messages/?movie_id=${encodedMovieId}`,
    `/me/messages/`,
  ];
}

interface DirectedConversation {
  key: string;
  counterpartKey: string;
  otherUsername: string | null;
  otherDisplayName: string;
  otherAvatar: string | null;
  restrictedCurrentUser: boolean;
  messages: SocialComment[];
  messagesEndpoint: string | null;
  next: string | null;
  lastMessageAt: string | null;
}

interface PendingDirectedNotificationTarget {
  actorId: string | null;
  actorUsername: string | null;
  commentId: string | null;
  conversationKey: string | null;
  stage: "find-conversation" | "open-conversation" | "scroll-to-message";
}


function isSeriesContentType(contentType: string | null | undefined): boolean {
  const normalized = (contentType ?? "").trim().toLowerCase();
  return normalized === "series" || normalized === "tv series" || normalized === "tvseries";
}

function normalizeEndpointPath(nextValue: string | null): string | null {
  if (!nextValue) return null;
  if (nextValue.startsWith("http")) {
    try {
      const url = new URL(nextValue);
      return `${url.pathname}${url.search}`.replace(/^\/api/, "") || null;
    } catch {
      return null;
    }
  }
  return nextValue;
}

function mergeUniqueMessages(existing: SocialComment[], incoming: SocialComment[]): SocialComment[] {
  const byId = new Map<string, SocialComment>();
  existing.forEach((message) => {
    byId.set(String(message.id), message);
  });
  incoming.forEach((message) => {
    byId.set(String(message.id), message);
  });
  return [...byId.values()].sort((a, b) => (a.createdAt && b.createdAt ? b.createdAt.localeCompare(a.createdAt) : 0));
}

function mergeDirectedConversationSnapshots(
  existing: DirectedConversation[],
  incoming: DirectedConversation[],
): DirectedConversation[] {
  const existingByKey = new Map(existing.map((conversation) => [conversation.key, conversation]));
  const merged = incoming.map((conversation) => {
    const current = existingByKey.get(conversation.key);
    return current
      ? { ...conversation, messages: mergeUniqueMessages(current.messages, conversation.messages) }
      : conversation;
  });
  const incomingKeys = new Set(incoming.map((conversation) => conversation.key));
  return [...merged, ...existing.filter((conversation) => !incomingKeys.has(conversation.key))].sort((a, b) =>
    a.lastMessageAt && b.lastMessageAt ? b.lastMessageAt.localeCompare(a.lastMessageAt) : 0,
  );
}

function normalizeId(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/^@+/, "").trim();
  return normalized || null;
}

function isSyntheticUserLabel(value: string | null | undefined): boolean {
  const normalized = normalizeUsername(value)?.toLowerCase();
  if (!normalized) return false;
  return normalized === "usuario" || /^usuario-\d+$/.test(normalized);
}

function isUsableDisplayName(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim();
  return normalized.length > 0 && !isSyntheticUserLabel(normalized);
}

function pickBestUserValue(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentSynthetic = isSyntheticUserLabel(current);
  const candidateSynthetic = isSyntheticUserLabel(candidate);
  if (currentSynthetic && !candidateSynthetic) return candidate;
  if (!currentSynthetic && candidateSynthetic) return current;
  return current;
}

function pickFirstPresent<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

interface ConversationCounterpartContext {
  preferredId: string | null;
  preferredUsername: string | null;
  preferredDisplayName: string | null;
  preferredAvatar: string | null;
  fallbackMessageId: string | null;
  restrictedCurrentUser: boolean;
}

function resolveIdentityFromCandidates(candidates: UserIdentity[]): UserIdentity {
  const withNonSyntheticUsername = candidates.find(
    (candidate) => Boolean(candidate.username) && !isSyntheticUserLabel(candidate.username),
  );
  if (withNonSyntheticUsername) return withNonSyntheticUsername;

  const withUsername = candidates.find((candidate) => Boolean(candidate.username));
  if (withUsername) return withUsername;

  const withDisplayName = candidates.find((candidate) => Boolean(candidate.displayName));
  if (withDisplayName) return withDisplayName;

  const withId = candidates.find((candidate) => candidate.id !== null && candidate.id !== undefined);
  if (withId) return withId;

  return {
    id: null,
    username: null,
    displayName: null,
    avatar: null,
  };
}

function resolveDirectedConversationUser(
  item: Record<string, unknown>,
  direction?: "sent" | "received",
): {
  username: string | null;
  displayName: string | null;
  id: string | null;
  avatar: string | null;
} {
  const previewFirstSnake = toRecord(Array.isArray(item.messages_preview) ? item.messages_preview[0] : null);
  const previewFirstCamel = toRecord(Array.isArray(item.messagesPreview) ? item.messagesPreview[0] : null);
  const previewAuthorSnake = toRecord(previewFirstSnake?.author ?? previewFirstSnake?.sender);
  const previewAuthorCamel = toRecord(previewFirstCamel?.author ?? previewFirstCamel?.sender);

  const counterpartIdentity = getUserIdentity(item.counterpart);
  const recipientIdentity = getUserIdentity(item.recipient);
  const otherUserSnakeIdentity = getUserIdentity(item.other_user);
  const otherUserCamelIdentity = getUserIdentity(item.otherUser);
  const previewCounterpartSnakeIdentity = getUserIdentity(previewFirstSnake?.counterpart);
  const previewRecipientSnakeIdentity = getUserIdentity(previewFirstSnake?.recipient);
  const previewCounterpartCamelIdentity = getUserIdentity(previewFirstCamel?.counterpart);
  const previewRecipientCamelIdentity = getUserIdentity(previewFirstCamel?.recipient);
  const previewAuthorSnakeIdentity = getUserIdentity(previewAuthorSnake);
  const previewAuthorCamelIdentity = getUserIdentity(previewAuthorCamel);

  const baseOrderedCandidates = [
    counterpartIdentity,
    recipientIdentity,
    otherUserSnakeIdentity,
    otherUserCamelIdentity,
    previewCounterpartSnakeIdentity,
    previewRecipientSnakeIdentity,
    previewCounterpartCamelIdentity,
    previewRecipientCamelIdentity,
  ];

  const directionOrderedCandidates =
    direction === "sent"
      ? [
          recipientIdentity,
          counterpartIdentity,
          ...baseOrderedCandidates,
        ]
      : direction === "received"
        ? [
            counterpartIdentity,
            previewAuthorSnakeIdentity,
            previewAuthorCamelIdentity,
            ...baseOrderedCandidates,
          ]
        : baseOrderedCandidates;

  const resolvedIdentity = resolveIdentityFromCandidates(directionOrderedCandidates);

  return {
    username: resolvedIdentity.username,
    displayName: resolvedIdentity.displayName,
    id: normalizeId(resolvedIdentity.id),
    avatar: resolvedIdentity.avatar,
  };
}

function getConversationCounterpartContext(conversationRecord: Record<string, unknown>): ConversationCounterpartContext {
  const resolvedDirectionRaw = pickFirstPresent(
    conversationRecord.direction,
    conversationRecord.message_direction,
    conversationRecord.messageDirection,
  );
  const normalizedDirection = typeof resolvedDirectionRaw === "string" ? resolvedDirectionRaw.trim().toLowerCase() : "";
  const resolvedDirection = normalizedDirection === "sent" || normalizedDirection === "received" ? normalizedDirection : undefined;
  const resolvedUser = resolveDirectedConversationUser(conversationRecord, resolvedDirection);
  const messagesPreview = Array.isArray(conversationRecord.messages_preview)
    ? conversationRecord.messages_preview
    : Array.isArray(conversationRecord.messagesPreview)
      ? conversationRecord.messagesPreview
      : [];
  const previewFirst = toRecord(messagesPreview[0]);
  const counterpartRecord = toRecord(conversationRecord.counterpart);
  const otherUserRecord = toRecord(conversationRecord.other_user ?? conversationRecord.otherUser);

  const fallbackMessageId = normalizeId(
    pickFirstPresent(
      previewFirst?.id as number | string | null | undefined,
      previewFirst?.comment_id as number | string | null | undefined,
      conversationRecord.id as number | string | null | undefined,
    ),
  );

  return {
    preferredId: resolvedUser.id,
    preferredUsername: resolvedUser.username,
    preferredDisplayName: resolvedUser.displayName,
    preferredAvatar: resolvedUser.avatar,
    fallbackMessageId,
    restrictedCurrentUser:
      conversationRecord.restricted_current_user === true ||
      counterpartRecord?.restricted_current_user === true ||
      otherUserRecord?.restricted_current_user === true,
  };
}

function getConversationMessagesEndpoint(conversationRecord: Record<string, unknown>): string | null {
  const messagesEndpointRaw = pickFirstPresent(
    conversationRecord.messages_endpoint as string | null | undefined,
    conversationRecord.messagesEndpoint as string | null | undefined,
  );
  return typeof messagesEndpointRaw === "string" ? normalizeEndpointPath(messagesEndpointRaw) : null;
}

function buildCounterpartData(
  message: SocialComment,
  authenticatedUsername: string,
  conversationContext?: ConversationCounterpartContext,
): {
  counterpartKey: string;
  username: string | null;
  displayName: string;
  avatar: string | null;
  direction: "sent" | "received";
} {
  const explicitDirection = message.direction;
  const normalizedAuthenticatedUsername = normalizeUsername(authenticatedUsername)?.toLowerCase();
  const normalizedAuthorUsername = normalizeUsername(message.authorUsername)?.toLowerCase();
  const inferredSentByMe = Boolean(
    normalizedAuthenticatedUsername && normalizedAuthorUsername && normalizedAuthorUsername === normalizedAuthenticatedUsername,
  );
  const isSentByMe = explicitDirection ? explicitDirection === "sent" : inferredSentByMe;

  const normalizedAuthorId = normalizeId(message.authorId);
  const normalizedCounterpartId = normalizeId(message.counterpartId);
  const normalizedTargetUserId = normalizeId(message.targetUserId);
  const counterpartId =
    conversationContext?.preferredId ?? normalizedCounterpartId ?? (isSentByMe ? normalizedTargetUserId : normalizedAuthorId);
  const counterpartUsername = normalizeUsername(message.counterpartUsername);
  const inferredUsername = normalizeUsername(isSentByMe ? message.recipientName : message.authorUsername);
  const username = conversationContext?.preferredUsername ?? counterpartUsername ?? inferredUsername;
  const hasExplicitCounterpart = Boolean(counterpartId || username);
  const displayName = isUsableDisplayName(message.counterpartName)
    ? String(message.counterpartName).trim()
    : conversationContext?.preferredDisplayName ?? username ?? (hasExplicitCounterpart ? inferredUsername ?? "Usuario" : "Usuario");

  const conversationKey =
    counterpartId
      ? `counterpart:${counterpartId}`
      : username
        ? `username:${username.toLowerCase()}`
        : `message:${conversationContext?.fallbackMessageId ?? normalizeId(message.id) ?? Date.now().toString()}`;

  return {
    counterpartKey: conversationKey,
    username,
    displayName,
    avatar: conversationContext?.preferredAvatar ?? (isSentByMe ? null : message.authorAvatar),
    direction: isSentByMe ? "sent" : "received",
  };
}

function groupDirectedConversations(
  payload: unknown,
  authenticatedUsername: string,
  currentMovieId: string,
  allowMissingMovieId = true,
): DirectedConversation[] {
  const root = toRecord(payload);
  const rootData = toRecord(root?.data);
  const explicitConversations =
    (Array.isArray(root?.conversations) ? root?.conversations : null) ||
    (Array.isArray(rootData?.conversations) ? rootData?.conversations : null) ||
    (Array.isArray(root?.results) ? root?.results : null) ||
    (Array.isArray(rootData?.results) ? rootData?.results : null) ||
    (Array.isArray(root?.items) ? root?.items : null) ||
    (Array.isArray(rootData?.items) ? rootData?.items : null);

  const parsedMessagesFromConversations: Array<{
    message: SocialComment;
    context?: ConversationCounterpartContext;
    messagesEndpoint?: string | null;
    conversationNext?: string | null;
  }> = Array.isArray(explicitConversations)
    ? explicitConversations.flatMap((entry) => {
        const record = toRecord(entry);
        if (!record) return [];
        const context = getConversationCounterpartContext(record);
        const parsed = parseCommentsPage(
          pickFirstPresent(record.messages, record.messages_preview, record.messagesPreview, record) ?? record,
          "directed",
        );
        const messagesEndpoint = getConversationMessagesEndpoint(record);
        return parsed.comments.map((message) => ({
          message,
          context,
          messagesEndpoint,
          conversationNext: normalizeEndpointPath(parsed.next),
        }));
      })
    : [];

  const flatComments =
    parsedMessagesFromConversations.length > 0
      ? parsedMessagesFromConversations
      : parseComments(payload, "directed").map((message) => ({
          message,
          context: undefined,
          messagesEndpoint: undefined,
          conversationNext: undefined,
        }));
  const byConversation = new Map<string, DirectedConversation>();
  const normalizedMovieId = normalizeId(currentMovieId);

  const commentsForMovie = normalizedMovieId
    ? flatComments.filter(({ message }) => {
        const messageMovieId = normalizeId(message.movieId);
        return allowMissingMovieId ? !messageMovieId || messageMovieId === normalizedMovieId : messageMovieId === normalizedMovieId;
      })
    : flatComments;

  commentsForMovie.forEach(({ message, context, messagesEndpoint, conversationNext }) => {
    const counterpart = buildCounterpartData(message, authenticatedUsername, context);
    const existing = byConversation.get(counterpart.counterpartKey);

    const hydratedUsername = pickBestUserValue(existing?.otherUsername ?? null, counterpart.username);
    const hydratedDisplayName = isUsableDisplayName(existing?.otherDisplayName)
      ? existing?.otherDisplayName ?? ""
      : isUsableDisplayName(counterpart.displayName)
        ? counterpart.displayName
        : hydratedUsername || "Usuario";
    const hydratedAvatar = existing?.otherAvatar ?? counterpart.avatar;

    const directionMessage: SocialComment = {
      ...message,
      direction: counterpart.direction,
      authorRestrictedCurrentUser:
        counterpart.direction === "received" && (context?.restrictedCurrentUser === true || message.authorRestrictedCurrentUser),
    };
    const sortedMessages = mergeUniqueMessages(existing?.messages ?? [], [directionMessage]);
    byConversation.set(counterpart.counterpartKey, {
      key: `conversation-${counterpart.counterpartKey}`,
      counterpartKey: counterpart.counterpartKey,
      otherUsername: hydratedUsername,
      otherDisplayName: hydratedDisplayName,
      otherAvatar: hydratedAvatar,
      restrictedCurrentUser: existing?.restrictedCurrentUser === true || context?.restrictedCurrentUser === true,
      messages: sortedMessages,
      messagesEndpoint: existing?.messagesEndpoint ?? messagesEndpoint ?? null,
      next: existing?.next ?? conversationNext ?? null,
      lastMessageAt: sortedMessages[0]?.createdAt ?? null,
    });
  });

  return [...byConversation.values()].sort((a, b) =>
    a.lastMessageAt && b.lastMessageAt ? b.lastMessageAt.localeCompare(a.lastMessageAt) : 0,
  );
}

async function debugApiRequest(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Token ${token}`);
  }

  const url = joinApiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    method,
    headers,
  });

  const rawText = await response.text();
  let parsedBody: unknown = rawText;

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, rawText || `HTTP ${response.status}`);
  }

  return {
    endpoint,
    url,
    method,
    status: response.status,
    body: parsedBody,
  };
}

async function fetchWithFallbacks<T>(
  endpoints: string[],
  logTag: "[mentions-debug]" | "[movie-detail-debug]",
): Promise<{ payload: T; endpoint: string; usedFallback: boolean }> {
  let lastError: unknown = null;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    try {
      const payload = (await apiFetch(endpoint)) as T;
      console.log(logTag, "Endpoint success:", { endpoint, isOfficial: index === 0 });
      return { payload, endpoint, usedFallback: index > 0 };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && [404, 405].includes(error.status) && index < endpoints.length - 1) {
        console.log(logTag, "Endpoint fallback:", {
          attemptedEndpoint: endpoint,
          status: error.status,
          nextEndpoint: endpoints[index + 1],
        });
        continue;
      }

      console.log(logTag, "Endpoint error:", { endpoint, error });
      throw error;
    }
  }

  throw lastError ?? new Error("No endpoint available.");
}

async function fetchDirectedConversationsWithFallbacks(
  endpoints: string[],
  authenticatedUsername: string,
  movieId: string,
): Promise<{ conversations: DirectedConversation[]; payload: unknown; endpoint: string; usedFallback: boolean }> {
  let lastError: unknown = null;
  let lastEmptyResult: { conversations: DirectedConversation[]; payload: unknown; endpoint: string; usedFallback: boolean } | null = null;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];

    try {
      const payload = await apiFetch(endpoint);
      const conversations = groupDirectedConversations(payload, authenticatedUsername, movieId, !endpoint.startsWith("/me/messages"));
      const result = { conversations, payload, endpoint, usedFallback: index > 0 };

      console.log("[movie-detail-debug] Endpoint success:", {
        endpoint,
        isOfficial: index === 0,
        conversations: conversations.length,
      });

      if (conversations.length > 0) return result;
      lastEmptyResult = result;

      if (index < endpoints.length - 1) {
        console.log("[movie-detail-debug] Empty directed response fallback:", {
          attemptedEndpoint: endpoint,
          nextEndpoint: endpoints[index + 1],
        });
      }
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && [404, 405].includes(error.status) && index < endpoints.length - 1) {
        console.log("[movie-detail-debug] Endpoint fallback:", {
          attemptedEndpoint: endpoint,
          status: error.status,
          nextEndpoint: endpoints[index + 1],
        });
        continue;
      }

      console.log("[movie-detail-debug] Endpoint error:", { endpoint, error });
      throw error;
    }
  }

  if (lastEmptyResult) return lastEmptyResult;
  throw lastError ?? new Error("No endpoint available.");
}

function applyReactionToCollection(
  collection: SocialComment[],
  commentId: number | string,
  nextReaction: ReactionType,
): SocialComment[] {
  return collection.map((comment) => {
    if (String(comment.id) !== String(commentId)) return comment;

    let likesCount = comment.likesCount;
    let dislikesCount = comment.dislikesCount;

    if (comment.myReaction === "like") likesCount = Math.max(0, likesCount - 1);
    if (comment.myReaction === "dislike") dislikesCount = Math.max(0, dislikesCount - 1);

    if (nextReaction === "like") likesCount += 1;
    if (nextReaction === "dislike") dislikesCount += 1;

    return {
      ...comment,
      myReaction: nextReaction,
      likesCount,
      dislikesCount,
    };
  });
}

function applyReactionResultToCollection(
  collection: SocialComment[],
  commentId: number | string,
  payload: unknown,
): SocialComment[] {
  const record = toRecord(payload);
  if (!record) return collection;

  const payloadCommentId = record.comment_id;
  if (payloadCommentId === undefined || String(payloadCommentId) !== String(commentId)) {
    return collection;
  }

  const myReactionRaw = typeof record.my_reaction === "string" ? record.my_reaction.toLowerCase() : null;
  const myReaction: ReactionType = myReactionRaw === "like" || myReactionRaw === "dislike" ? myReactionRaw : null;
  const likesCount = typeof record.likes_count === "number" && Number.isFinite(record.likes_count) ? record.likes_count : null;
  const dislikesCount =
    typeof record.dislikes_count === "number" && Number.isFinite(record.dislikes_count) ? record.dislikes_count : null;

  if (likesCount === null || dislikesCount === null) return collection;

  return collection.map((comment) =>
    String(comment.id) === String(commentId)
      ? {
          ...comment,
          myReaction,
          likesCount,
          dislikesCount,
        }
      : comment,
  );
}

function updateCommentTextInCollection(collection: SocialComment[], commentId: number | string, nextText: string): SocialComment[] {
  return collection.map((comment) => (String(comment.id) === String(commentId) ? { ...comment, text: nextText } : comment));
}

function removeCommentFromCollection(collection: SocialComment[], commentId: number | string): SocialComment[] {
  return collection.filter((comment) => String(comment.id) !== String(commentId));
}


interface CommentFilterUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function buildCommentFilterDisplayName(firstName: string | null | undefined, lastName: string | null | undefined, displayName?: string | null): string | null {
  const fullName = [firstName, lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || displayName?.trim() || null;
}

function getCommentFilterUserKey(user: CommentFilterUser): string {
  return normalizeUsername(user.username)?.toLowerCase() || `id:${user.id}`;
}

function getCommentFilterUserLabel(user: CommentFilterUser): string {
  return user.displayName || user.username || "Usuario";
}

function getCommentFilterUserDropdownLabel(user: CommentFilterUser): string {
  return user.displayName || (user.username ? `@${user.username}` : "Usuario");
}

function doesPublicCommentBelongToUser(comment: SocialComment, user: CommentFilterUser): boolean {
  const userId = normalizeId(user.id);
  const userUsername = normalizeUsername(user.username)?.toLowerCase();
  const commentAuthorId = normalizeId(comment.authorId);
  const commentAuthorUsername = normalizeUsername(comment.authorUsername)?.toLowerCase();

  return Boolean((userId && commentAuthorId === userId) || (userUsername && commentAuthorUsername === userUsername));
}

function doesConversationBelongToUser(conversation: DirectedConversation, user: CommentFilterUser): boolean {
  const userId = normalizeId(user.id);
  const userUsername = normalizeUsername(user.username)?.toLowerCase();
  const normalizedCounterpartKey = conversation.counterpartKey.toLowerCase();
  const conversationUsername = normalizeUsername(conversation.otherUsername)?.toLowerCase();

  return Boolean(
    (userId && normalizedCounterpartKey === `counterpart:${userId}`) ||
      (userUsername && (conversationUsername === userUsername || normalizedCounterpartKey === `username:${userUsername}`)),
  );
}

function mergeCommentFilterUsers(...groups: CommentFilterUser[][]): CommentFilterUser[] {
  const usersByKey = new Map<string, CommentFilterUser>();

  groups.flat().forEach((user) => {
    const key = getCommentFilterUserKey(user);
    const existing = usersByKey.get(key);
    if (!existing) {
      usersByKey.set(key, user);
      return;
    }

    usersByKey.set(key, {
      ...existing,
      id: existing.id || user.id,
      displayName: existing.displayName || user.displayName,
      avatarUrl: existing.avatarUrl || user.avatarUrl,
    });
  });

  return [...usersByKey.values()].sort((a, b) => getCommentFilterUserLabel(a).localeCompare(getCommentFilterUserLabel(b)));
}

interface CommentUserSearchProps {
  users: CommentFilterUser[];
  query: string;
  selectedUser: CommentFilterUser | null;
  isOpen: boolean;
  placeholder: string;
  allLabel: string;
  hasContentLabel: string;
  noContentLabel: string;
  getHasContent: (user: CommentFilterUser) => boolean;
  onQueryChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (user: CommentFilterUser | null) => void;
}

function CommentUserSearch({
  users,
  query,
  selectedUser,
  isOpen,
  placeholder,
  allLabel,
  hasContentLabel,
  noContentLabel,
  getHasContent,
  onQueryChange,
  onOpenChange,
  onSelect,
}: CommentUserSearchProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const shouldShowDropdown = isOpen && normalizedQuery.length > 0;
  const visibleUsers = users.filter((user) => {
    const label = getCommentFilterUserLabel(user).toLowerCase();
    const username = normalizeUsername(user.username)?.toLowerCase() ?? "";
    return label.includes(normalizedQuery) || username.includes(normalizedQuery);
  });

  return (
    <div className="relative w-full sm:w-56">
      <div className="flex items-center rounded-full border border-[#86ADE0]/30 bg-zinc-950/80 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:border-[#86ADE0]/70">
        <input
          type="text"
          value={selectedUser ? getCommentFilterUserLabel(selectedUser) : query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            onSelect(null);
            onQueryChange(nextQuery);
            onOpenChange(nextQuery.trim().length > 0);
          }}
          onBlur={() => onOpenChange(false)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        {selectedUser || query ? (
          <button
            type="button"
            aria-label={allLabel}
            className="ml-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelect(null);
              onQueryChange("");
              onOpenChange(false);
            }}
          >
            ×
          </button>
        ) : null}
      </div>

      {shouldShowDropdown ? (
        <div
          className="scrollbar-dark mt-2 mb-3 max-h-64 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-[#86ADE0]/20 bg-[#0b1f3a]/35 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28),0_0_18px_rgba(134,173,224,0.08)] backdrop-blur xl:absolute xl:right-0 xl:z-40 xl:mb-0 xl:border-white/10 xl:bg-zinc-950/95 xl:shadow-2xl xl:shadow-black/50"
          onMouseDown={(event) => event.preventDefault()}
        >
          {visibleUsers.map((user) => {
            const hasContent = getHasContent(user);
            return (
              <button
                type="button"
                key={getCommentFilterUserKey(user)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-2 text-left transition hover:border-[#86ADE0]/25 hover:bg-[#86ADE0]/10"
                onClick={() => {
                  onSelect(user);
                  onQueryChange("");
                  onOpenChange(false);
                }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-zinc-900 text-[11px] font-semibold text-zinc-200">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt={getCommentFilterUserLabel(user)} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    getCommentFilterUserLabel(user).charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-zinc-100">{getCommentFilterUserDropdownLabel(user)}</span>
                  <span className={`mt-0.5 block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasContent ? "bg-emerald-500/15 text-emerald-200" : "bg-zinc-800 text-zinc-400"}`}>
                    {hasContent ? hasContentLabel : noContentLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function MobileVideoComments({ movieId, movieTitle, moviePoster, active, notificationTarget, onNotificationTargetConsumed, logNotificationTarget, t, onAuthorClick }: { movieId: string; movieTitle: string; moviePoster: string | null; active: boolean; notificationTarget: { id: string; reaction: VideoCommentReaction | null } | null; onNotificationTargetConsumed: () => void; logNotificationTarget: NotificationDiagnosticLogger; t: (key: Parameters<typeof translate>[1]) => string; onAuthorClick: (username: string) => void }) {
  const router = useRouter();
  const [recorderState, setRecorderState] = useState<VideoRecorderState>("idle");
  const [error, setError] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewPlayable, setPreviewPlayable] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState(9 / 16);
  const [previewOrigin, setPreviewOrigin] = useState<"recorded" | "selected" | null>(null);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [comments, setComments] = useState<VideoComment[]>([]);
  const commentIds = useMemo(() => comments.map((item) => String(item.id)).join(","), [comments]);
  const [, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [notificationReactionOverlay, setNotificationReactionOverlay] = useState<{ id: string; reaction: VideoCommentReaction; reducedMotion: boolean } | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [reactingIds, setReactingIds] = useState<Record<string, boolean>>({});
  const reactingIdsRef = useRef(new Set<string>());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasFrameRef = useRef<number | null>(null);
  const compositionLoggedRef = useRef(false);
  const recorderOutputStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [optionsMenuPosition, setOptionsMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileHistoryScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollHistoryLeft, setCanScrollHistoryLeft] = useState(false);
  const [canScrollHistoryRight, setCanScrollHistoryRight] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const stopModeRef = useRef<"idle" | "menu" | "previewRecorded">("previewRecorded");
  const currentMimeTypeRef = useRef("");
  const requestSeqRef = useRef(0);
  const bodyOverflowRef = useRef<string | null>(null);
  const permissionInfoAcceptedRef = useRef(false);
  const previewTimeoutRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewDurationRef = useRef<number | null>(null);
  const previewPlayableRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const previewFallbackAttemptedRef = useRef(false);
  const [videoDebugEntries, setVideoDebugEntries] = useState<string[]>([]);
  const videoDebugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("videoDebug") === "1";
  const iosWebKit = isIOSWebKitEnvironment();
  const reloadFirstPageRef = useRef<() => Promise<void>>(async () => undefined);
  const historyVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const historyObserverRef = useRef<IntersectionObserver | null>(null);
  const visibilityRef = useRef(new Map<string, number>());
  const pausedByUserRef = useRef(new Set<string>());
  const endedRef = useRef(new Set<string>());
  const activeVideoIdRef = useRef<string | null>(null);
  const [playerStates, setPlayerStates] = useState<Record<string, { paused: boolean; muted: boolean }>>({});
  const [soundPreference, setSoundPreference] = useState<VideoSoundPreference>("muted");
  const soundPreferenceRef = useRef<VideoSoundPreference>("muted");
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [orientationPaused, setOrientationPaused] = useState(false);
  const orientationPausedRef = useRef(false);
  const orientationUnsafeRef = useRef(false);
  const tiltUnsafeRef = useRef(false);
  const expandedVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const expandedAdjacentVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const expandedReadyVideoIdsRef = useRef(new Set<string>());
  const pendingExpandedSwipeDirectionRef = useRef<-1 | 1 | null>(null);
  const expandedTransitionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showExpandedTransitionFrame, setShowExpandedTransitionFrame] = useState(false);
  const expandedTouchStartRef = useRef<{ x: number; y: number; vertical: boolean | null } | null>(null);
  const suppressExpandedTapRef = useRef(false);
  const expandedSwipeTimerRef = useRef<number | null>(null);
  const [expandedDragOffset, setExpandedDragOffset] = useState(0);
  const [expandedDragAnimating, setExpandedDragAnimating] = useState(false);
  const expandedScrollLockRef = useRef<{ bodyOverflow: string; rootOverflow: string; bodyPosition: string; bodyTop: string } | null>(null);
  const expandedOpenRef = useRef(false);
  const desktopRecordingRef = useRef(false);
  const carouselScrollTimerRef = useRef<number | null>(null);
  const carouselScrollingRef = useRef(false);
  const processedNotificationTargetRef = useRef<string | null>(null);
  const notificationPositioningRef = useRef(false);

  const appendVideoDebugLog = useCallback((event: string, details: Record<string, unknown>) => {
    if (!videoDebugEnabled) return;
    setVideoDebugEntries((entries) => [...entries.slice(-39), `${event} ${JSON.stringify(details)}`]);
  }, [videoDebugEnabled]);

  useEffect(() => {
    if (!videoDebugEnabled) return;
    appendVideoDebugLog("IOS_ENVIRONMENT", {
      platform: navigator.platform,
      userAgent: navigator.userAgent.slice(0, 160),
      mediaRecorderAvailable: typeof MediaRecorder !== "undefined",
      supportedMimes: Object.fromEntries(VIDEO_COMMENT_DIAGNOSTIC_MIMES.map((mime) => [mime, typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mime)])),
    });
  // Diagnostic snapshot must be emitted once per mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDebugEnabled]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(VIDEO_COMMENT_SOUND_SESSION_KEY);
      const preference: VideoSoundPreference = stored === "on" ? "sound-on" : "muted";
      soundPreferenceRef.current = preference;
      setSoundPreference(preference);
    } catch {
      soundPreferenceRef.current = "muted";
    }
  }, []);

  const syncPlayerState = useCallback((video: HTMLVideoElement) => {
    const id = video.dataset.videoCommentId ?? video.dataset.expandedVideoId;
    if (!id) return;
    setPlayerStates((states) => ({ ...states, [id]: { paused: video.paused, muted: video.muted } }));
  }, []);

  const applyVideoSoundPreference = useCallback((preference: VideoSoundPreference, video: HTMLVideoElement) => {
    soundPreferenceRef.current = preference;
    setSoundPreference(preference);
    try { sessionStorage.setItem(VIDEO_COMMENT_SOUND_SESSION_KEY, preference === "sound-on" ? "on" : "off"); } catch { /* Storage can be unavailable in private contexts. */ }
    video.muted = preference === "muted";
    window.dispatchEvent(new CustomEvent("qnext:reaction-muted-change", { detail: { muted: preference === "muted" } }));
    syncPlayerState(video);
  }, [syncPlayerState]);

  const logHistoryPlayerGeometry = useCallback((phase: string, video: HTMLVideoElement) => {
    if (!videoDebugEnabled) return;
    const wrapper = video.parentElement;
    const videoRect = video.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect();
    const style = getComputedStyle(video);
    appendVideoDebugLog("HISTORY_PLAYER_GEOMETRY", {
      phase,
      id: video.dataset.videoCommentId ?? null,
      paused: video.paused,
      video: { x: videoRect.x, y: videoRect.y, width: videoRect.width, height: videoRect.height },
      wrapper: wrapperRect ? { x: wrapperRect.x, y: wrapperRect.y, width: wrapperRect.width, height: wrapperRect.height } : null,
      computed: { width: style.width, height: style.height, maxWidth: style.maxWidth, maxHeight: style.maxHeight, objectFit: style.objectFit, objectPosition: style.objectPosition, transform: style.transform, padding: style.padding, margin: style.margin },
      intrinsic: { width: video.videoWidth, height: video.videoHeight },
    });
  }, [appendVideoDebugLog, videoDebugEnabled]);

  const lockHistoryPlayerGeometry = useCallback((video: HTMLVideoElement) => {
    if (video.dataset.geometryLocked === "true") return;
    const wrapper = video.parentElement;
    if (!wrapper) return;
    const rect = video.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.maxHeight = "none";
    video.dataset.geometryLocked = "true";
    logHistoryPlayerGeometry("metadata-locked", video);
  }, [logHistoryPlayerGeometry]);

  const pauseOtherHistoryVideos = useCallback((nextId: string) => {
    historyVideosRef.current.forEach((video, id) => {
      if (id === nextId) return;
      video.pause();
      video.currentTime = 0;
      pausedByUserRef.current.delete(id);
      endedRef.current.delete(id);
    });
  }, []);

  const playHistoryVideo = useCallback(async (id: string, manual = false) => {
    if (expandedOpenRef.current) return;
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    pauseOtherHistoryVideos(id);
    activeVideoIdRef.current = id;
    if (manual) {
      pausedByUserRef.current.delete(id);
      endedRef.current.delete(id);
    }
    video.muted = soundPreferenceRef.current !== "sound-on";
    if (!video.muted) window.dispatchEvent(new CustomEvent("qnext:reaction-muted-change", { detail: { muted: false } }));
    try {
      await video.play();
    } catch {
      if (!video.muted && !manual) {
        video.muted = true;
        try { await video.play(); } catch { /* Autoplay may still be unavailable; scrolling must continue. */ }
      }
    }
    syncPlayerState(video);
  }, [pauseOtherHistoryVideos, syncPlayerState]);

  const getVisibleDesktopHistoryIds = useCallback(() => {
    const container = historyScrollRef.current;
    if (!container || !window.matchMedia("(min-width: 1280px)").matches || document.body.classList.contains("detail-trailer-active")) return [];
    const rootRect = container.getBoundingClientRect();
    return Array.from(historyVideosRef.current.entries())
      .map(([id, video]) => {
        const rect = video.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(rect.right, rootRect.right) - Math.max(rect.left, rootRect.left));
        return { id, left: rect.left, ratio: visibleWidth / Math.max(1, rect.width) };
      })
      .filter(({ ratio }) => ratio >= DESKTOP_CAROUSEL_QUEUE_VISIBILITY_THRESHOLD)
      .sort((a, b) => a.left - b.left)
      .map(({ id }) => id);
  }, []);

  const playNextVisibleHistoryVideo = useCallback((endedId: string) => {
    const visibleIds = getVisibleDesktopHistoryIds();
    const nextId = visibleIds[visibleIds.indexOf(endedId) + 1];
    if (!nextId) {
      activeVideoIdRef.current = null;
      return;
    }
    endedRef.current.delete(nextId);
    void playHistoryVideo(nextId);
  }, [getVisibleDesktopHistoryIds, playHistoryVideo]);

  const chooseVisibleHistoryVideo = useCallback(() => {
    if (expandedOpenRef.current || document.hidden || notificationPositioningRef.current) return;
    const desktopScrollRoot = window.matchMedia("(min-width: 1280px)").matches ? historyScrollRef.current : null;
    const rootRect = desktopScrollRoot?.getBoundingClientRect();
    const desktopCarousel = Boolean(desktopScrollRoot && !document.body.classList.contains("detail-trailer-active"));
    if (desktopCarousel) {
      if (carouselScrollingRef.current) return;
      const candidate = getVisibleDesktopHistoryIds()[0] ?? null;
      historyVideosRef.current.forEach((video, id) => {
        if (id === candidate) return;
        video.pause();
        video.currentTime = 0;
        pausedByUserRef.current.delete(id);
        endedRef.current.delete(id);
        syncPlayerState(video);
      });
      activeVideoIdRef.current = candidate;
      if (candidate) {
        const video = historyVideosRef.current.get(candidate);
        if (video?.paused && !pausedByUserRef.current.has(candidate)) void playHistoryVideo(candidate);
      }
      return;
    }
    const stickyBottom = desktopScrollRoot ? rootRect?.top ?? 0 : document.querySelector<HTMLElement>('[data-mobile-detail-sticky="true"]')?.getBoundingClientRect().bottom ?? 0;
    const playableBottom = rootRect?.bottom ?? window.innerHeight;
    historyVideosRef.current.forEach((video, id) => {
      const videoRect = video.getBoundingClientRect();
      const ratio = desktopCarousel && rootRect
        ? Math.max(0, Math.min(videoRect.right, rootRect.right) - Math.max(videoRect.left, rootRect.left)) / Math.max(1, videoRect.width)
        : desktopScrollRoot
          ? calculatePlayableIntersectionRatio(videoRect, playableBottom, stickyBottom)
        : calculatePlayableIntersectionRatio(video.getBoundingClientRect(), window.innerHeight, stickyBottom);
      visibilityRef.current.set(id, ratio);
    });
    let candidate: string | null = null;
    let bestRatio = VIDEO_COMMENT_VISIBILITY_THRESHOLD;
    visibilityRef.current.forEach((ratio, id) => {
      if (historyVideosRef.current.has(id) && ratio > bestRatio) {
        candidate = id;
        bestRatio = ratio;
      }
    });
    const currentId = activeVideoIdRef.current;
    const currentRatio = currentId ? (visibilityRef.current.get(currentId) ?? 0) : 0;
    if (currentId && currentRatio >= VIDEO_COMMENT_VISIBILITY_THRESHOLD && bestRatio - currentRatio < VIDEO_COMMENT_DOMINANCE_MARGIN) candidate = currentId;
    historyVideosRef.current.forEach((video, id) => {
      if (id === candidate) return;
      video.pause();
      video.currentTime = 0;
      pausedByUserRef.current.delete(id);
      endedRef.current.delete(id);
      syncPlayerState(video);
    });
    if (!candidate) {
      activeVideoIdRef.current = null;
      return;
    }
    activeVideoIdRef.current = candidate;
    const candidateVideo = historyVideosRef.current.get(candidate);
    if (candidateVideo?.paused && !pausedByUserRef.current.has(candidate)) void playHistoryVideo(candidate);
  }, [getVisibleDesktopHistoryIds, playHistoryVideo, syncPlayerState]);

  const updateHistoryCarouselState = useCallback(() => {
    const desktop = window.matchMedia("(min-width: 1280px)").matches;
    const container = desktop ? historyScrollRef.current : mobileHistoryScrollRef.current;
    if (!container || !window.matchMedia("(min-width: 1280px)").matches || document.body.classList.contains("detail-trailer-active")) return;
    const tolerance = 2;
    setCanScrollHistoryLeft(container.scrollLeft > tolerance);
    setCanScrollHistoryRight(container.scrollLeft + container.clientWidth < container.scrollWidth - tolerance);
  }, []);

  const scrollHistoryCarousel = useCallback((direction: -1 | 1) => {
    const container = historyScrollRef.current;
    if (!container) return;
    const firstCard = container.querySelector<HTMLElement>("[data-video-comment-card]");
    const gap = Number.parseFloat(getComputedStyle(container).columnGap || getComputedStyle(container).gap) || 12;
    container.scrollBy({ left: direction * ((firstCard?.offsetWidth ?? 384) + gap), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const container = historyScrollRef.current;
    if (!container) return;
    const sync = () => {
      updateHistoryCarouselState();
      if (!window.matchMedia("(min-width: 1280px)").matches || document.body.classList.contains("detail-trailer-active")) {
        chooseVisibleHistoryVideo();
        return;
      }
      carouselScrollingRef.current = true;
      if (carouselScrollTimerRef.current !== null) window.clearTimeout(carouselScrollTimerRef.current);
      carouselScrollTimerRef.current = window.setTimeout(() => {
        carouselScrollingRef.current = false;
        carouselScrollTimerRef.current = null;
        chooseVisibleHistoryVideo();
      }, 120);
    };
    updateHistoryCarouselState();
    chooseVisibleHistoryVideo();
    container.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      container.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (carouselScrollTimerRef.current !== null) window.clearTimeout(carouselScrollTimerRef.current);
      carouselScrollTimerRef.current = null;
      carouselScrollingRef.current = false;
    };
  }, [commentIds, chooseVisibleHistoryVideo, updateHistoryCarouselState]);

  useEffect(() => {
    if (recorderState !== "idle") {
      setCanScrollHistoryLeft(false);
      setCanScrollHistoryRight(false);
      return;
    }
    const frame = window.requestAnimationFrame(updateHistoryCarouselState);
    return () => window.cancelAnimationFrame(frame);
  }, [recorderState, updateHistoryCarouselState]);

  useEffect(() => {
    if (deleteMenuId === null) return;
    const closeMenu = (event?: Event) => {
      if (event?.target instanceof Element && event.target.closest("[data-video-delete-menu]")) return;
      setDeleteMenuId(null);
    };
    const historyScroller = historyScrollRef.current;
    document.addEventListener("pointerdown", closeMenu);
    historyScroller?.addEventListener("scroll", closeMenu, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      historyScroller?.removeEventListener("scroll", closeMenu);
    };
  }, [deleteMenuId]);

  useEffect(() => {
    if (!active || typeof IntersectionObserver === "undefined") return;
    const historyVideos = historyVideosRef.current;
    const visibility = visibilityRef.current;
    const desktopScrollRoot = window.matchMedia("(min-width: 1280px)").matches ? historyScrollRef.current : null;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        const id = video.dataset.videoCommentId;
        if (!id || entry.isIntersecting) return;
        visibilityRef.current.set(id, 0);
      });
      chooseVisibleHistoryVideo();
    }, { root: desktopScrollRoot, threshold: [0, 0.15, 0.25, 0.5, 0.75, 1] });
    historyObserverRef.current = observer;
    historyVideos.forEach((video) => observer.observe(video));
    let viewportFrame = 0;
    const reevaluatePlayableViewport = () => {
      if (viewportFrame) return;
      viewportFrame = window.requestAnimationFrame(() => {
        viewportFrame = 0;
        chooseVisibleHistoryVideo();
      });
    };
    window.addEventListener("scroll", reevaluatePlayableViewport, { passive: true });
    desktopScrollRoot?.addEventListener("scroll", reevaluatePlayableViewport, { passive: true });
    window.addEventListener("resize", reevaluatePlayableViewport);
    return () => {
      window.removeEventListener("scroll", reevaluatePlayableViewport);
      desktopScrollRoot?.removeEventListener("scroll", reevaluatePlayableViewport);
      window.removeEventListener("resize", reevaluatePlayableViewport);
      if (viewportFrame) window.cancelAnimationFrame(viewportFrame);
      observer.disconnect();
      historyObserverRef.current = null;
      historyVideos.forEach((video) => video.pause());
      activeVideoIdRef.current = null;
      visibility.clear();
    };
  }, [active, chooseVisibleHistoryVideo, syncPlayerState]);

  useEffect(() => {
    const setReactionAudio = (event: Event) => {
      if (document.body.dataset.trailerCompanionView !== "reaction") return;
      const trailerMuted = (event as CustomEvent<{ muted: boolean }>).detail.muted;
      const preference: VideoSoundPreference = trailerMuted ? "sound-on" : "muted";
      soundPreferenceRef.current = preference;
      setSoundPreference(preference);
      historyVideosRef.current.forEach((video) => {
        video.muted = !trailerMuted;
        syncPlayerState(video);
      });
      expandedVideosRef.current.forEach((video) => {
        video.muted = !trailerMuted;
        syncPlayerState(video);
      });
    };
    const pauseReactions = () => {
      historyVideosRef.current.forEach((video) => video.pause());
      expandedVideosRef.current.forEach((video) => video.pause());
    };
    window.addEventListener("qnext:trailer-muted-change", setReactionAudio);
    window.addEventListener("qnext:trailer-fullscreen-enter", pauseReactions);
    return () => {
      window.removeEventListener("qnext:trailer-muted-change", setReactionAudio);
      window.removeEventListener("qnext:trailer-fullscreen-enter", pauseReactions);
    };
  }, [syncPlayerState]);

  useEffect(() => {
    const mounted = new Set<string>();
    document.querySelectorAll<HTMLVideoElement>('[data-video-comment-player="true"]').forEach((video) => {
      const id = video.dataset.videoCommentId;
      if (!id) return;
      mounted.add(id);
      if (!historyVideosRef.current.has(id)) {
        video.muted = soundPreferenceRef.current !== "sound-on";
        video.disablePictureInPicture = true;
        historyVideosRef.current.set(id, video);
        historyObserverRef.current?.observe(video);
        syncPlayerState(video);
      }
    });
    historyVideosRef.current.forEach((video, id) => {
      if (!mounted.has(id)) {
        historyObserverRef.current?.unobserve(video);
        historyVideosRef.current.delete(id);
        visibilityRef.current.delete(id);
        pausedByUserRef.current.delete(id);
        endedRef.current.delete(id);
      }
    });
  }, [commentIds, recorderState, syncPlayerState]);

  const changeRecorderState = useCallback((nextState: VideoRecorderState) => {
    setRecorderState(nextState);
  }, []);

  const revokePreview = useCallback(() => {
    if (previewTimeoutRef.current !== null) window.clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = null;
    const objectUrl = previewUrlRef.current;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPreviewFile(null);
    selectedFileRef.current = null;
    setPreviewPlayable(false);
    setPreviewDuration(null);
    setPreviewAspectRatio(9 / 16);
    setPreviewOrigin(null);
    setPreviewMuted(true);
    previewPlayableRef.current = false;
    previewFallbackAttemptedRef.current = false;
    previewDurationRef.current = null;
    setPreviewError("");
  }, []);

  const stopTracks = useCallback(() => {
    if (canvasFrameRef.current !== null) cancelAnimationFrame(canvasFrameRef.current);
    canvasFrameRef.current = null;
    recorderOutputStreamRef.current?.getVideoTracks().forEach((track) => track.stop());
    recorderOutputStreamRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
    orientationUnsafeRef.current = false;
    tiltUnsafeRef.current = false;
    orientationPausedRef.current = false;
    setOrientationPaused(false);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const cleanupRecorder = useCallback((options: { clearPreview?: boolean; nextState?: VideoRecorderState } = {}) => {
    clearTimer();
    stopModeRef.current = options.nextState === "menu" ? "menu" : "idle";
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch (err) {
      logVideoCommentDevError("Recorder stop during cleanup failed", err);
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopRequestedRef.current = false;
    stopTracks();
    setRecordingSeconds(0);
    if (options.clearPreview) revokePreview();
  }, [clearTimer, revokePreview, stopTracks]);

  const fetchPage = useCallback(async (endpoint: string, mode: "initial" | "more") => {
    if (!movieId || (mode === "more" && (loadingMore || !next))) return;
    const seq = ++requestSeqRef.current;
    if (mode === "initial") setInitialLoading(true); else setLoadingMore(true);
    setHistoryError("");
    try {
      const payload = (await apiFetch(endpoint)) as VideoCommentsPage;
      if (seq !== requestSeqRef.current) return;
      setComments((current) => mode === "initial" ? payload.results : dedupeVideoComments(current, payload.results));
      setCount(payload.count);
      setNext(normalizeVideoCommentsNext(payload.next));
    } catch (err) {
      logVideoCommentDevError("Video comments page load failed", err);
      if (seq === requestSeqRef.current) setHistoryError(t("movieDetailVideoLoadError"));
    } finally {
      if (seq === requestSeqRef.current) { setInitialLoading(false); setLoadingMore(false); }
    }
  }, [loadingMore, movieId, next, t]);
  const reloadFirstPage = useCallback(() => fetchPage(`/movies/${encodeURIComponent(movieId)}/video-comments/`, "initial"), [fetchPage, movieId]);

  useEffect(() => {
    reloadFirstPageRef.current = reloadFirstPage;
  }, [reloadFirstPage]);


  useEffect(() => {
    try {
      permissionInfoAcceptedRef.current = sessionStorage.getItem(VIDEO_COMMENT_PERMISSION_SESSION_KEY) === "1";
    } catch {
      permissionInfoAcceptedRef.current = false;
    }
  }, []);

  useEffect(() => {
    const shouldLock = recorderState === "preparingRecorder" || recorderState === "recording";
    if (!shouldLock || typeof document === "undefined") return;
    if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (bodyOverflowRef.current !== null) {
        document.body.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
    };
  }, [recorderState]);

  useEffect(() => {
    if (active) void reloadFirstPageRef.current();
    else { cleanupRecorder({ clearPreview: true, nextState: "idle" }); setRecorderState("idle"); setError(""); }
    return () => { requestSeqRef.current += 1; cleanupRecorder({ clearPreview: true, nextState: "idle" }); };
  }, [active, cleanupRecorder]);

  useEffect(() => {
    if (!active || !window.matchMedia("(min-width: 1280px)").matches) return;
    historyScrollRef.current?.scrollTo({ top: 0 });
  }, [active]);

  useEffect(() => {
    if (recorderState !== "menu") return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !optionsMenuRef.current?.contains(target)) setRecorderState("idle");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [recorderState]);

  useEffect(() => {
    if (recorderState !== "menu") {
      setOptionsMenuPosition(null);
      return;
    }
    const positionMenu = () => {
      const anchor = menuRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 208;
      const desktop = window.matchMedia("(min-width: 1280px)").matches;
      const desiredLeft = desktop ? rect.right + 12 : rect.left + rect.width / 2 - menuWidth / 2;
      setOptionsMenuPosition({
        left: Math.max(8, Math.min(desiredLeft, window.innerWidth - menuWidth - 8)),
        top: desktop ? rect.top : rect.bottom + 12,
      });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [recorderState]);

  useEffect(() => {
    if (!active || recorderState !== "idle" || !next || initialLoading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const desktopScrollRoot = window.matchMedia("(min-width: 1280px)").matches ? historyScrollRef.current : null;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && next && !loadingMore) fetchPage(next, "more");
    }, { root: desktopScrollRoot, rootMargin: "260px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [active, fetchPage, initialLoading, loadingMore, next, recorderState]);

  useEffect(() => {
    if (!active || !notificationTarget || initialLoading || loadingMore || recorderState !== "idle") return;
    const targetKey = `${movieId}:${notificationTarget.id}:${notificationTarget.reaction ?? ""}`;
    if (processedNotificationTargetRef.current === targetKey || notificationPositioningRef.current) return;
    const desktop = window.matchMedia("(min-width: 1280px)").matches;
    const container = desktop ? historyScrollRef.current : mobileHistoryScrollRef.current;
    const card = container?.querySelector<HTMLElement>(`[data-video-comment-card="${CSS.escape(notificationTarget.id)}"]`);
    logNotificationTarget("video target lookup", {
      target: "video-reaction",
      targetId: notificationTarget.id,
      viewport: window.matchMedia("(min-width: 1280px)").matches ? "desktop" : "mobile",
      videoCardFound: Boolean(card),
      notificationPositioning: notificationPositioningRef.current,
    });
    if (!container || !card) {
      if (!window.matchMedia("(min-width: 1280px)").matches) {
        console.log("[VIDEO MOBILE TARGET]", {
          videoCommentId: notificationTarget.id,
          scrollContainerFound: Boolean(container),
          cardFound: Boolean(card),
          playerFound: false,
          fullyVisible: false,
          positioningRef: notificationPositioningRef.current,
        });
      }
      if (next) void fetchPage(next, "more");
      return;
    }

    let cancelled = false;
    notificationPositioningRef.current = true;
    const positionTarget = async () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Notification navigation remains animated on desktop, while mobile uses
      // the exact same destination coordinate without exposing the traversal.
      const behavior: ScrollBehavior = desktop && !reducedMotion ? "smooth" : "auto";
      const section = document.querySelector<HTMLElement>("[data-video-reaction-section]");
      const visualVideo = card.querySelector<HTMLElement>('[data-video-comment-player="true"]');
      const verticalPositionBefore = section?.getBoundingClientRect().top ?? null;
      const carouselScrollLeftBefore = container.scrollLeft;

      if (desktop && section) {
        const tabsHeight = document.querySelector<HTMLElement>("[data-desktop-comment-tabs]")?.getBoundingClientRect().height ?? 0;
        window.scrollTo({ top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - tabsHeight - 16), behavior });
        await waitForNotificationScroll(window, reducedMotion);
      }

      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;

      const stableContainerRect = container.getBoundingClientRect();
      const stableCardRect = card.getBoundingClientRect();
      if (desktop && container.scrollWidth > container.clientWidth) {
        container.scrollTo({ left: container.scrollLeft + stableCardRect.left - stableContainerRect.left - (container.clientWidth - stableCardRect.width) / 2, behavior });
        await waitForNotificationScroll(container, reducedMotion);
        console.log("[VIDEO NOTIFICATION TARGET]", {
          videoCommentId: notificationTarget.id,
          reaction: notificationTarget.reaction,
          viewport: "desktop",
          cardFound: true,
          playerFound: Boolean(visualVideo),
          scrollContainerFound: true,
          verticalPositionBefore,
          verticalPositionAfter: section?.getBoundingClientRect().top ?? null,
          carouselScrollLeftBefore,
          carouselScrollLeftAfter: container.scrollLeft,
        });
      } else {
        const scrollContainer = mobileHistoryScrollRef.current;
        if (!scrollContainer || !visualVideo) {
          console.log("[VIDEO MOBILE TARGET]", {
            videoCommentId: notificationTarget.id,
            scrollContainerFound: Boolean(scrollContainer),
            cardFound: true,
            playerFound: Boolean(visualVideo),
            fullyVisible: false,
            positioningRef: notificationPositioningRef.current,
          });
          notificationPositioningRef.current = false;
          logNotificationTarget("TARGET NOT CONSUMED", { targetId: notificationTarget.id, scrollContainerFound: Boolean(scrollContainer), videoPlayerFound: Boolean(visualVideo) });
          return;
        }
        const containerRectBefore = scrollContainer.getBoundingClientRect();
        const videoRectBefore = visualVideo.getBoundingClientRect();
        const scrollTopBefore = scrollContainer.scrollTop;
        const relativeVideoTop = videoRectBefore.top - containerRectBefore.top + scrollTopBefore;
        const centeredTop = relativeVideoTop - (scrollContainer.clientHeight - videoRectBefore.height) / 2;
        const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
        const desiredTop = Math.min(maxScrollTop, Math.max(0, centeredTop));
        const availableMargin = Math.max(0, (scrollContainer.clientHeight - videoRectBefore.height) / 2);
        const topMargin = Math.min(8, availableMargin);
        const safeBottomMargin = Math.min(10, availableMargin);
        const extraBottomMargin = Math.min(6, Math.max(0, availableMargin - safeBottomMargin));
        const projectedTop = containerRectBefore.top + relativeVideoTop - desiredTop;
        const projectedBottom = projectedTop + videoRectBefore.height;
        const projectedBottomOverflow = projectedBottom - (containerRectBefore.bottom - safeBottomMargin);
        const projectedTopOverflow = projectedTop - (containerRectBefore.top + topMargin);
        const alignmentCorrection = projectedBottomOverflow > 0
          ? projectedBottomOverflow + extraBottomMargin
          : Math.min(0, projectedTopOverflow);
        const alignedScrollTop = Math.min(maxScrollTop, Math.max(0, desiredTop + alignmentCorrection));
        const alignedProjectedTop = containerRectBefore.top + relativeVideoTop - alignedScrollTop;
        const maxSafeLift = Math.max(0, alignedProjectedTop - containerRectBefore.top - topMargin);
        const extraTargetLift = Math.min(VIDEO_NOTIFICATION_EXTRA_TARGET_LIFT_PX, maxSafeLift, maxScrollTop - alignedScrollTop);
        const finalScrollTop = alignedScrollTop + extraTargetLift;
        logNotificationTarget("mobile video before scroll", {
          targetId: notificationTarget.id,
          scrollContainerFound: true,
          videoPlayerFound: true,
          scrollTopBefore,
          containerClientHeight: scrollContainer.clientHeight,
          relativeVideoTop,
          videoRect: { top: videoRectBefore.top, bottom: videoRectBefore.bottom, height: videoRectBefore.height },
          notificationPositioning: notificationPositioningRef.current,
        });
        console.log("[MOBILE NOTIFICATION SCROLL]", {
          targetType: "video-reaction",
          targetId: notificationTarget.id,
          phase: "final",
          scrollContainer: "video-reaction",
          scrollTop: scrollTopBefore,
          intendedFinalScrollTop: finalScrollTop,
          behavior,
          positioningLock: notificationPositioningRef.current,
        });
        scrollContainer.scrollTo({ top: finalScrollTop, behavior });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        let containerRectAfter = scrollContainer.getBoundingClientRect();
        let videoRectAfter = visualVideo.getBoundingClientRect();
        const videoBottomBefore = videoRectAfter.bottom;
        const bottomOverflow = videoRectAfter.bottom - (containerRectAfter.bottom - safeBottomMargin);
        const topOverflow = videoRectAfter.top - (containerRectAfter.top + topMargin);
        const correctionApplied = bottomOverflow > 0 ? bottomOverflow : Math.min(0, topOverflow);
        let fullyVisible = videoRectAfter.top >= containerRectAfter.top + topMargin && videoRectAfter.bottom <= containerRectAfter.bottom - safeBottomMargin;
        if (!fullyVisible && correctionApplied !== 0) {
          scrollContainer.scrollBy({ top: correctionApplied, behavior: "auto" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          containerRectAfter = scrollContainer.getBoundingClientRect();
          videoRectAfter = visualVideo.getBoundingClientRect();
          fullyVisible = videoRectAfter.top >= containerRectAfter.top + topMargin && videoRectAfter.bottom <= containerRectAfter.bottom - safeBottomMargin;
        }
        console.log("[VIDEO MOBILE FINAL ALIGNMENT]", {
          videoCommentId: notificationTarget.id,
          containerBottom: containerRectAfter.bottom,
          videoBottomBefore,
          bottomOverflow,
          correctionApplied,
          extraTargetLift,
          videoBottomAfter: videoRectAfter.bottom,
          fullyVisible,
        });
        console.log("[MOBILE NOTIFICATION FINAL]", {
          targetType: "video-reaction",
          targetId: notificationTarget.id,
          finalTop: videoRectAfter.top,
          finalBottom: videoRectAfter.bottom,
          containerTop: containerRectAfter.top,
          containerBottom: containerRectAfter.bottom,
          fullyVisible,
          correctionPx: correctionApplied,
        });
        logNotificationTarget("mobile video after scroll", {
          targetId: notificationTarget.id,
          scrollTopAfter: scrollContainer.scrollTop,
          containerClientHeight: scrollContainer.clientHeight,
          videoRect: { top: videoRectAfter.top, bottom: videoRectAfter.bottom, height: videoRectAfter.height },
          videoTopRelative: videoRectAfter.top - containerRectAfter.top,
          videoBottomRelative: videoRectAfter.bottom - containerRectAfter.top,
          fullyVisible,
          notificationPositioning: notificationPositioningRef.current,
        });
        console.log("[VIDEO MOBILE TARGET]", {
          videoCommentId: notificationTarget.id,
          reaction: notificationTarget.reaction,
          scrollContainerFound: true,
          cardFound: true,
          playerFound: true,
          scrollTopBefore,
          desiredScrollTop: finalScrollTop,
          scrollTopAfter: scrollContainer.scrollTop,
          containerClientHeight: scrollContainer.clientHeight,
          videoHeight: videoRectAfter.height,
          videoTopRelative: videoRectAfter.top - containerRectAfter.top,
          videoBottomRelative: videoRectAfter.bottom - containerRectAfter.top,
          fullyVisible,
          positioningRef: notificationPositioningRef.current,
        });
        if (!fullyVisible) {
          notificationPositioningRef.current = false;
          logNotificationTarget("TARGET NOT CONSUMED", { targetId: notificationTarget.id, reason: "mobile video is not fully visible" });
          return;
        }
      }
      if (cancelled) return;

      if (notificationTarget.reaction) {
        setNotificationReactionOverlay({ id: notificationTarget.id, reaction: notificationTarget.reaction, reducedMotion });
        window.setTimeout(() => setNotificationReactionOverlay(null), reducedMotion ? 900 : 2200);
      }
      processedNotificationTargetRef.current = targetKey;
      notificationPositioningRef.current = false;
      logNotificationTarget("target consumed", { target: "video-reaction", targetId: notificationTarget.id, timestamp: Date.now() });
      onNotificationTargetConsumed();
    };
    void positionTarget();
    return () => {
      cancelled = true;
      notificationPositioningRef.current = false;
    };
  }, [active, fetchPage, initialLoading, iosWebKit, loadingMore, logNotificationTarget, movieId, next, notificationTarget, onNotificationTargetConsumed, recorderState]);

  const finishRecording = useCallback(() => {
    stopModeRef.current = "previewRecorded";
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive" && !stopRequestedRef.current) {
      stopRequestedRef.current = true;
      try { recorder.requestData(); } catch (err) { logRecorderPhaseError("recording.requestData", err, recorder.mimeType, recorder, streamRef.current); }
      recorder.stop();
    }
  }, [clearTimer]);

  const mountPreviewImmediately = useCallback((file: File, source: "recorded" | "selected") => {
    const objectUrl = prepareVideoPreview(file);
    if (livePreviewRef.current) livePreviewRef.current.srcObject = null;
    selectedFileRef.current = file;
    setPreviewFile(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setPreviewDuration(null);
    setPreviewOrigin(source);
    setPreviewAspectRatio(source === "recorded" ? 9 / 16 : 16 / 9);
    setPreviewMuted(true);
    setPreviewPlayable(false);
    previewDurationRef.current = null;
    previewPlayableRef.current = false;
    setPreviewError("");
    previewFallbackAttemptedRef.current = false;
    appendVideoDebugLog("PREVIEW_METHOD", { method: "object-url" });
    changeRecorderState(source === "recorded" ? "previewRecorded" : "previewSelected");
  }, [appendVideoDebugLog, changeRecorderState]);

  const createRecorderWithFallback = useCallback((stream: MediaStream, isWebKit: boolean) => {
    const candidates = isWebKit ? IOS_VIDEO_COMMENT_MIME_CANDIDATES : VIDEO_COMMENT_MIME_CANDIDATES;
    for (const mimeType of candidates) {
      if (typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(mimeType)) continue;
      try {
        const recorder = new MediaRecorder(stream, { mimeType });
        return { recorder, requestedMimeType: mimeType };
      } catch (err) {
        logRecorderPhaseError("preparingRecorder.constructor.explicitMime", err, mimeType, null, stream);
      }
    }
    return { recorder: new MediaRecorder(stream), requestedMimeType: "" };
  }, []);

  const startRecorderWithStream = useCallback(async (stream: MediaStream) => {
    if (!stream.active || stream.getVideoTracks().length === 0 || stream.getAudioTracks().length === 0) throw new Error("missing-tracks");
    streamRef.current = stream;
    const preview = livePreviewRef.current;
    if (!preview) throw new Error("preview-unavailable");
    preview.srcObject = stream;
    preview.muted = true;
    preview.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("preview-metadata-timeout")), 6000);
      if (preview.readyState >= HTMLMediaElement.HAVE_METADATA) { window.clearTimeout(timeout); resolve(); return; }
      preview.onloadedmetadata = () => { window.clearTimeout(timeout); resolve(); };
      preview.onerror = () => { window.clearTimeout(timeout); reject(new Error("preview-metadata-error")); };
    });
    await preview.play().catch((err) => { throw new Error(`preview-play:${err instanceof Error ? err.message : "unknown"}`); });
    appendVideoDebugLog("CAMERA_PREVIEW_DIMENSIONS", {
      videoWidth: preview.videoWidth,
      videoHeight: preview.videoHeight,
      aspectRatio: preview.videoHeight > 0 ? preview.videoWidth / preview.videoHeight : null,
    });
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.captureStream !== "function") throw new Error("portrait-canvas-unavailable");
    canvas.width = VIDEO_REACTION_WIDTH;
    canvas.height = VIDEO_REACTION_HEIGHT;
    compositionLoggedRef.current = false;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("portrait-canvas-context-unavailable");
    const drawPortraitFrame = () => {
      canvasFrameRef.current = requestAnimationFrame(drawPortraitFrame);
      if (!desktopRecordingRef.current) {
        if (orientationUnsafeRef.current || isLandscapeViewport()) {
          orientationUnsafeRef.current = true;
          if (!orientationPausedRef.current) {
            orientationPausedRef.current = true;
            setOrientationPaused(true);
          }
          if (recorderRef.current?.state === "recording") recorderRef.current.pause();
          return;
        }
      }
      if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && preview.videoWidth > 0 && preview.videoHeight > 0) {
        const sourceWidth = preview.videoWidth;
        const sourceHeight = preview.videoHeight;
        const { dx, dy, dw, dh } = calculateContainDestinationRect(sourceWidth, sourceHeight, canvas.width, canvas.height);
        context.fillStyle = "#000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (!compositionLoggedRef.current) {
          compositionLoggedRef.current = true;
          const sourceRatio = sourceWidth / sourceHeight;
          const targetRatio = canvas.width / canvas.height;
          const previousSw = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth;
          const previousSh = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio;
          appendVideoDebugLog("CAMERA_COMPOSITION", {
            mode: "contain-full-raw",
            sourceWidth,
            sourceHeight,
            sourceAspectRatio: sourceRatio,
            previousCover: { sx: (sourceWidth - previousSw) / 2, sy: (sourceHeight - previousSh) / 2, sw: previousSw, sh: previousSh, retainedWidthRatio: previousSw / sourceWidth, retainedHeightRatio: previousSh / sourceHeight },
            sourceRect: { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight },
            destinationRect: { dx, dy, dw, dh },
            retainedWidthRatio: 1,
            retainedHeightRatio: 1,
          });
        }
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        if (desktopRecordingRef.current) {
          const targetAspect = canvas.width / canvas.height;
          const sourceAspect = sourceWidth / sourceHeight;
          const cropWidth = sourceAspect > targetAspect ? sourceHeight * targetAspect : sourceWidth;
          const cropHeight = sourceAspect > targetAspect ? sourceHeight : sourceWidth / targetAspect;
          const cropX = (sourceWidth - cropWidth) / 2;
          const cropY = (sourceHeight - cropHeight) / 2;
          context.drawImage(preview, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        } else {
          context.drawImage(preview, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh);
        }
        context.restore();
      }
    };
    drawPortraitFrame();
    const canvasStream = canvas.captureStream(30);
    const outputStream = new MediaStream([...canvasStream.getVideoTracks(), ...stream.getAudioTracks()]);
    recorderOutputStreamRef.current = outputStream;
    const { mimeType } = getRecorderConfiguration(iosWebKit);
    currentMimeTypeRef.current = mimeType;
    const created = createRecorderWithFallback(outputStream, iosWebKit);
    let recorder = created.recorder;
    appendVideoDebugLog("RECORDER_CREATED", { requestedMimeType: created.requestedMimeType, actualMimeType: recorder.mimeType, state: recorder.state });
    recorderRef.current = recorder;
    chunksRef.current = [];
    stopRequestedRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        appendVideoDebugLog("DATA_AVAILABLE", { size: event.data.size, type: event.data.type, chunkIndex: chunksRef.current.length - 1 });
      }
    };
    recorder.onstop = () => {
      const targetState = stopModeRef.current;
      const chunks = [...chunksRef.current];
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
      appendVideoDebugLog("RECORDER_STOPPED", { chunks: chunks.length, totalSize, actualMimeType: recorder.mimeType });
      recorderRef.current = null;
      if (targetState !== "previewRecorded") {
        chunksRef.current = [];
        stopTracks();
        setRecordingSeconds(0);
        setRecorderState(targetState);
        return;
      }
      if (chunks.length === 0 || totalSize <= 0) {
        chunksRef.current = [];
        stopTracks();
        setError(t("movieDetailVideoRecordedCreateError"));
        setRecorderState("error");
        return;
      }
      const realMimeType = recorder.mimeType || chunks[0]?.type || currentMimeTypeRef.current || mimeType;
      const blob = new Blob(chunks, { type: realMimeType });
      appendVideoDebugLog("RECORDED_BLOB", { size: blob.size, type: blob.type });
      if (!blob.size) {
        chunksRef.current = [];
        stopTracks();
        setError(t("movieDetailVideoRecordedCreateError"));
        setRecorderState("error");
        return;
      }
      const file = createVideoCommentFile(blob, realMimeType);
      appendVideoDebugLog("RECORDED_FILE", { size: file.size, type: file.type, extension: file.name.split(".").pop() });
      try {
        mountPreviewImmediately(file, "recorded");
        setRecordingSeconds(0);
      } catch (err) {
        logRecorderPhaseError("recordedPreview", err, realMimeType, null, null);
        setError(t("movieDetailVideoRecordedCreateError"));
        changeRecorderState("error");
      } finally {
        chunksRef.current = [];
        stopTracks();
      }
    };
    try {
      if (iosWebKit) recorder.start(1000); else recorder.start();
    } catch (err) {
      logRecorderPhaseError("preparingRecorder.start", err, recorder.mimeType || mimeType, recorder, stream);
      if (mimeType) {
        const fallbackRecorder = new MediaRecorder(outputStream);
        const onDataAvailable = recorder.ondataavailable;
        const onStop = recorder.onstop;
        recorder = fallbackRecorder;
        recorderRef.current = fallbackRecorder;
        fallbackRecorder.ondataavailable = onDataAvailable;
        fallbackRecorder.onstop = onStop;
        if (iosWebKit) fallbackRecorder.start(1000); else fallbackRecorder.start();
      } else {
        throw err;
      }
    }
    if (recorderRef.current?.state !== "recording") throw new Error("recorder-not-recording");
    currentMimeTypeRef.current = recorderRef.current.mimeType || mimeType;
    setRecordingSeconds(0);
    setRecorderState("recording");
    timerRef.current = window.setInterval(() => setRecordingSeconds((seconds) => {
      if (orientationPausedRef.current) return seconds;
      const nextSecond = Math.min(seconds + 1, VIDEO_COMMENT_MAX_SECONDS);
      if (nextSecond >= VIDEO_COMMENT_MAX_SECONDS) window.setTimeout(finishRecording, 0);
      return nextSecond;
    }), 1000);
  }, [appendVideoDebugLog, changeRecorderState, createRecorderWithFallback, finishRecording, iosWebKit, mountPreviewImmediately, stopTracks, t]);

  useEffect(() => {
    if (recorderState !== "recording") return;
    if (desktopRecordingRef.current) return;
    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const syncOrientation = () => {
      const landscape = mediaQuery.matches || isLandscapeViewport();
      const recorder = recorderRef.current;
      if (landscape && !orientationPausedRef.current) {
        orientationUnsafeRef.current = true;
        orientationPausedRef.current = true;
        setOrientationPaused(true);
        if (recorder?.state === "recording") recorder.pause();
      } else if (!landscape && !tiltUnsafeRef.current && orientationPausedRef.current) {
        orientationUnsafeRef.current = false;
        orientationPausedRef.current = false;
        setOrientationPaused(false);
        if (recorder?.state === "paused") recorder.resume();
      }
    };
    syncOrientation();
    mediaQuery.addEventListener?.("change", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);
    window.addEventListener("resize", syncOrientation);
    screen.orientation?.addEventListener?.("change", syncOrientation);
    return () => {
      mediaQuery.removeEventListener?.("change", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
      window.removeEventListener("resize", syncOrientation);
      screen.orientation?.removeEventListener?.("change", syncOrientation);
    };
  }, [recorderState]);

  useEffect(() => {
    if (recorderState !== "recording" || typeof DeviceMotionEvent === "undefined") return;
    if (desktopRecordingRef.current) return;
    let unsafeSamples = 0;
    let safeSamples = 0;
    const handleEarlyMotion = (event: DeviceMotionEvent) => {
      const gravity = event.accelerationIncludingGravity;
      if (gravity?.x === null || gravity?.x === undefined || gravity.y === null || gravity.y === undefined || gravity.z === null || gravity.z === undefined) return;
      const lateralRoll = Math.abs(Math.atan2(gravity.x, Math.sqrt(gravity.y * gravity.y + gravity.z * gravity.z)) * 180 / Math.PI);
      unsafeSamples = lateralRoll >= VIDEO_REACTION_TILT_PAUSE_DEGREES ? unsafeSamples + 1 : 0;
      safeSamples = lateralRoll <= VIDEO_REACTION_TILT_RESUME_DEGREES ? safeSamples + 1 : 0;
      const recorder = recorderRef.current;
      if (unsafeSamples >= VIDEO_REACTION_TILT_CONFIRMATION_SAMPLES && !tiltUnsafeRef.current) {
        // This ref is set before React state so drawPortraitFrame drops the next
        // frame synchronously, even if rendering the overlay takes longer.
        tiltUnsafeRef.current = true;
        orientationUnsafeRef.current = true;
        orientationPausedRef.current = true;
        if (recorder?.state === "recording") recorder.pause();
        setOrientationPaused(true);
      } else if (safeSamples >= VIDEO_REACTION_TILT_CONFIRMATION_SAMPLES && tiltUnsafeRef.current && !isLandscapeViewport()) {
        tiltUnsafeRef.current = false;
        orientationUnsafeRef.current = false;
        orientationPausedRef.current = false;
        if (recorder?.state === "paused") recorder.resume();
        setOrientationPaused(false);
      }
    };
    window.addEventListener("devicemotion", handleEarlyMotion, { passive: true });
    return () => window.removeEventListener("devicemotion", handleEarlyMotion);
  }, [recorderState]);

  const continueToNativePermissions = useCallback(async () => {
    setError("");
    setRecorderState("requestingPermission");
    if (!window.isSecureContext) { setError(t("movieDetailVideoInsecureContext")); setRecorderState("error"); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t("movieDetailVideoUnsupportedBrowser")); setRecorderState("error"); return; }
    try {
      cleanupRecorder({ clearPreview: true, nextState: "idle" });
      const isDesktopRecording = window.matchMedia("(min-width: 1280px)").matches;
      desktopRecordingRef.current = isDesktopRecording;
      const requestMotionPermission = (DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> }).requestPermission;
      if (!isDesktopRecording && requestMotionPermission) await requestMotionPermission.call(DeviceMotionEvent).catch(() => "denied" as PermissionState);
      const requestedCameraConstraints: MediaTrackConstraints = isDesktopRecording
        ? {
            width: { ideal: VIDEO_REACTION_SOURCE_WIDTH },
            height: { ideal: VIDEO_REACTION_SOURCE_HEIGHT },
            aspectRatio: { ideal: VIDEO_REACTION_SOURCE_ASPECT_RATIO },
          }
        : {
            facingMode: { ideal: "user" },
            width: { ideal: VIDEO_REACTION_SOURCE_WIDTH },
            height: { ideal: VIDEO_REACTION_SOURCE_HEIGHT },
            aspectRatio: { ideal: VIDEO_REACTION_SOURCE_ASPECT_RATIO },
          };
      appendVideoDebugLog("CAMERA_REQUESTED_CONSTRAINTS", { ...requestedCameraConstraints });
      const stream = await navigator.mediaDevices.getUserMedia({
        // Negotiate the proven wide raw front-camera mode independently from the
        // fixed 720 x 1280 canvas used for the recorded asset.
        video: requestedCameraConstraints,
        audio: true,
      });
      if (!stream.active || stream.getVideoTracks().length === 0 || stream.getAudioTracks().length === 0) throw new Error("missing-tracks");
      const cameraTrack = stream.getVideoTracks()[0];
      const capabilities = cameraTrack.getCapabilities?.() as MediaTrackCapabilities & { zoom?: { min?: number; max?: number; step?: number }; resizeMode?: string[] };
      const reportCameraConfiguration = (phase: string) => {
        const settings = cameraTrack.getSettings() as MediaTrackSettings & { resizeMode?: string; zoom?: number };
        const diagnostic = {
          phase,
          width: settings.width ?? null,
          height: settings.height ?? null,
          aspectRatio: settings.aspectRatio ?? null,
          facingMode: settings.facingMode ?? null,
          resizeMode: settings.resizeMode ?? null,
          zoom: settings.zoom ?? null,
        };
        appendVideoDebugLog("CAMERA_SETTINGS", diagnostic);
        if (process.env.NODE_ENV !== "production") console.debug("[video-reaction] camera settings", diagnostic);
        return settings;
      };
      appendVideoDebugLog("CAMERA_CAPABILITIES", {
        width: capabilities?.width ?? null,
        height: capabilities?.height ?? null,
        aspectRatio: capabilities?.aspectRatio ?? null,
        facingMode: capabilities?.facingMode ?? null,
        resizeMode: capabilities?.resizeMode ?? null,
        zoomMin: capabilities?.zoom?.min ?? null,
        zoomMax: capabilities?.zoom?.max ?? null,
        zoomStep: capabilities?.zoom?.step ?? null,
      });
      appendVideoDebugLog("CAMERA_CONSTRAINTS", { ...cameraTrack.getConstraints() });
      let cameraSettings = reportCameraConfiguration("getUserMedia-wide-source");
      const zoomMinimum = capabilities?.zoom?.min;
      if (!isDesktopRecording && cameraSettings.facingMode && cameraSettings.facingMode !== "user") throw new Error("unexpected-non-user-camera");
      if (!isDesktopRecording && zoomMinimum !== undefined) {
        try {
          const finalZoomConstraints: MediaTrackConstraints = {
            width: cameraSettings.width ? { ideal: cameraSettings.width } : undefined,
            height: cameraSettings.height ? { ideal: cameraSettings.height } : undefined,
            aspectRatio: cameraSettings.aspectRatio ? { ideal: cameraSettings.aspectRatio } : undefined,
            advanced: [{ zoom: zoomMinimum } as MediaTrackConstraintSet],
          };
          await cameraTrack.applyConstraints(finalZoomConstraints);
          cameraSettings = reportCameraConfiguration("final-minimum-zoom");
          let appliedZoom = (cameraSettings as MediaTrackSettings & { zoom?: number }).zoom;
          if (appliedZoom === undefined || Math.abs(appliedZoom - zoomMinimum) >= 0.001) {
            await cameraTrack.applyConstraints({ advanced: [{ zoom: zoomMinimum } as MediaTrackConstraintSet] });
            cameraSettings = reportCameraConfiguration("minimum-zoom-retry");
            appliedZoom = (cameraSettings as MediaTrackSettings & { zoom?: number }).zoom;
          }
          appendVideoDebugLog("CAMERA_MINIMUM_ZOOM_RESULT", {
            requested: zoomMinimum,
            applied: appliedZoom ?? null,
            confirmed: appliedZoom !== undefined && Math.abs(appliedZoom - zoomMinimum) < 0.001,
          });
        } catch (zoomError) {
          appendVideoDebugLog("CAMERA_MINIMUM_ZOOM_RESULT", {
            requested: zoomMinimum,
            applied: null,
            confirmed: false,
            message: zoomError instanceof Error ? zoomError.message : String(zoomError),
          });
        }
      } else {
        appendVideoDebugLog("CAMERA_MINIMUM_ZOOM_RESULT", { requested: null, applied: null, confirmed: false, reason: "unsupported" });
      }
      try {
        const videoInputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        appendVideoDebugLog("CAMERA_DEVICE_INVENTORY", {
          count: videoInputs.length,
          devices: videoInputs.map((device) => ({ deviceIdAvailable: Boolean(device.deviceId), groupIdAvailable: Boolean(device.groupId), labelAvailable: Boolean(device.label) })),
          ...(isDesktopRecording
            ? { selection: "default-desktop-camera" }
            : { selection: "default-user-facing-camera" }),
          reason: "WebRTC does not expose a reliable front-camera field-of-view capability.",
        });
      } catch (deviceError) {
        appendVideoDebugLog("CAMERA_DEVICE_INVENTORY", { count: null, reason: deviceError instanceof Error ? deviceError.message : String(deviceError) });
      }
      streamRef.current = stream;
      pendingStreamRef.current = stream;
      permissionInfoAcceptedRef.current = true;
      try { sessionStorage.setItem(VIDEO_COMMENT_PERMISSION_SESSION_KEY, "1"); } catch {}
      setRecorderState("preparingRecorder");
    } catch (err) {
      logRecorderPhaseError("requestingPermission", err, currentMimeTypeRef.current, recorderRef.current, streamRef.current);
      cleanupRecorder({ clearPreview: true, nextState: "idle" });
      setError(t("movieDetailVideoCameraAccessError"));
      setRecorderState("error");
    }
  }, [appendVideoDebugLog, cleanupRecorder, t]);

  useEffect(() => {
    if (recorderState !== "preparingRecorder") return;
    const stream = pendingStreamRef.current;
    if (!stream) return;
    pendingStreamRef.current = null;
    void startRecorderWithStream(stream).catch((err) => {
      const phase = err instanceof Error && err.message.startsWith("preview") ? "cameraPreview" : "preparingRecorder";
      logRecorderPhaseError(phase, err, currentMimeTypeRef.current, recorderRef.current, stream);
      cleanupRecorder({ clearPreview: true, nextState: "idle" });
      setError(phase === "cameraPreview" ? t("movieDetailVideoCameraPreviewError") : t("movieDetailVideoRecorderStartError"));
      setRecorderState("error");
    });
  }, [cleanupRecorder, recorderState, startRecorderWithStream, t]);

  const cancelToIdle = useCallback(() => { cleanupRecorder({ clearPreview: true, nextState: "idle" }); setError(""); setRecorderState("idle"); }, [cleanupRecorder]);
  const cancelRequest = useCallback(() => { cleanupRecorder({ clearPreview: true, nextState: "menu" }); setError(""); setRecorderState("menu"); }, [cleanupRecorder]);
  const beginRecordingFlow = useCallback(() => { revokePreview(); setError(""); if (permissionInfoAcceptedRef.current) void continueToNativePermissions(); else setRecorderState("permissionInfo"); }, [continueToNativePermissions, revokePreview]);
  const retake = useCallback(() => { revokePreview(); setError(""); void continueToNativePermissions(); }, [continueToNativePermissions, revokePreview]);

  const processSelectedVideo = useCallback(async (file: File | undefined) => {
    if (!file) return;
    selectedFileRef.current = file;
    setRecorderState("validatingSelected");
    setError("");
    revokePreview();
    if (file.type && !file.type.startsWith("video/") && !hasVideoLikeExtension(file.name)) { setError(t("movieDetailVideoUnsupportedFormat")); setRecorderState("error"); return; }
    if (file.size > VIDEO_COMMENT_MAX_BYTES) { setError(t("movieDetailVideoFileTooLarge50Mb")); setRecorderState("error"); return; }
    try {
      mountPreviewImmediately(file, "selected");
    } catch (err) {
      logRecorderPhaseError("fileSelection", err, "", null, null);
      setError(t("movieDetailVideoPreviewPlaybackError"));
      setRecorderState("error");
    }
  }, [mountPreviewImmediately, revokePreview, t]);

  const uploadVideo = useCallback(async (file: File) => {
    if (!file || file.size <= 0 || !previewUrl || !previewPlayable || previewDuration === null || previewDuration <= 0 || previewDuration > VIDEO_COMMENT_MAX_SECONDS || recorderState === "uploading") return;
    const previousState = recorderState;
    setRecorderState("uploading");
    setError("");
    try {
      const data = new FormData();
      data.append("video", file, file.name);
      await apiFetch(`/movies/${encodeURIComponent(movieId)}/video-comments/`, { method: "POST", body: data });
      revokePreview();
      setRecorderState("idle");
      await reloadFirstPage();
    } catch (err) {
      logRecorderPhaseError("upload", err, file.type, recorderRef.current, streamRef.current);
      setError(mapVideoCommentError(err, t));
      setRecorderState(previousState === "previewSelected" ? "previewSelected" : "previewRecorded");
    }
  }, [movieId, previewDuration, previewPlayable, previewUrl, recorderState, reloadFirstPage, revokePreview, t]);
  const sendVideo = useCallback(() => { if (previewFile) void uploadVideo(previewFile); }, [previewFile, uploadVideo]);

  const deleteVideo = useCallback(async (id: string | number) => {
    const key = String(id);
    const video = historyVideosRef.current.get(key);
    if (video) {
      video.pause();
      historyObserverRef.current?.unobserve(video);
      historyVideosRef.current.delete(key);
    }
    visibilityRef.current.delete(key);
    pausedByUserRef.current.delete(key);
    endedRef.current.delete(key);
    if (activeVideoIdRef.current === key) activeVideoIdRef.current = null;
    expandedVideosRef.current.get(key)?.pause();
    expandedVideosRef.current.delete(key);
    setDeletingIds((value) => ({ ...value, [key]: true }));
    try {
      await apiFetch(`/video-comments/${encodeURIComponent(key)}/`, { method: "DELETE" });
      setComments((items) => items.filter((item) => String(item.id) !== key));
      setCount((value) => Math.max(0, value - 1));
    } catch (err) {
      logVideoCommentDevError("Video delete failed", err);
      setHistoryError(t("movieDetailVideoDeleteError"));
    } finally {
      setDeletingIds((value) => ({ ...value, [key]: false }));
    }
  }, [t]);

  const reactToVideo = useCallback(async (id: string | number, reaction: VideoCommentReaction) => {
    const key = String(id);
    if (reactingIdsRef.current.has(key)) return;
    reactingIdsRef.current.add(key);
    setReactingIds((value) => ({ ...value, [key]: true }));
    setHistoryError("");
    try {
      const result = await apiFetch(`/video-comments/${encodeURIComponent(key)}/reaction/`, { method: "PUT", body: JSON.stringify({ reaction }) }) as VideoCommentReactionResponse;
      setComments((items) => items.map((item) => String(item.id) === String(result.video_comment_id) ? { ...item, my_reaction: result.my_reaction, likes_count: result.likes_count, dislikes_count: result.dislikes_count } : item));
    } catch (err) {
      logVideoCommentDevError("Video reaction failed", err);
      setHistoryError(t("movieDetailVideoReactionError"));
    } finally {
      reactingIdsRef.current.delete(key);
      setReactingIds((value) => ({ ...value, [key]: false }));
    }
  }, [t]);

  const toggleHistoryPlayback = useCallback((id: string) => {
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    if (video.paused) void playHistoryVideo(id, true);
    else {
      pausedByUserRef.current.add(id);
      video.pause();
    }
  }, [playHistoryVideo]);

  const selectHistoryVideoForReaction = useCallback((id: string) => {
    if (!window.matchMedia("(min-width: 1280px)").matches || expandedOpenRef.current) return;
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    activeVideoIdRef.current = id;
    if (!video.paused) return;
    void playHistoryVideo(id, true);
  }, [playHistoryVideo]);

  const toggleHistorySound = useCallback((id: string) => {
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    const preference: VideoSoundPreference = video.muted ? "sound-on" : "muted";
    applyVideoSoundPreference(preference, video);
  }, [applyVideoSoundPreference]);



  const openExpandedVideo = useCallback((id: string) => {
    expandedOpenRef.current = true;
    historyVideosRef.current.forEach((video) => { video.pause(); video.currentTime = 0; });
    activeVideoIdRef.current = null;
    setExpandedVideoId(id);
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("qnext:reaction-fullscreen-enter")));
  }, []);

  const navigateExpandedVideo = useCallback((direction: -1 | 1) => {
    if (expandedVideoId === null) return;
    const currentIndex = comments.findIndex((comment) => String(comment.id) === expandedVideoId);
    const target = comments[currentIndex + direction];
    if (currentIndex < 0 || !target) return;
    const currentVideo = expandedVideosRef.current.get(expandedVideoId);
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    setExpandedVideoId(String(target.id));
  }, [comments, expandedVideoId]);

  const resetExpandedDrag = useCallback(() => {
    setExpandedDragOffset(0);
    setExpandedDragAnimating(false);
  }, []);

  const startExpandedDragTransition = useCallback((direction: -1 | 1) => {
    setExpandedDragAnimating(true);
    setExpandedDragOffset(direction > 0 ? -window.innerHeight : window.innerHeight);
    if (expandedSwipeTimerRef.current !== null) window.clearTimeout(expandedSwipeTimerRef.current);
    expandedSwipeTimerRef.current = window.setTimeout(() => {
      const currentIndex = comments.findIndex((comment) => String(comment.id) === expandedVideoId);
      const target = comments[currentIndex + direction];
      const preparedVideo = target ? expandedAdjacentVideosRef.current.get(String(target.id)) : null;
      const canvas = expandedTransitionCanvasRef.current;
      if (preparedVideo && canvas && preparedVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && preparedVideo.videoWidth > 0 && preparedVideo.videoHeight > 0) {
        canvas.width = preparedVideo.videoWidth;
        canvas.height = preparedVideo.videoHeight;
        canvas.getContext("2d")?.drawImage(preparedVideo, 0, 0, canvas.width, canvas.height);
        setShowExpandedTransitionFrame(true);
      }
      navigateExpandedVideo(direction);
      resetExpandedDrag();
      expandedSwipeTimerRef.current = null;
    }, VIDEO_COMMENT_EXPANDED_SWIPE_TRANSITION_MS);
  }, [comments, expandedVideoId, navigateExpandedVideo, resetExpandedDrag]);

  const finishExpandedDrag = useCallback((direction: -1 | 1) => {
    const currentIndex = comments.findIndex((comment) => String(comment.id) === expandedVideoId);
    const target = comments[currentIndex + direction];
    if (!target) return;
    if (!expandedReadyVideoIdsRef.current.has(String(target.id))) {
      pendingExpandedSwipeDirectionRef.current = direction;
      return;
    }
    pendingExpandedSwipeDirectionRef.current = null;
    startExpandedDragTransition(direction);
  }, [comments, expandedVideoId, startExpandedDragTransition]);

  const cancelExpandedDrag = useCallback(() => {
    setExpandedDragAnimating(true);
    setExpandedDragOffset(0);
    if (expandedSwipeTimerRef.current !== null) window.clearTimeout(expandedSwipeTimerRef.current);
    expandedSwipeTimerRef.current = window.setTimeout(() => {
      setExpandedDragAnimating(false);
      expandedSwipeTimerRef.current = null;
    }, VIDEO_COMMENT_EXPANDED_SWIPE_TRANSITION_MS);
  }, []);

  const closeExpandedVideo = useCallback(() => {
    const currentId = expandedVideoId;
    expandedVideosRef.current.forEach((video) => { video.pause(); video.currentTime = 0; });
    expandedOpenRef.current = false;
    pendingExpandedSwipeDirectionRef.current = null;
    setShowExpandedTransitionFrame(false);
    setExpandedVideoId(null);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-video-comment-card="${CSS.escape(currentId ?? "")}"]`)?.scrollIntoView({ block: "center" });
    }, 0);
  }, [expandedVideoId]);

  const navigateFromExpandedVideoToAuthor = useCallback((username: string) => {
    closeExpandedVideo();
    window.requestAnimationFrame(() => onAuthorClick(username));
  }, [closeExpandedVideo, onAuthorClick]);

  useEffect(() => () => {
    if (expandedSwipeTimerRef.current !== null) window.clearTimeout(expandedSwipeTimerRef.current);
  }, []);

  useEffect(() => {
    if (expandedVideoId === null) return;
    expandedScrollLockRef.current = {
      bodyOverflow: document.body.style.overflow,
      rootOverflow: document.documentElement.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
    };
    document.body.style.overflow = "hidden";

    const syncRestoredTrailerScroll = () => {
      if (!expandedScrollLockRef.current) return;
      expandedScrollLockRef.current = {
        bodyOverflow: document.body.style.overflow,
        rootOverflow: document.documentElement.style.overflow,
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
      };
      document.body.style.overflow = "hidden";
    };
    const restoreScroll = () => {
      const previous = expandedScrollLockRef.current;
      if (!previous) return;
      document.body.style.overflow = previous.bodyOverflow;
      document.documentElement.style.overflow = previous.rootOverflow;
      document.body.style.position = previous.bodyPosition;
      document.body.style.top = previous.bodyTop;
      document.body.classList.remove("detail-trailer-active", "trailer-companion-dragging", "trailer-companion-settling");
      delete document.body.dataset.trailerCompanionView;
      expandedScrollLockRef.current = null;
    };

    window.addEventListener("qnext:detail-trailer-close", syncRestoredTrailerScroll);
    window.addEventListener("pagehide", restoreScroll);
    window.addEventListener("beforeunload", restoreScroll);
    return () => {
      window.removeEventListener("qnext:detail-trailer-close", syncRestoredTrailerScroll);
      window.removeEventListener("pagehide", restoreScroll);
      window.removeEventListener("beforeunload", restoreScroll);
      restoreScroll();
    };
  }, [expandedVideoId]);

  useEffect(() => {
    if (expandedVideoId === null) return;
    const video = expandedVideosRef.current.get(expandedVideoId);
    if (!video) return;
    let cancelled = false;

    const playActiveExpandedVideo = () => {
      if (cancelled || expandedVideosRef.current.get(expandedVideoId) !== video) return;
      video.muted = soundPreferenceRef.current !== "sound-on";
      const playPromise = video.play();
      if (playPromise !== undefined) {
        void playPromise.catch((error: unknown) => {
          if (cancelled || expandedVideosRef.current.get(expandedVideoId) !== video) return;
          if (error instanceof DOMException && (error.name === "AbortError" || error.name === "NotAllowedError")) return;
          logVideoCommentDevError("Expanded video autoplay failed", error);
        });
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) playActiveExpandedVideo();
    else video.addEventListener("loadeddata", playActiveExpandedVideo, { once: true });

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", playActiveExpandedVideo);
    };
  }, [expandedVideoId]);

  useEffect(() => {
    const pauseAll = () => {
      historyVideosRef.current.forEach((video) => video.pause());
      expandedVideosRef.current.forEach((video) => video.pause());
      activeVideoIdRef.current = null;
      };
    const handleVisibility = () => {
      if (document.hidden) pauseAll();
      else {
        historyVideosRef.current.forEach((video, id) => {
          const rect = video.getBoundingClientRect();
          const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
          visibilityRef.current.set(id, visible / Math.max(1, rect.height));
        });
        chooseVisibleHistoryVideo();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", pauseAll);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", pauseAll);
      pauseAll();
    };
  }, [chooseVisibleHistoryVideo]);

  const tryWebKitBlobPreviewFallback = useCallback((): boolean => {
    const video = previewVideoRef.current;
    const file = selectedFileRef.current;
    if (!iosWebKit || !video || !file || file.size <= 0 || previewFallbackAttemptedRef.current) return false;
    previewFallbackAttemptedRef.current = true;
    try {
      video.pause();
      video.removeAttribute("src");
      (video as HTMLVideoElement & { srcObject: MediaProvider | Blob | null }).srcObject = file;
      video.load();
      setPreviewError("");
      appendVideoDebugLog("PREVIEW_METHOD", { method: "blob-src-object" });
      return true;
    } catch (err) {
      (video as HTMLVideoElement & { srcObject: MediaProvider | Blob | null }).srcObject = null;
      if (previewUrlRef.current) video.src = previewUrlRef.current;
      video.load();
      logVideoCommentDevError("WebKit Blob srcObject preview fallback failed", err);
      return false;
    }
  }, [appendVideoDebugLog, iosWebKit]);

  useEffect(() => {
    if (!previewUrl || !previewVideoRef.current) return;
    const video = previewVideoRef.current;
    video.srcObject = null;
    previewTimeoutRef.current = window.setTimeout(() => {
      previewTimeoutRef.current = null;
      if (previewPlayableRef.current && previewDurationRef.current !== null) return;
      if (tryWebKitBlobPreviewFallback()) {
        previewTimeoutRef.current = window.setTimeout(() => {
          previewTimeoutRef.current = null;
          if (!previewPlayableRef.current || previewDurationRef.current === null) setPreviewError(t("movieDetailVideoPreviewTimeout"));
        }, 5000);
        return;
      }
      setPreviewError(t("movieDetailVideoPreviewTimeout"));
    }, 10000);
    return () => {
      if (previewTimeoutRef.current !== null) window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    };
  }, [previewUrl, t, tryWebKitBlobPreviewFallback]);

  const handlePreviewMediaEvent = useCallback((eventType: "duration" | "playable", video: HTMLVideoElement) => {
    appendVideoDebugLog("PREVIEW_EVENTS", { event: eventType === "duration" ? "durationchange" : "canplay" });
    const seekableDuration = video.seekable.length > 0 ? video.seekable.end(video.seekable.length - 1) : null;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seekableDuration && seekableDuration > 0 ? seekableDuration : null;
    if (duration !== null && previewDurationRef.current === null) {
      previewDurationRef.current = duration;
      setPreviewDuration(duration);
      if (duration > VIDEO_COMMENT_MAX_SECONDS) setPreviewError(t("movieDetailVideoLongerThan20Seconds"));
    }
    if (eventType === "playable" && !video.error && !previewPlayableRef.current) {
      previewPlayableRef.current = true;
      setPreviewPlayable(true);
    }
    if (previewPlayableRef.current && previewDurationRef.current !== null && previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, [appendVideoDebugLog, t]);


  const isLocalVideoState = recorderState === "preparingRecorder" || recorderState === "recording" || recorderState === "validatingSelected" || recorderState === "previewRecorded" || recorderState === "previewSelected" || recorderState === "uploading";
  const showRecorderShell = recorderState === "preparingRecorder" || recorderState === "recording" || recorderState === "previewRecorded" || recorderState === "previewSelected" || recorderState === "uploading";
  const showMenu = recorderState === "menu";
  const showEmpty = recorderState === "idle" && !initialLoading && !historyError && comments.length === 0;

  const isRecordedPreviewOverlay = previewOrigin === "recorded" && (recorderState === "previewRecorded" || recorderState === "uploading");
  const isRecordingOverlay = recorderState === "preparingRecorder" || recorderState === "recording" || isRecordedPreviewOverlay;


  const reactionContent = <section data-mobile-video-reaction data-recording-overlay={isRecordingOverlay} data-active={active} data-video-sound-preference={soundPreference} className={`${isRecordingOverlay ? "fixed inset-0 z-50 overflow-hidden bg-black px-3 py-3" : "rounded-2xl bg-zinc-950/55 p-4"} ${active || expandedVideoId !== null ? "block" : "hidden"}`}>
    <div ref={mobileHistoryScrollRef} data-mobile-video-reaction-scroll-container="true" className={isRecordingOverlay ? "contents" : "max-h-[50dvh] overflow-y-auto overscroll-contain xl:contents"}>
    <div className="flex flex-col items-center gap-4 pb-[env(safe-area-inset-bottom)] xl:mx-auto xl:max-w-2xl">
      <div ref={menuRef} data-video-reaction-rec data-tour-desktop="detail-rec" data-tour-mobile="detail-rec-mobile" className="relative flex justify-center">
        {!isLocalVideoState ? <button type="button" className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#86ADE0]/70 bg-[#0b1f3a]/80 text-sm font-bold uppercase tracking-[0.18em] text-[#c7dcf6] shadow-[0_0_24px_rgba(134,173,224,0.18)] xl:h-20 xl:w-20 xl:transition xl:hover:border-[#86ADE0] xl:hover:bg-[#12345c]" aria-label={t("movieDetailVideoCommentTitle")} onClick={() => setRecorderState((state) => state === "menu" ? "idle" : "menu")}>Rec</button> : null}
        {showMenu && optionsMenuPosition ? createPortal(<div ref={optionsMenuRef} data-rec-options-menu className="fixed z-[100] w-52 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl" style={optionsMenuPosition}>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10" aria-label={t("movieDetailVideoRecord")} onClick={beginRecordingFlow}><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{t("movieDetailVideoRecord")}</button>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10" aria-label={t("movieDetailVideoUpload")} onClick={() => fileInputRef.current?.click()}><span>▣</span>{t("movieDetailVideoUpload")}</button>
        </div>, document.body) : null}
      </div>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { const input = event.currentTarget; const selectedFile = input.files?.item(0) ?? undefined; input.value = ""; void processSelectedVideo(selectedFile); }} />
      {recorderState === "permissionInfo" ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl"><p className="text-sm font-semibold text-zinc-100">{t("movieDetailVideoPermissionInfo")}</p><div className="mt-5 flex gap-3"><button type="button" className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={() => setRecorderState("menu")}>{t("movieDetailVideoCancel")}</button><button type="button" className="flex-1 rounded-xl bg-[#86ADE0] px-4 py-2 text-sm font-bold text-black" onClick={continueToNativePermissions}>{t("movieDetailVideoContinue")}</button></div></div></div> : null}
      {deleteConfirmId !== null ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl"><p className="text-sm font-semibold text-zinc-100">{t("movieDetailVideoDeleteConfirm")}</p><div className="mt-5 flex gap-3"><button type="button" className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={() => setDeleteConfirmId(null)}>{t("movieDetailVideoCancel")}</button><button type="button" className="flex-1 rounded-xl bg-red-400 px-4 py-2 text-sm font-bold text-black" onClick={() => { const id = deleteConfirmId; setDeleteConfirmId(null); void deleteVideo(id); }}>{t("movieDetailVideoDeleteAction")}</button></div></div></div> : null}
      {recorderState === "validatingSelected" ? <div className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-center"><p className="text-sm text-zinc-300">{t("movieDetailVideoReadingSelectedFile")}</p></div> : null}
      {recorderState === "requestingPermission" ? <div className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-center"><p className="text-sm text-zinc-300">{t("movieDetailVideoRequestingPermission")}</p><button type="button" className="mt-3 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={cancelRequest}>{t("movieDetailVideoCancel")}</button></div> : null}
      {showRecorderShell ? <div className={`w-full space-y-3 ${orientationPaused ? "invisible" : "visible"}`}>
        <div className="relative mx-auto max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ aspectRatio: previewAspectRatio, height: recorderState === "preparingRecorder" || recorderState === "recording" || isRecordedPreviewOverlay ? VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT : undefined, width: previewOrigin === "selected" ? "100%" : undefined, maxHeight: VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT }}>
          {recorderState === "preparingRecorder" || recorderState === "recording" ? <><canvas ref={canvasRef} className="h-full w-full object-contain" aria-label={t("movieDetailVideoRecording")} /><video ref={livePreviewRef} autoPlay muted playsInline className="hidden" /></> : previewUrl ? <video key={previewUrl} ref={previewVideoRef} src={previewUrl} muted={previewMuted} controls={false} preload="auto" playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="h-full w-full object-contain" onClick={(event) => event.currentTarget.paused ? void event.currentTarget.play() : event.currentTarget.pause()} onVolumeChange={(event) => setPreviewMuted(event.currentTarget.muted)} onLoadedMetadata={(event) => { setPreviewAspectRatio(previewOrigin === "recorded" ? 9 / 16 : event.currentTarget.videoWidth / Math.max(1, event.currentTarget.videoHeight)); appendVideoDebugLog("PREVIEW_EVENTS", { event: "loadedmetadata" }); handlePreviewMediaEvent("duration", event.currentTarget); }} onDurationChange={(event) => { appendVideoDebugLog("PREVIEW_EVENTS", { event: "durationchange" }); handlePreviewMediaEvent("duration", event.currentTarget); }} onLoadedData={(event) => { appendVideoDebugLog("PREVIEW_EVENTS", { event: "loadeddata" }); handlePreviewMediaEvent("playable", event.currentTarget); }} onCanPlay={(event) => { appendVideoDebugLog("PREVIEW_EVENTS", { event: "canplay" }); handlePreviewMediaEvent("playable", event.currentTarget); }} onError={(event) => { const mediaError = event.currentTarget.error; appendVideoDebugLog("PREVIEW_EVENTS", { event: "error" }); appendVideoDebugLog("PREVIEW_ERROR", { code: mediaError?.code ?? null, message: mediaError?.message ?? "" }); logVideoCommentDevError("Video preview playback failed", mediaError); if (!tryWebKitBlobPreviewFallback()) setPreviewError(t("movieDetailVideoPreviewPlaybackError")); }} /> : null}
          {recorderState === "preparingRecorder" ? <span className="absolute left-3 top-3 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-bold text-zinc-100">{t("movieDetailVideoPreparingCamera")}</span> : null}
          {recorderState === "recording" ? <span className="absolute left-3 top-3 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-100">{t("movieDetailVideoRecording")} {formatVideoDuration(recordingSeconds)}</span> : null}
          {(recorderState === "previewRecorded" || recorderState === "previewSelected" || recorderState === "uploading") && previewDuration !== null ? <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">{formatVideoDuration(previewDuration)}</span> : null}
          {(recorderState === "previewRecorded" || recorderState === "previewSelected") && previewUrl ? <><button type="button" className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-lg text-white" aria-label={t(previewMuted ? "movieDetailVideoSoundOn" : "movieDetailVideoMute")} onClick={() => { const video = previewVideoRef.current; if (!video) return; video.muted = !video.muted; setPreviewMuted(video.muted); }}>{previewMuted ? "🔇" : "🔊"}</button><button type="button" className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl text-white" aria-label={t("movieDetailVideoExpand")} onClick={() => setPreviewExpanded(true)}>⛶</button></> : null}
          {(recorderState === "previewRecorded" || recorderState === "previewSelected" || recorderState === "uploading") && (!previewPlayable || previewDuration === null) && !previewError ? <span className="absolute inset-x-3 top-3 rounded-xl bg-zinc-950/85 px-3 py-2 text-center text-xs font-bold text-zinc-100">{t("movieDetailVideoPreparingPreview")}</span> : null}
        </div>
        {recorderState === "recording" && !orientationPaused ? <div className="relative z-20 flex gap-3 pb-3"><button type="button" className="min-h-11 flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={cancelToIdle}>{t("movieDetailVideoCancel")}</button><button type="button" className="min-h-11 flex-1 rounded-xl bg-[#86ADE0] px-4 py-2 text-sm font-bold text-black" onClick={finishRecording}>{t("movieDetailVideoStop")}</button></div> : null}
        {recorderState === "previewRecorded" || recorderState === "previewSelected" || recorderState === "uploading" ? <>{previewError ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-200">{previewError}</p> : null}<div className="relative z-20 flex gap-3 pb-3"><button type="button" disabled={recorderState === "uploading"} className="min-h-11 flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100 disabled:opacity-60" onClick={recorderState === "previewRecorded" ? retake : cancelToIdle}>{recorderState === "previewRecorded" ? t("movieDetailVideoRetake") : t("movieDetailVideoCancel")}</button><button type="button" disabled={recorderState === "uploading" || !previewFile || previewFile.size <= 0 || previewDuration === null || previewDuration <= 0 || previewDuration > VIDEO_COMMENT_MAX_SECONDS || !previewPlayable || !!previewError} className="min-h-11 flex-1 rounded-xl bg-[#86ADE0] px-4 py-2 text-sm font-bold text-black disabled:opacity-60" onClick={sendVideo}>{recorderState === "uploading" ? t("movieDetailVideoUploading") : t("movieDetailVideoSend")}</button></div></> : null}
      </div> : null}
      {recorderState === "error" && error ? <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"><p>{error}</p><button type="button" className="mt-3 rounded-lg border border-red-200/30 px-3 py-1 text-red-100" onClick={() => setRecorderState("menu")}>{t("movieDetailVideoRetry")}</button></div> : null}
    </div>
    {videoDebugEnabled ? <aside className="mt-4 max-h-56 w-full overflow-auto rounded-xl border border-amber-400/40 bg-black p-3 font-mono text-[10px] text-amber-200 xl:hidden" aria-label="Video debug"><strong>VIDEO DEBUG ACTIVO</strong>{videoDebugEntries.map((entry, index) => <div key={`${index}-${entry}`}>{entry}</div>)}</aside> : null}
    <button type="button" data-history-carousel-arrow="left" disabled={recorderState !== "idle" || !canScrollHistoryLeft} className="hidden" aria-label="Anterior" onClick={() => scrollHistoryCarousel(-1)}>←</button>
    <div data-history-carousel-viewport className="relative">
    <div ref={historyScrollRef} data-desktop-video-reaction-history data-can-scroll-left={canScrollHistoryLeft} data-can-scroll-right={canScrollHistoryRight} className="desktop-dark-scrollbar mt-5 space-y-3 xl:mx-auto xl:max-h-[32rem] xl:max-w-3xl xl:overflow-y-auto xl:pr-2">
      {recorderState === "idle" && initialLoading ? <p className="text-center text-sm text-zinc-400">{t("movieDetailVideoLoadingVideos")}</p> : null}
      {recorderState === "idle" && historyError ? <div className="text-center text-sm text-red-200"><p>{historyError}</p><button type="button" className="mt-2 rounded-lg border border-white/10 px-3 py-1 text-zinc-100" onClick={reloadFirstPage}>{t("movieDetailVideoRetry")}</button></div> : null}
      {showEmpty ? <p className="text-center text-sm text-zinc-500">{t("movieDetailVideoEmpty")}</p> : null}
      {recorderState === "idle" ? comments.map((comment) => {
        const id = String(comment.id);
        const state = playerStates[id] ?? { paused: true, muted: soundPreference !== "sound-on" };
        return <article key={comment.id} data-video-comment-card={id} className="desktop-video-reaction-card relative space-y-1.5 bg-transparent p-2.5 xl:space-y-1 xl:p-2">
          {notificationReactionOverlay?.id === id ? <div className={`notification-video-reaction-overlay notification-video-reaction-overlay--${notificationReactionOverlay.reaction}${notificationReactionOverlay.reducedMotion ? " notification-video-reaction-overlay--reduced" : ""}`} aria-hidden="true"><span>{notificationReactionOverlay.reaction === "like" ? "👍" : "👎"}</span>{notificationReactionOverlay.reaction === "like" && !notificationReactionOverlay.reducedMotion ? <i className="notification-reaction-confetti">✦ · ✧ · ✦</i> : null}</div> : null}
          <div className="relative mx-auto flex max-w-full items-center gap-3 xl:w-full xl:gap-2"><button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs text-zinc-300 xl:h-8 xl:w-8" aria-label={`Ver perfil de ${comment.user.username}`} onClick={() => onAuthorClick(comment.user.username)}>{comment.user.avatar ? // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.user.avatar} alt="" className="h-full w-full object-cover" /> : comment.user.username.slice(0,2).toUpperCase()}</button><div className="flex min-w-0 flex-1 items-baseline gap-3 xl:flex-col xl:items-start xl:gap-0"><button type="button" className="min-w-0 truncate text-left text-sm font-bold text-zinc-100 hover:text-[#86ADE0]" onClick={() => onAuthorClick(comment.user.username)}>{comment.user.username}</button><time className="shrink-0 text-xs text-zinc-500">{new Date(comment.created_at).toLocaleDateString()}</time></div><VideoCommentReactionButtons comment={comment} disabled={!!reactingIds[id]} t={t} onReact={(commentId, reaction) => void reactToVideo(commentId, reaction)} className="shrink-0 xl:hidden" />{comment.can_delete === true ? <div data-video-delete-menu className="relative"><button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-300 hover:bg-white/10" disabled={!!deletingIds[id]} aria-label={t("movieDetailVideoDelete")} onClick={() => setDeleteMenuId((current) => current === id ? null : id)}>⋮</button>{deleteMenuId === id ? <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-white/10 bg-zinc-950 p-1 shadow-xl"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-200 hover:bg-white/10" onClick={() => { setDeleteMenuId(null); setDeleteConfirmId(comment.id); }}>{t("movieDetailVideoDelete")}</button></div> : null}</div> : null}</div>
          <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-black xl:mx-auto xl:w-fit xl:max-w-full">
            <div className="group relative inline-flex max-w-full shrink-0 overflow-hidden rounded-xl [contain:layout_paint]">
              <video data-video-comment-player="true" data-video-comment-id={id} src={comment.video_url} preload="metadata" playsInline controls={false} controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="block h-auto w-auto max-w-full shrink-0 object-contain [contain:layout_paint]" style={{ maxHeight: VIDEO_COMMENT_CARD_VIDEO_HEIGHT }} onLoadedMetadata={(event) => lockHistoryPlayerGeometry(event.currentTarget)} onClick={() => toggleHistoryPlayback(id)} onPlay={(event) => { const video = event.currentTarget; logHistoryPlayerGeometry("before-play", video); activeVideoIdRef.current = id; pauseOtherHistoryVideos(id); syncPlayerState(video); requestAnimationFrame(() => logHistoryPlayerGeometry("playing", video)); }} onPause={(event) => { logHistoryPlayerGeometry("paused", event.currentTarget); syncPlayerState(event.currentTarget); }} onVolumeChange={(event) => syncPlayerState(event.currentTarget)} onEnded={(event) => { endedRef.current.add(id); syncPlayerState(event.currentTarget); if (window.matchMedia("(min-width: 1280px)").matches && !document.body.classList.contains("detail-trailer-active")) playNextVisibleHistoryVideo(id); }} />
              <VideoCommentReactionButtons comment={comment} disabled={!!reactingIds[id]} t={t} onReact={(commentId, reaction) => { selectHistoryVideoForReaction(String(commentId)); void reactToVideo(commentId, reaction); }} className="pointer-events-none absolute left-2 top-2 z-10 hidden opacity-0 xl:flex xl:group-hover:pointer-events-auto xl:group-hover:opacity-100" />
              <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-7 transition-opacity duration-150 ${state.paused ? "xl:opacity-0" : "xl:opacity-0 xl:group-hover:opacity-100"}`}>
                <button type="button" className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-base text-white ${state.paused ? "xl:pointer-events-none" : "xl:pointer-events-none xl:group-hover:pointer-events-auto"}`} aria-label={t(state.muted ? "movieDetailVideoSoundOn" : "movieDetailVideoMute")} onClick={(event) => { event.stopPropagation(); toggleHistorySound(id); }}>{state.muted ? "🔇" : "🔊"}</button>
                <button type="button" className={`pointer-events-auto ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-lg text-white ${state.paused ? "xl:pointer-events-none" : "xl:pointer-events-none xl:group-hover:pointer-events-auto"}`} aria-label={t("movieDetailVideoExpand")} onClick={(event) => { event.stopPropagation(); openExpandedVideo(id); }}>⛶</button>
              </div>
            </div>
          </div>
        </article>;
      }) : null}
      {recorderState === "idle" && loadingMore ? <p className="text-center text-sm text-zinc-400">{t("movieDetailVideoLoadingVideos")}</p> : null}{recorderState === "idle" ? <div ref={sentinelRef} aria-hidden="true" className="h-1" /> : null}
    </div>
    </div>
    </div>
    <button type="button" data-history-carousel-arrow="right" disabled={recorderState !== "idle" || !canScrollHistoryRight} className="hidden" aria-label="Siguiente" onClick={() => scrollHistoryCarousel(1)}>→</button>
    {orientationPaused ? <div className="fixed inset-0 z-[200] flex h-[100dvh] w-[100dvw] items-center justify-center bg-black px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center" role="alert" aria-live="assertive"><div className="w-full max-w-lg"><span className="video-reaction-phone mx-auto mb-6 block h-20 w-11 rounded-xl border-2 border-white" aria-hidden="true" /><p className="text-lg font-bold leading-relaxed text-white sm:text-xl">{t("movieDetailVideoRotatePortrait")}</p></div></div> : null}
    {previewExpanded && previewUrl ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black p-3" role="dialog" aria-modal="true" aria-label={t("movieDetailVideoExpand")}><button type="button" className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900/80 text-2xl text-white" aria-label={t("movieDetailVideoCloseExpanded")} onClick={() => setPreviewExpanded(false)}>×</button><video src={previewUrl} autoPlay muted playsInline controls={false} controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className={`${previewOrigin === "recorded" ? "aspect-[9/16] h-[calc(100dvh-1.5rem)] w-auto" : "max-h-[calc(100dvh-1.5rem)] max-w-full"} object-contain`} /></div> : null}
    {expandedVideoId !== null ? (() => {
      const comment = comments.find((item) => String(item.id) === expandedVideoId);
      if (!comment) return null;
      const currentIndex = comments.findIndex((item) => String(item.id) === expandedVideoId);
      const dragDirection: -1 | 0 | 1 = expandedDragOffset < 0 ? 1 : expandedDragOffset > 0 ? -1 : 0;
      const adjacentComment = dragDirection === 0 ? null : comments[currentIndex + dragDirection] ?? null;
      const state = playerStates[expandedVideoId] ?? { paused: true, muted: true };
      const swipeTransition = expandedDragAnimating ? `transform ${VIDEO_COMMENT_EXPANDED_SWIPE_TRANSITION_MS}ms ${VIDEO_COMMENT_EXPANDED_SWIPE_EASING}` : "none";
      return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black p-2" role="dialog" aria-modal="true" aria-label={t("movieDetailVideoExpandedFeed")}>
        <div className="relative h-full w-full overflow-hidden touch-none">
          {adjacentComment ? <div key={String(adjacentComment.id)} className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ transform: `translateY(calc(${dragDirection > 0 ? "100dvh" : "-100dvh"} + ${expandedDragOffset}px))`, transition: swipeTransition }}><video ref={(node) => { const id = String(adjacentComment.id); if (node) expandedAdjacentVideosRef.current.set(id, node); else expandedAdjacentVideosRef.current.delete(id); }} src={adjacentComment.video_url} muted playsInline preload="auto" controls={false} controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="max-h-[calc(100dvh-1rem)] max-w-full object-contain" onLoadedData={() => { const id = String(adjacentComment.id); expandedReadyVideoIdsRef.current.add(id); const pendingDirection = pendingExpandedSwipeDirectionRef.current; if (pendingDirection !== null && comments[currentIndex + pendingDirection] && String(comments[currentIndex + pendingDirection].id) === id) { pendingExpandedSwipeDirectionRef.current = null; startExpandedDragTransition(pendingDirection); } }} /></div> : null}
          <canvas ref={expandedTransitionCanvasRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 z-10 m-auto max-h-[calc(100dvh-1rem)] max-w-full object-contain xl:hidden ${showExpandedTransitionFrame ? "block" : "hidden"}`} />
          <div key={expandedVideoId} className="absolute inset-0 flex items-center justify-center" style={{ transform: `translateY(${expandedDragOffset}px)`, transition: swipeTransition }}>
            <div className="relative flex max-h-[calc(100dvh-1rem)] max-w-full items-center">
              <button type="button" disabled={currentIndex <= 0} aria-label="Anterior" className="absolute right-full z-30 mr-3 hidden h-11 w-11 items-center justify-center rounded-full border border-[#86ADE0] bg-zinc-950/80 text-xl text-[#86ADE0] shadow-lg disabled:border-zinc-600 disabled:text-zinc-600 xl:flex" onClick={(event) => { event.stopPropagation(); navigateExpandedVideo(-1); }}>←</button>
              <div className="relative inline-flex max-h-[calc(100dvh-1rem)] max-w-full overflow-hidden">
              <video data-expanded-video-id={expandedVideoId} ref={(node) => { if (node) expandedVideosRef.current.set(expandedVideoId, node); else expandedVideosRef.current.delete(expandedVideoId); }} src={comment.video_url} autoPlay muted playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="block max-h-[calc(100dvh-1rem)] max-w-full object-contain" onLoadedData={() => setShowExpandedTransitionFrame(false)} onTouchStart={(event) => { const touch = event.touches[0]; expandedTouchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY, vertical: null } : null; suppressExpandedTapRef.current = false; setExpandedDragAnimating(false); }} onTouchMove={(event) => { const start = expandedTouchStartRef.current; const touch = event.touches[0]; if (!start || !touch) return; const deltaX = touch.clientX - start.x; const deltaY = touch.clientY - start.y; if (start.vertical === null && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= VIDEO_COMMENT_EXPANDED_SWIPE_INTENT_PX) start.vertical = Math.abs(deltaY) > Math.abs(deltaX); if (!start.vertical) return; event.preventDefault(); suppressExpandedTapRef.current = true; const direction = deltaY < 0 ? 1 : -1; const hasTarget = comments[currentIndex + direction] !== undefined; setExpandedDragOffset(hasTarget ? deltaY : deltaY * 0.2); }} onTouchEnd={(event) => { const start = expandedTouchStartRef.current; const touch = event.changedTouches[0]; expandedTouchStartRef.current = null; if (!start || !touch || !start.vertical) { if (expandedDragOffset !== 0) cancelExpandedDrag(); return; } const deltaX = touch.clientX - start.x; const deltaY = touch.clientY - start.y; const direction: -1 | 1 = deltaY < 0 ? 1 : -1; if (Math.abs(deltaY) >= VIDEO_COMMENT_EXPANDED_SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX) && comments[currentIndex + direction]) finishExpandedDrag(direction); else cancelExpandedDrag(); }} onTouchCancel={() => { expandedTouchStartRef.current = null; if (expandedDragOffset !== 0) cancelExpandedDrag(); }} onClick={(event) => { if (suppressExpandedTapRef.current) { suppressExpandedTapRef.current = false; return; } if (event.currentTarget.paused) void event.currentTarget.play(); else event.currentTarget.pause(); }} onPlay={(event) => syncPlayerState(event.currentTarget)} onPause={(event) => syncPlayerState(event.currentTarget)} onVolumeChange={(event) => syncPlayerState(event.currentTarget)} />
              <VideoCommentReactionButtons comment={comment} disabled={!!reactingIds[expandedVideoId]} expanded t={t} onReact={(commentId, reaction) => void reactToVideo(commentId, reaction)} className="absolute left-3 top-3 z-20 bg-transparent xl:flex-col xl:items-start xl:gap-0" />
              <VideoReactionMovieMetadata poster={moviePoster} title={movieTitle} onTitleClick={() => { closeExpandedVideo(); router.push(`/movies/${encodeURIComponent(movieId)}`); }} />
              <button type="button" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl text-white" aria-label={t("movieDetailVideoCloseExpanded")} onClick={closeExpandedVideo}>×</button>
              <button type="button" className="absolute bottom-4 left-3 z-20 flex min-w-0 items-center gap-2 rounded-full bg-black/25 pr-2 text-sm font-semibold text-white" aria-label={`Ver perfil de ${comment.user.username}`} onClick={(event) => { event.stopPropagation(); navigateFromExpandedVideoToAuthor(comment.user.username); }}><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[10px]">{comment.user.avatar ? // eslint-disable-next-line @next/next/no-img-element
                <img src={comment.user.avatar} alt="" className="h-full w-full object-cover" /> : comment.user.username.slice(0, 2).toUpperCase()}</span><span className="max-w-36 truncate">{comment.user.username}</span></button>
              <button type="button" className="absolute bottom-4 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl text-white" aria-label={t(state.muted ? "movieDetailVideoSoundOn" : "movieDetailVideoMute")} onClick={(event) => { event.stopPropagation(); const video = expandedVideosRef.current.get(expandedVideoId); if (!video) return; applyVideoSoundPreference(video.muted ? "sound-on" : "muted", video); }}>{state.muted ? "🔇" : "🔊"}</button>
              </div>
              <button type="button" disabled={currentIndex < 0 || currentIndex >= comments.length - 1} aria-label="Siguiente" className="absolute left-full z-30 ml-3 hidden h-11 w-11 items-center justify-center rounded-full border border-[#86ADE0] bg-zinc-950/80 text-xl text-[#86ADE0] shadow-lg disabled:border-zinc-600 disabled:text-zinc-600 xl:flex" onClick={(event) => { event.stopPropagation(); navigateExpandedVideo(1); }}>→</button>
            </div>
          </div>
        </div>
      </div>;
    })() : null}
  </section>;

  return isRecordingOverlay && typeof document !== "undefined" ? createPortal(reactionContent, document.body) : reactionContent;
}

function MovieDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useAppBranding();
  const { locale, t } = useI18n();
  const params = useParams<{ id: string }>();
  const movieId = params?.id ? String(params.id) : "";
  const debugNotificationTarget = searchParams.get("debugNotificationTarget") === "1";
  const [notificationDiagnosticEntries, setNotificationDiagnosticEntries] = useState<string[]>([]);
  const [notificationDiagnosticViewport, setNotificationDiagnosticViewport] = useState<"unknown" | "mobile" | "desktop">("unknown");
  const [notificationDiagnosticStatus, setNotificationDiagnosticStatus] = useState<"idle" | "pending" | "processing" | "consumed" | "failed">("idle");

  const logNotificationTarget = useCallback<NotificationDiagnosticLogger>((event, details = {}) => {
    if (!debugNotificationTarget && process.env.NODE_ENV === "production") return;
    const entry = `${new Date().toISOString()} ${event} ${JSON.stringify(details)}`;
    console.debug(`[NotificationTarget][${event}]`, details);
    if (debugNotificationTarget) {
      setNotificationDiagnosticEntries((current) => [...current.slice(-17), entry]);
      if (event === "TARGET NOT CONSUMED") setNotificationDiagnosticStatus("failed");
    }
  }, [debugNotificationTarget]);

  useEffect(() => {
    if (!debugNotificationTarget) return;
    const updateViewport = () => setNotificationDiagnosticViewport(window.matchMedia("(min-width: 1280px)").matches ? "desktop" : "mobile");
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [debugNotificationTarget]);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [movieError, setMovieError] = useState("");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [followingUsers, setFollowingUsers] = useState<SocialUser[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState<SocialUser | null>(null);
  const [authenticatedUsername, setAuthenticatedUsername] = useState("");
  const [friendRequestsRestricted, setFriendRequestsRestricted] = useState<boolean | null>(null);

  const [publicComments, setPublicComments] = useState<SocialComment[]>([]);
  const [publicNext, setPublicNext] = useState<string | null>(null);
  const [loadingPublicMore, setLoadingPublicMore] = useState(false);
  const [directedConversations, setDirectedConversations] = useState<DirectedConversation[]>([]);
  const [expandedConversationKey, setExpandedConversationKey] = useState<string | null>(null);
  const [loadingDirectedMoreByKey, setLoadingDirectedMoreByKey] = useState<Record<string, boolean>>({});
  const [loadingFullHistoryByConversationKey, setLoadingFullHistoryByConversationKey] = useState<Record<string, boolean>>({});
  const [fullLoadedByConversationKey, setFullLoadedByConversationKey] = useState<Record<string, boolean>>({});

  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingDirected, setLoadingDirected] = useState(true);

  const [publicError, setPublicError] = useState("");
  const [directedError, setDirectedError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [reactionError, setReactionError] = useState("");
  const [commentActionErrorById, setCommentActionErrorById] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentValue, setEditingCommentValue] = useState("");
  const [savingEditCommentId, setSavingEditCommentId] = useState<string | null>(null);
  const [deletingCommentIds, setDeletingCommentIds] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [directReplyDrafts, setDirectReplyDrafts] = useState<Record<string, string>>({});
  const [directReplySubmitting, setDirectReplySubmitting] = useState<Record<string, boolean>>({});
  const [directReplyErrors, setDirectReplyErrors] = useState<Record<string, string>>({});
  const directReplySubmittingRef = useRef(new Set<string>());
  const directedConversationsRef = useRef<DirectedConversation[]>([]);
  const directedPollingInFlightRef = useRef(false);
  const processedDirectedNotificationIdsRef = useRef(new Set<string>());
  const [publicSearchQuery, setPublicSearchQuery] = useState("");
  const [directedSearchQuery, setDirectedSearchQuery] = useState("");
  const [selectedPublicFilterUser, setSelectedPublicFilterUser] = useState<CommentFilterUser | null>(null);
  const [selectedDirectedFilterUser, setSelectedDirectedFilterUser] = useState<CommentFilterUser | null>(null);
  const [isPublicSearchOpen, setIsPublicSearchOpen] = useState(false);
  const [isDirectedSearchOpen, setIsDirectedSearchOpen] = useState(false);
  const [activeCommentsTab, setActiveCommentsTab] = useState<"public" | "directed">("public");
  const [trailerCompanionView, setTrailerCompanionView] = useState<TrailerCompanionView>("reaction");
  const [trailerCompanionOpen, setTrailerCompanionOpen] = useState(false);
  const companionTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const companionTouchAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const companionTransitionTimerRef = useRef<number | null>(null);
  const [commentInputMode, setCommentInputMode] = useState<CommentInputMode>("video-comment");
  const onboardingInitialDetailViewRef = useRef<{ commentInputMode: CommentInputMode; activeCommentsTab: "public" | "directed" } | null>(null);
  const [pendingDirectedNotificationTarget, setPendingDirectedNotificationTarget] =
    useState<PendingDirectedNotificationTarget | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const textCommentStartRef = useRef<HTMLDivElement | null>(null);
  const videoCommentStartRef = useRef<HTMLDivElement | null>(null);
  const pendingCommentInputScrollRef = useRef<CommentInputMode | null>(null);
  const directedCommentsSectionRef = useRef<HTMLElement | null>(null);
  const publicCommentsScrollRef = useRef<HTMLDivElement | null>(null);
  const publicCommentsSectionRef = useRef<HTMLElement | null>(null);
  const directedCommentsScrollRef = useRef<HTMLDivElement | null>(null);
  const processedDirectedTargetRef = useRef<string | null>(null);
  const processedPublicTargetRef = useRef<string | null>(null);
  const publicMainTabRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    const prepareDetailStep = (event: Event) => {
      const action = (event as CustomEvent<{ action?: OnboardingPrepareAction }>).detail?.action;
      if (!action?.startsWith("detail-")) return;
      const mobile = window.matchMedia("(max-width: 1279px)").matches;
      const isMobileAction = action.startsWith("detail-mobile-");
      if (mobile !== isMobileAction) return;
      if (action === "detail-restore" || action === "detail-mobile-restore") {
        const initial = onboardingInitialDetailViewRef.current;
        if (!initial) return;
        setCommentInputMode(initial.commentInputMode);
        setActiveCommentsTab(initial.activeCommentsTab);
        onboardingInitialDetailViewRef.current = null;
        return;
      }
      onboardingInitialDetailViewRef.current ??= { commentInputMode, activeCommentsTab };
      if (action === "detail-video" || action === "detail-mobile-video") setCommentInputMode("video-comment");
      if (action === "detail-comments-public" || action === "detail-mobile-comments-public") {
        setCommentInputMode("text-comment");
        setActiveCommentsTab("public");
      }
      if (action === "detail-comments-directed" || action === "detail-mobile-comments-directed") {
        setCommentInputMode("text-comment");
        setActiveCommentsTab("directed");
      }
    };
    window.addEventListener(onboardingPrepareStepEventName, prepareDetailStep);
    return () => window.removeEventListener(onboardingPrepareStepEventName, prepareDetailStep);
  }, [activeCommentsTab, commentInputMode]);

  const notificationTarget = useMemo(() => {
    const section = searchParams.get("section");
    const sectionCommentId = normalizeId(searchParams.get("commentId"));
    const rawReaction = searchParams.get("reaction")?.toLowerCase();
    const reaction = rawReaction === "like" || rawReaction === "dislike" ? rawReaction : null;
    if (section === "public-comments" && sectionCommentId) {
      return { type: "public-comment", id: sectionCommentId, reaction } as const;
    }
    const target = searchParams.get("target");
    const targetId = normalizeId(searchParams.get("targetId"));
    if (!targetId || (target !== "public-comment" && target !== "video-reaction")) return null;
    return { type: target, id: targetId, reaction } as const;
  }, [searchParams]);

  const receivedNotificationTargetRef = useRef<{ type: "public-comment" | "video-reaction"; id: string; reaction: VideoCommentReaction | null } | null>(null);
  const [receivedNotificationTarget, setReceivedNotificationTarget] = useState<typeof receivedNotificationTargetRef.current>(null);
  const previousDiagnosticMainTabRef = useRef(commentInputMode);
  const previousDiagnosticCommentsTabRef = useRef(activeCommentsTab);

  useEffect(() => {
    if (!debugNotificationTarget || !notificationTarget || receivedNotificationTargetRef.current) return;
    const received = { type: notificationTarget.type, id: notificationTarget.id, reaction: notificationTarget.reaction };
    receivedNotificationTargetRef.current = received;
    setReceivedNotificationTarget(received);
    setNotificationDiagnosticStatus("pending");
    logNotificationTarget("DETAIL RECEIVED", {
      target: received.type,
      targetId: received.id,
      reaction: received.reaction,
      source: "query param",
      commentInputMode,
      activeCommentsTab,
      url: window.location.href,
    });
  }, [activeCommentsTab, commentInputMode, debugNotificationTarget, logNotificationTarget, notificationTarget]);

  useEffect(() => {
    if (!debugNotificationTarget || notificationDiagnosticStatus === "idle" || notificationDiagnosticStatus === "consumed") return;
    const previous = previousDiagnosticMainTabRef.current;
    if (previous !== commentInputMode) {
      logNotificationTarget("MAIN TAB CHANGE", { from: previous, to: commentInputMode, source: "observed state render" });
      previousDiagnosticMainTabRef.current = commentInputMode;
    }
  }, [commentInputMode, debugNotificationTarget, logNotificationTarget, notificationDiagnosticStatus]);

  useEffect(() => {
    if (!debugNotificationTarget || notificationDiagnosticStatus === "idle" || notificationDiagnosticStatus === "consumed") return;
    const previous = previousDiagnosticCommentsTabRef.current;
    if (previous !== activeCommentsTab) {
      logNotificationTarget("COMMENTS SUBTAB CHANGE", { from: previous, to: activeCommentsTab, source: "observed state render" });
      previousDiagnosticCommentsTabRef.current = activeCommentsTab;
    }
  }, [activeCommentsTab, debugNotificationTarget, logNotificationTarget, notificationDiagnosticStatus]);

  useEffect(() => {
    if (!debugNotificationTarget || notificationDiagnosticStatus !== "pending") return;
    const frame = requestAnimationFrame(() => setNotificationDiagnosticStatus("processing"));
    return () => cancelAnimationFrame(frame);
  }, [debugNotificationTarget, notificationDiagnosticStatus]);

  const consumeNotificationTarget = useCallback((details: Record<string, unknown> = {}) => {
    const received = receivedNotificationTargetRef.current ?? notificationTarget;
    if (debugNotificationTarget) {
      logNotificationTarget("CONSUME", {
        reason: details.reason ?? "target positioning completed",
        mainTab: commentInputMode,
        activeCommentsTab,
        commentDomFound: Boolean(received?.type === "public-comment" && document.querySelector(`[data-public-comment-id="${CSS.escape(received.id)}"]`)),
        videoDomFound: Boolean(received?.type === "video-reaction" && document.querySelector(`[data-video-comment-card="${CSS.escape(received.id)}"]`)),
        timestamp: Date.now(),
      });
      setNotificationDiagnosticStatus("consumed");
    }
    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete("target");
    cleaned.delete("targetId");
    cleaned.delete("reaction");
    if (received?.type === "public-comment") {
      cleaned.delete("section");
      cleaned.delete("commentId");
    }
    const query = cleaned.toString();
    router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [activeCommentsTab, commentInputMode, debugNotificationTarget, logNotificationTarget, notificationTarget, router, searchParams]);


  const getMobileStickyOffset = useCallback(() => {
    // Keep targets below the primary mobile sticky header plus the page gap; desktop keeps the existing static layout.
    if (typeof window === "undefined" || window.matchMedia("(min-width: 1280px)").matches) return 0;
    const headerHeight = stickyHeaderRef.current?.getBoundingClientRect().height ?? 0;
    const containerGap = parseFloat(window.getComputedStyle(stickyHeaderRef.current?.parentElement ?? document.documentElement).rowGap || "0") || 0;
    return headerHeight + containerGap;
  }, []);

  const scrollCommentStartIntoView = useCallback(
    (mode: CommentInputMode, behavior: ScrollBehavior = "smooth") => {
      const target = mode === "text-comment" ? textCommentStartRef.current : videoCommentStartRef.current;
      if (!target || typeof window === "undefined") return;

      const stickyOffset = getMobileStickyOffset();
      const scrollableParent = (() => {
        let parent = target.parentElement;
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          if (/(auto|scroll|overlay)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
          parent = parent.parentElement;
        }
        return null;
      })();

      if (scrollableParent) {
        const targetTop = target.getBoundingClientRect().top - scrollableParent.getBoundingClientRect().top + scrollableParent.scrollTop;
        scrollableParent.scrollTo({ top: Math.max(targetTop - stickyOffset, 0), behavior });
        return;
      }

      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(targetTop - stickyOffset, 0), behavior });
    },
    [getMobileStickyOffset],
  );

  const handleCommentInputTabClick = useCallback(
    (mode: CommentInputMode) => {
      logNotificationTarget("main tab handler", { requestedMainTab: mode, mainTabBefore: commentInputMode });
      if (window.matchMedia("(min-width: 1280px)").matches) {
        setCommentInputMode(mode);
        requestAnimationFrame(() => {
          if (mode === "video-comment") {
            videoCommentStartRef.current?.querySelector<HTMLElement>("[data-desktop-video-reaction-history]")?.scrollTo({ top: 0 });
          } else {
            publicCommentsScrollRef.current?.scrollTo({ top: 0 });
            directedCommentsScrollRef.current?.scrollTo({ top: 0 });
          }
        });
        return;
      }
      if (mode === "video-comment") {
        videoCommentStartRef.current?.querySelector<HTMLElement>("[data-mobile-video-reaction-scroll-container]")?.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (commentInputMode === mode) {
        scrollCommentStartIntoView(mode);
        return;
      }

      pendingCommentInputScrollRef.current = mode;
      setCommentInputMode(mode);
    },
    [commentInputMode, logNotificationTarget, scrollCommentStartIntoView],
  );

  useEffect(() => {
    if (pendingCommentInputScrollRef.current !== commentInputMode) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scrollCommentStartIntoView(commentInputMode, "auto");
        pendingCommentInputScrollRef.current = null;
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [commentInputMode, scrollCommentStartIntoView]);

  const canShowDirectedComments = friendRequestsRestricted === false;
  const shouldRenderDirectedComments = friendRequestsRestricted !== true;

  const fetchMovieDetail = useCallback(async () => {
    if (!movieId) return null;

    const movieEndpoints = [
      buildMovieDetailEndpoint(movieId, MOVIE_DETAIL_ENDPOINT_TEMPLATE),
      ...MOVIE_DETAIL_FALLBACK_ENDPOINT_TEMPLATES.map((template) => buildMovieDetailEndpoint(movieId, template)),
    ];

    for (let index = 0; index < movieEndpoints.length; index += 1) {
      const endpoint = movieEndpoints[index];

      console.log("[movie-detail-debug] detail request", {
        url: joinApiUrl(endpoint),
        method: "GET",
        endpoint,
        isOfficial: index === 0,
      });

      try {
        const response = await debugApiRequest(endpoint);
        console.log("[movie-detail-debug] detail response", {
          url: response.url,
          method: response.method,
          status: response.status,
          endpoint,
        });

        const rawMovie = toRecord(response.body);
        if (!rawMovie) return null;

        return normalizeMovie(rawMovie, 0);
      } catch (error) {
        const status = error instanceof ApiError ? error.status : null;
        console.log("[movie-detail-debug] detail response", {
          url: joinApiUrl(endpoint),
          method: "GET",
          status,
          endpoint,
          body: error instanceof Error ? error.message : String(error),
        });

        if (!(error instanceof ApiError) || ![404, 405].includes(error.status) || index >= movieEndpoints.length - 1) {
          throw error;
        }
      }
    }

    throw new Error("No se pudo cargar detalle con endpoints disponibles");
  }, [movieId]);

  const searchMentionSuggestions = useCallback(async (query: string): Promise<Friend[]> => {
    const payload = await apiFetch(`/friends/?search=${encodeURIComponent(query)}`);
    const results = toRecord(payload)?.results;
    const nextSuggestions = parseFriends(Array.isArray(results) ? results : []);
    console.log("[mentions-debug] Search payload and normalized results:", { payload, nextSuggestions });
    return nextSuggestions;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!movieId) return;

    let cancelled = false;

    setMovie(null);
    setMovieLoading(true);
    setCreditsLoading(false);
    setMovieError("");
    setPublicError("");
    setDirectedError("");
    setFriendRequestsRestricted(null);
    setFriends([]);
    setFollowingUsers([]);
    setPublicComments([]);
    setPublicNext(null);
    setDirectedConversations([]);
    setExpandedConversationKey(null);
    setSelectedPublicFilterUser(null);
    setSelectedDirectedFilterUser(null);
    setPublicSearchQuery("");
    setDirectedSearchQuery("");

    const loadMovie = async () => {
      try {
        const normalizedMovie = await fetchMovieDetail();
        if (cancelled) return;

        if (!normalizedMovie) {
          setMovieError(translate(locale, "movieDetailMovieParseError"));
          return;
        }

        setMovie(normalizedMovie);
        setCreditsLoading(true);

        void fetchMovieCredits(normalizedMovie.id)
          .then((credits) => {
            if (cancelled) return;
            if (!credits.cast.length && !credits.directors.length) return;
            setMovie((current) => {
              if (!current || String(current.id) !== String(normalizedMovie.id)) return current;
              return {
                ...current,
                cast: credits.cast.length ? credits.cast : current.cast,
                castMembers: credits.cast.length ? credits.cast.map((credit) => credit.name) : current.castMembers,
                directors: credits.directors.length ? credits.directors : current.directors,
                director: credits.directors.length ? credits.directors.map((credit) => credit.name).join(" · ") : current.director,
              };
            });
          })
          .catch((creditsError) => {
            if (!cancelled) console.warn("[movie-detail-debug] credits request failed", creditsError);
          })
          .finally(() => {
            if (!cancelled) setCreditsLoading(false);
          });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }

        setMovieError(translate(locale, "movieDetailMovieLoadError"));
      } finally {
        if (!cancelled) setMovieLoading(false);
      }
    };

    const loadPublicComments = async () => {
      setLoadingPublic(true);
      const publicEndpoint = buildMoviePublicSubmitEndpoint(movieId);
      console.log("[movie-comments-debug] public GET url", joinApiUrl(publicEndpoint));
      try {
        const response = await debugApiRequest(publicEndpoint);
        if (cancelled) return;
        console.log("[movie-comments-debug] public GET status", response.status);
        console.log("[movie-comments-debug] public GET response", response.body);
        const parsed = parseCommentsPage(response.body, "public");
        setPublicComments(parsed.comments);
        setPublicNext(normalizeEndpointPath(parsed.next));
        setPublicError("");
      } catch (error) {
        if (cancelled) return;
        console.log("[movie-comments-debug] public GET status", error instanceof ApiError ? error.status : null);
        console.log("[movie-comments-debug] public GET response", error instanceof Error ? error.message : String(error));
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setPublicError(translate(locale, "movieDetailPublicCommentsLoadError"));
      } finally {
        if (!cancelled) setLoadingPublic(false);
      }
    };

    const loadMentionUsers = async () => {
      const [friendsResult, followingResult] = await Promise.all([
        fetchWithFallbacks<unknown>([FRIENDS_ENDPOINT, ...FRIENDS_FALLBACK_ENDPOINTS], "[mentions-debug]").then(
          ({ payload, endpoint, usedFallback }) => ({ ok: true as const, payload, endpoint, usedFallback }),
          (error) => ({ ok: false as const, error }),
        ),
        getTopFollowing().then(
          (payload) => ({ ok: true as const, payload }),
          (error) => ({ ok: false as const, error }),
        ),
      ]);

      if (cancelled) return;
      if (!friendsResult.ok && friendsResult.error instanceof ApiError && friendsResult.error.status === 401) {
        router.replace("/login");
        return;
      }
      if (!followingResult.ok && followingResult.error instanceof ApiError && followingResult.error.status === 401) {
        router.replace("/login");
        return;
      }
      if (friendsResult.ok) {
        console.log("[mentions-debug] Friends payload:", {
          endpoint: friendsResult.endpoint,
          usedFallback: friendsResult.usedFallback,
          payload: friendsResult.payload,
        });
        const normalizedFriends = parseFriends(friendsResult.payload);
        console.log("[mentions-debug] Normalized friends list:", normalizedFriends);
        setFriends(normalizedFriends);
      }
      setFollowingUsers(followingResult.ok ? followingResult.payload : []);
    };

    const loadDirectedComments = async () => {
      setLoadingDirected(true);
      try {
        const [meResult, privacyResult] = await Promise.all([
          getMyProfile().then(
            (payload) => ({ ok: true as const, payload }),
            (error) => ({ ok: false as const, error }),
          ),
          getProfilePrivacySettings().then(
            (payload) => ({ ok: true as const, payload }),
            (error) => ({ ok: false as const, error }),
          ),
        ]);

        if (cancelled) return;
        if (!meResult.ok && meResult.error instanceof ApiError && meResult.error.status === 401) {
          router.replace("/login");
          return;
        }
        if (!privacyResult.ok && privacyResult.error instanceof ApiError && privacyResult.error.status === 401) {
          router.replace("/login");
          return;
        }

        const meUsername = meResult.ok ? meResult.payload?.username ?? "" : "";
        if (meResult.ok) setAuthenticatedUser(meResult.payload);
        if (meUsername) setAuthenticatedUsername(meUsername);

        if (!privacyResult.ok) {
          setDirectedError(translate(locale, "movieDetailDirectedCommentsLoadError"));
          return;
        }

        setFriendRequestsRestricted(privacyResult.payload.friendRequestsRestricted);
        if (privacyResult.payload.friendRequestsRestricted) {
          setDirectedConversations([]);
          return;
        }

        const directedEndpoints = buildMovieDirectedFetchEndpoints(movieId);
        const directedEndpoint = directedEndpoints[0];
        console.log("[movie-comments-debug] directed GET url", joinApiUrl(directedEndpoint));
        const directedReceivedResult = await fetchDirectedConversationsWithFallbacks(directedEndpoints, meUsername, movieId).then(
          ({ conversations, payload, endpoint, usedFallback }) => ({ ok: true as const, conversations, payload, endpoint, usedFallback }),
          (error) => ({ ok: false as const, error }),
        );

        if (cancelled) return;
        if (directedReceivedResult.ok) {
          console.log("[movie-comments-debug] directed GET endpoint", {
            endpoint: directedReceivedResult.endpoint,
            usedFallback: directedReceivedResult.usedFallback,
          });
          console.log("[movie-comments-debug] directed GET response", directedReceivedResult.payload);
          setDirectedConversations(directedReceivedResult.conversations);
          setLoadingFullHistoryByConversationKey({});
          setFullLoadedByConversationKey({});
          setDirectedError("");
        } else {
          console.log("[movie-comments-debug] directed GET status", directedReceivedResult.error instanceof ApiError ? directedReceivedResult.error.status : null);
          console.log("[movie-comments-debug] directed GET response", directedReceivedResult.error instanceof Error ? directedReceivedResult.error.message : String(directedReceivedResult.error));
          if (directedReceivedResult.error instanceof ApiError && directedReceivedResult.error.status === 401) {
            router.replace("/login");
            return;
          }
          setDirectedError(translate(locale, "movieDetailDirectedCommentsLoadError"));
        }
      } finally {
        if (!cancelled) setLoadingDirected(false);
      }
    };

    void loadMovie();
    void loadPublicComments();
    void loadMentionUsers();
    void loadDirectedComments();

    return () => {
      cancelled = true;
    };
  }, [fetchMovieDetail, locale, movieId, router]);

  const handleMovieRated = useCallback(
    async (_movieId: Movie["id"], score: number, _payload?: unknown) => {
      void _payload;
      try {
        const refreshedMovie = await fetchMovieDetail();
        if (refreshedMovie) {
          setMovie((current) =>
            current && String(current.id) === String(refreshedMovie.id)
              ? {
                  ...refreshedMovie,
                  cast: current.cast.length ? current.cast : refreshedMovie.cast,
                  castMembers: current.castMembers.length ? current.castMembers : refreshedMovie.castMembers,
                  directors: current.directors.length ? current.directors : refreshedMovie.directors,
                  director: current.director || refreshedMovie.director,
                }
              : refreshedMovie,
          );
          setMovieError("");
          return;
        }
      } catch (error) {
        console.error("Movie refresh after rating failed:", error);
      }

      setMovie((current) => (current ? { ...current, myRating: score } : current));
    },
    [fetchMovieDetail],
  );


  useEffect(() => {
    if (!expandedConversationKey) return;
    if (!directedConversations.some((conversation) => conversation.key === expandedConversationKey)) {
      setExpandedConversationKey(null);
    }
  }, [directedConversations, expandedConversationKey]);

  useEffect(() => {
    directedConversationsRef.current = directedConversations;
  }, [directedConversations]);

  useEffect(() => {
    const isTrailerDirectedView = trailerCompanionOpen && trailerCompanionView === "directed-comments";
    if (!expandedConversationKey || (commentInputMode !== "text-comment" && !isTrailerDirectedView)) return;

    const isDirectedSectionVisible = () =>
      activeCommentsTab === "directed" ||
      window.matchMedia("(min-width: 1280px)").matches ||
      isTrailerDirectedView;

    let cancelled = false;

    const markVisibleReceivedMessagesAsRead = async (conversation: DirectedConversation) => {
      const receivedMessageIds = new Set(
        conversation.messages
          .filter((message) => message.direction === "received")
          .map((message) => String(message.id)),
      );
      if (receivedMessageIds.size === 0 || cancelled || document.visibilityState !== "visible") return;

      try {
        const summary = await getMyNotificationsSummary();
        if (cancelled) return;
        const matchingIds = summary.items
          .filter(
            (notification) =>
              notification.type === "private_message" &&
              notification.movieId !== null &&
              String(notification.movieId) === movieId &&
              notification.directedCommentId !== null &&
              receivedMessageIds.has(String(notification.directedCommentId)) &&
              isRealNotificationId(notification.id) &&
              !processedDirectedNotificationIdsRef.current.has(String(notification.id)),
          )
          .map((notification) => notification.id);
        if (matchingIds.length === 0) return;

        matchingIds.forEach((id) => processedDirectedNotificationIdsRef.current.add(String(id)));
        try {
          await markNotificationsAsReadBatch(matchingIds);
        } catch {
          matchingIds.forEach((id) => processedDirectedNotificationIdsRef.current.delete(String(id)));
        }
      } catch {
        // Notification refresh is best-effort and must not disturb the open conversation.
      }
    };

    const refreshExpandedConversation = async () => {
      if (
        cancelled ||
        directedPollingInFlightRef.current ||
        document.visibilityState !== "visible" ||
        !isDirectedSectionVisible()
      ) return;

      const target = directedConversationsRef.current.find((conversation) => conversation.key === expandedConversationKey);
      if (!target) return;

      directedPollingInFlightRef.current = true;
      try {
        let refreshedTarget = target;
        if (target.messagesEndpoint) {
          const payload = await apiFetch(target.messagesEndpoint, { cache: "no-store" });
          const parsed = parseCommentsPage(payload, "directed");
          if (cancelled) return;
          const polledMessages = parsed.comments.map((message) => ({
            ...message,
            direction:
              message.direction ??
              (normalizeUsername(message.authorUsername)?.toLowerCase() === normalizeUsername(authenticatedUsername)?.toLowerCase()
                ? "sent"
                : "received"),
          } satisfies SocialComment));
          refreshedTarget = {
            ...target,
            messages: mergeUniqueMessages(target.messages, polledMessages),
            next: normalizeEndpointPath(parsed.next) ?? target.next,
          };
          setDirectedConversations((current) =>
            current.map((conversation) => {
              if (conversation.key !== expandedConversationKey) return conversation;
              return {
                ...conversation,
                messages: mergeUniqueMessages(conversation.messages, polledMessages),
                next: normalizeEndpointPath(parsed.next) ?? conversation.next,
              };
            }),
          );
        } else {
          const result = await fetchWithFallbacks<unknown>(buildMovieDirectedFetchEndpoints(movieId), "[movie-detail-debug]");
          if (cancelled) return;
          const snapshots = groupDirectedConversations(result.payload, authenticatedUsername, movieId);
          const incomingTarget = snapshots.find((conversation) => conversation.key === expandedConversationKey);
          if (incomingTarget) {
            refreshedTarget = { ...incomingTarget, messages: mergeUniqueMessages(target.messages, incomingTarget.messages) };
            setDirectedConversations((current) => mergeDirectedConversationSnapshots(current, snapshots));
          }
        }
        await markVisibleReceivedMessagesAsRead(refreshedTarget);
      } catch {
        // Polling is intentionally silent; preserve history and retry on the next interval.
      } finally {
        directedPollingInFlightRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshExpandedConversation();
    };
    void refreshExpandedConversation();
    const intervalId = window.setInterval(() => void refreshExpandedConversation(), 4_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    activeCommentsTab,
    authenticatedUsername,
    commentInputMode,
    expandedConversationKey,
    movieId,
    trailerCompanionOpen,
    trailerCompanionView,
  ]);

  const handleAuthorNavigation = useCallback(
    (username: string) => {
      if (!username) return;
      if (authenticatedUsername && username === authenticatedUsername) {
        router.push("/profile-feed");
        return;
      }
      router.push(`/users/${encodeURIComponent(username)}`);
    },
    [authenticatedUsername, router],
  );

  const appendPublicComments = useCallback(async () => {
    if (!publicNext || loadingPublicMore) return;
    setLoadingPublicMore(true);
    try {
      const payload = await apiFetch(publicNext);
      const parsed = parseCommentsPage(payload, "public");
      setPublicComments((current) => {
        const existing = new Set(current.map((comment) => String(comment.id)));
        const incoming = parsed.comments.filter((comment) => !existing.has(String(comment.id)));
        return [...current, ...incoming];
      });
      setPublicNext(normalizeEndpointPath(parsed.next));
    } catch {
      // keep current UI stable if infinite scroll fails
    } finally {
      setLoadingPublicMore(false);
    }
  }, [loadingPublicMore, publicNext]);

  const loadMoreConversationMessages = useCallback(
    async (conversationKey: string) => {
      const target = directedConversations.find((conversation) => conversation.key === conversationKey);
      if (!target?.next || loadingDirectedMoreByKey[conversationKey]) return;

      setLoadingDirectedMoreByKey((current) => ({ ...current, [conversationKey]: true }));
      try {
        const payload = await apiFetch(target.next);
        const parsed = parseCommentsPage(payload, "directed");
        setDirectedConversations((current) =>
          current.map((conversation) => {
            if (conversation.key !== conversationKey) return conversation;
            return {
              ...conversation,
              messages: mergeUniqueMessages(conversation.messages, parsed.comments),
              next: normalizeEndpointPath(parsed.next),
            };
          }),
        );
      } catch {
        // keep current UI stable if infinite scroll fails
      } finally {
        setLoadingDirectedMoreByKey((current) => ({ ...current, [conversationKey]: false }));
      }
    },
    [directedConversations, loadingDirectedMoreByKey],
  );

  const handleToggleConversation = useCallback(
    async (conversation: DirectedConversation) => {
      const isExpanded = expandedConversationKey === conversation.key;
      setExpandedConversationKey(isExpanded ? null : conversation.key);
      if (isExpanded) return;
      if (!conversation.messagesEndpoint) return;
      if (fullLoadedByConversationKey[conversation.key]) return;
      if (loadingFullHistoryByConversationKey[conversation.key]) return;

      setLoadingFullHistoryByConversationKey((current) => ({ ...current, [conversation.key]: true }));
      try {
        const payload = await apiFetch(conversation.messagesEndpoint);
        const parsed = parseCommentsPage(payload, "directed");
        setDirectedConversations((current) =>
          current.map((currentConversation) => {
            if (currentConversation.key !== conversation.key) return currentConversation;
            return {
              ...currentConversation,
              messages: mergeUniqueMessages(currentConversation.messages, parsed.comments),
              next: normalizeEndpointPath(parsed.next) ?? currentConversation.next,
            };
          }),
        );
        setFullLoadedByConversationKey((current) => ({ ...current, [conversation.key]: true }));
      } catch {
        // keep current preview stable if full history endpoint fails
      } finally {
        setLoadingFullHistoryByConversationKey((current) => ({ ...current, [conversation.key]: false }));
      }
    },
    [expandedConversationKey, fullLoadedByConversationKey, loadingFullHistoryByConversationKey],
  );

  const openCommentMovieSection = useCallback(() => {
    setCommentInputMode("text-comment");
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    if (searchParams.get("section") !== "directed-comments" && section !== "public-comments") return;

    if (section === "public-comments") {
      const commentId = normalizeId(searchParams.get("commentId"));
      if (!commentId) return;
      const targetKey = `${movieId}:${commentId}`;
      if (publicMainTabRequestedRef.current === targetKey) return;
      publicMainTabRequestedRef.current = targetKey;
      openCommentMovieSection();
      setSelectedPublicFilterUser(null);
      setPublicSearchQuery("");
      logNotificationTarget("public target received", {
        target: "public-comment",
        targetId: commentId,
        viewport: window.matchMedia("(min-width: 1280px)").matches ? "desktop" : "mobile",
        mainTabBefore: commentInputMode,
      });
      return;
    }

    const actorId = normalizeId(searchParams.get("actorId"));
    const actorUsername = normalizeUsername(searchParams.get("actorUsername"));
    const commentId = normalizeId(searchParams.get("commentId"));
    if (!actorId && !actorUsername) return;

    const targetKey = `${movieId}:${actorId ?? ""}:${actorUsername ?? ""}:${commentId ?? ""}`;
    if (processedDirectedTargetRef.current === targetKey) return;
    processedDirectedTargetRef.current = targetKey;
    setActiveCommentsTab("directed");
    openCommentMovieSection();
    setPendingDirectedNotificationTarget({ actorId, actorUsername, commentId, conversationKey: null, stage: "find-conversation" });
  }, [commentInputMode, logNotificationTarget, movieId, openCommentMovieSection, searchParams]);

  useEffect(() => {
    if (notificationTarget?.type !== "public-comment" || commentInputMode !== "text-comment") return;
    const mobile = !window.matchMedia("(min-width: 1280px)").matches;
    if (mobile && activeCommentsTab !== "public") setActiveCommentsTab("public");
    logNotificationTarget("main tab rendered", {
      targetId: notificationTarget.id,
      mainTabAfterRender: commentInputMode,
      mobileCommentsSubtab: mobile ? (activeCommentsTab === "public" ? "public" : "public requested") : "desktop simultaneous panels",
    });
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => logNotificationTarget("main tab after two frames", { targetId: notificationTarget.id, mainTab: commentInputMode, activeCommentsTab }));
    });
    const after500ms = window.setTimeout(() => logNotificationTarget("main tab after 500ms", { targetId: notificationTarget.id, mainTab: commentInputMode, activeCommentsTab }), 500);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(after500ms);
    };
  }, [activeCommentsTab, commentInputMode, logNotificationTarget, notificationTarget]);

  useEffect(() => {
    if (!notificationTarget) return;
    logNotificationTarget("main tab state changed", { target: notificationTarget.type, targetId: notificationTarget.id, mainTab: commentInputMode, activeCommentsTab });
  }, [activeCommentsTab, commentInputMode, logNotificationTarget, notificationTarget]);

  useEffect(() => {
    if (notificationTarget?.type !== "video-reaction") return;
    setCommentInputMode("video-comment");
    setTrailerCompanionView("reaction");
  }, [notificationTarget]);

  useEffect(() => {
    const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches;
    if (notificationTarget?.type !== "public-comment" || commentInputMode !== "text-comment" || (!desktop && activeCommentsTab !== "public") || loadingPublic || loadingPublicMore) return;
    const targetKey = `${movieId}:${notificationTarget.id}`;
    if (processedPublicTargetRef.current === targetKey) return;
    const container = publicCommentsScrollRef.current;
    const comment = container?.querySelector<HTMLElement>(`[data-public-comment-id="${CSS.escape(notificationTarget.id)}"]`);
    const commentHistory = document.querySelector<HTMLElement>('[data-comment-history]');
    const selectedTextTab = document.querySelector<HTMLElement>('[data-comment-input-mode="text-comment"][aria-selected="true"]');
    const publicSection = publicCommentsSectionRef.current;
    const textContentVisible = Boolean(commentHistory && getComputedStyle(commentHistory).display !== "none" && selectedTextTab && publicSection && getComputedStyle(publicSection).display !== "none");
    logNotificationTarget("public comment lookup", {
      targetId: notificationTarget.id,
      mainTabAfterRender: commentInputMode,
      mobileCommentsSubtab: desktop ? "desktop simultaneous panels" : activeCommentsTab,
      publicContainerFound: Boolean(container),
      publicCommentFound: Boolean(comment),
      textContentVisible,
    });
    if (!container || !comment || !textContentVisible) {
      if (publicNext) void appendPublicComments();
      logNotificationTarget("TARGET NOT CONSUMED", { targetId: notificationTarget.id, reason: !textContentVisible ? "text comment DOM is not visibly active" : "public comment DOM is missing" });
      return;
    }

    let cancelled = false;
    const positionTarget = async () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";
      const mobile = !window.matchMedia("(min-width: 1280px)").matches;
      publicCommentsSectionRef.current?.scrollIntoView({ behavior: mobile ? "auto" : behavior, block: "start", inline: "nearest" });
      if (!mobile) await waitForNotificationScroll(window, reducedMotion);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (cancelled) return;

      const containerStyle = getComputedStyle(container);
      const hasInternalScroll = /(auto|scroll|overlay)/.test(containerStyle.overflowY) && container.scrollHeight > container.clientHeight;
      if (hasInternalScroll) {
        const containerRect = container.getBoundingClientRect();
        const commentRect = comment.getBoundingClientRect();
        const intendedFinalScrollTop = container.scrollTop + commentRect.top - containerRect.top - (container.clientHeight - commentRect.height) / 2;
        if (mobile) console.log("[MOBILE NOTIFICATION SCROLL]", {
          targetType: "public-comment",
          targetId: notificationTarget.id,
          phase: "final",
          scrollContainer: "public-comments",
          scrollTop: container.scrollTop,
          intendedFinalScrollTop,
          behavior,
          positioningLock: true,
        });
        container.scrollTo({
          top: intendedFinalScrollTop,
          behavior,
        });
        await waitForNotificationScroll(container, reducedMotion);
      } else {
        if (mobile) console.log("[MOBILE NOTIFICATION SCROLL]", {
          targetType: "public-comment",
          targetId: notificationTarget.id,
          phase: "final",
          scrollContainer: "page",
          scrollTop: window.scrollY,
          intendedFinalScrollTop: comment.getBoundingClientRect().top + window.scrollY - (window.innerHeight - comment.getBoundingClientRect().height) / 2,
          behavior,
          positioningLock: true,
        });
        comment.scrollIntoView({ behavior, block: "center", inline: "nearest" });
        await waitForNotificationScroll(window, reducedMotion);
      }
      if (cancelled) return;
      if (mobile) {
        let finalContainerRect = hasInternalScroll ? container.getBoundingClientRect() : document.documentElement.getBoundingClientRect();
        let finalCommentRect = comment.getBoundingClientRect();
        const visibleTop = hasInternalScroll ? finalContainerRect.top : 0;
        const visibleBottom = hasInternalScroll ? finalContainerRect.bottom : window.innerHeight;
        const correctionPx = finalCommentRect.top < visibleTop
          ? finalCommentRect.top - visibleTop
          : finalCommentRect.bottom > visibleBottom
            ? finalCommentRect.bottom - visibleBottom
            : 0;
        if (correctionPx !== 0) {
          if (hasInternalScroll) container.scrollBy({ top: correctionPx, behavior: "auto" });
          else window.scrollBy({ top: correctionPx, behavior: "auto" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          finalContainerRect = hasInternalScroll ? container.getBoundingClientRect() : document.documentElement.getBoundingClientRect();
          finalCommentRect = comment.getBoundingClientRect();
        }
        console.log("[MOBILE NOTIFICATION FINAL]", {
          targetType: "public-comment",
          targetId: notificationTarget.id,
          finalTop: finalCommentRect.top,
          finalBottom: finalCommentRect.bottom,
          containerTop: hasInternalScroll ? finalContainerRect.top : 0,
          containerBottom: hasInternalScroll ? finalContainerRect.bottom : window.innerHeight,
          fullyVisible: hasInternalScroll
            ? finalCommentRect.top >= finalContainerRect.top && finalCommentRect.bottom <= finalContainerRect.bottom
            : finalCommentRect.top >= 0 && finalCommentRect.bottom <= window.innerHeight,
          correctionPx,
        });
      }
      comment.classList.add("notification-public-comment-highlight");
      window.setTimeout(() => comment.classList.remove("notification-public-comment-highlight"), reducedMotion ? 900 : 2100);
      processedPublicTargetRef.current = targetKey;
      publicMainTabRequestedRef.current = null;
      logNotificationTarget("target consumed", { target: "public-comment", targetId: notificationTarget.id, timestamp: Date.now() });
      consumeNotificationTarget();
    };
    void positionTarget();
    return () => { cancelled = true; };
  }, [activeCommentsTab, appendPublicComments, commentInputMode, consumeNotificationTarget, loadingPublic, loadingPublicMore, logNotificationTarget, movieId, notificationTarget, publicNext, selectedPublicFilterUser]);

  useEffect(() => {
    const target = pendingDirectedNotificationTarget;
    if (!target || target.stage !== "find-conversation" || loadingDirected) return;
    const normalizedActorUsername = normalizeUsername(target.actorUsername)?.toLowerCase();
    const conversationByActorId = target.actorId
      ? directedConversations.find((candidate) => candidate.counterpartKey === `counterpart:${target.actorId}`)
      : null;
    const conversation =
      conversationByActorId ??
      directedConversations.find((candidate) =>
        Boolean(normalizedActorUsername && normalizeUsername(candidate.otherUsername)?.toLowerCase() === normalizedActorUsername),
      );

    if (!conversation) {
      directedCommentsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingDirectedNotificationTarget(null);
      return;
    }
    setPendingDirectedNotificationTarget({ ...target, conversationKey: conversation.key, stage: "open-conversation" });
  }, [directedConversations, loadingDirected, pendingDirectedNotificationTarget]);

  useEffect(() => {
    const target = pendingDirectedNotificationTarget;
    if (!target || target.stage !== "open-conversation" || !target.conversationKey) return;
    const conversation = directedConversations.find((candidate) => candidate.key === target.conversationKey);
    if (!conversation) {
      setPendingDirectedNotificationTarget(null);
      return;
    }

    void (async () => {
      if (expandedConversationKey !== conversation.key) await handleToggleConversation(conversation);
      setPendingDirectedNotificationTarget((current) =>
        current?.conversationKey === conversation.key ? { ...current, stage: "scroll-to-message" } : current,
      );
    })();
  }, [directedConversations, expandedConversationKey, handleToggleConversation, pendingDirectedNotificationTarget]);

  useEffect(() => {
    const target = pendingDirectedNotificationTarget;
    if (!target || target.stage !== "scroll-to-message" || !target.conversationKey || expandedConversationKey !== target.conversationKey || loadingFullHistoryByConversationKey[target.conversationKey]) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const section = directedCommentsSectionRef.current;
        const messages = Array.from(section?.querySelectorAll<HTMLElement>("[data-directed-comment-id]") ?? []);
        const exactMessage = messages.find((element) => element.dataset.directedCommentId === target.commentId);
        const lastReceivedMessage = messages.find((element) => element.dataset.directedCommentDirection === "received");
        section?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        (exactMessage ?? lastReceivedMessage)?.scrollIntoView({ behavior: "smooth", block: "center" });
        setPendingDirectedNotificationTarget(null);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [directedConversations, expandedConversationKey, loadingFullHistoryByConversationKey, pendingDirectedNotificationTarget]);

  const handleSubmitComment = async ({ text, mentionUsername }: { text: string; mentionUsername: string | null }) => {
    if (!movieId) return;

    const allowedMentionUsername = canShowDirectedComments ? mentionUsername : null;

    setIsSubmitting(true);
    setComposerError("");

    try {
      const mode = allowedMentionUsername ? "directed" : "public";
      const publicEndpoint = buildMoviePublicSubmitEndpoint(movieId);
      const directedEndpoints = buildMovieDirectedSubmitEndpoints(movieId);
      const payload = allowedMentionUsername ? { body: text, mentioned_username: allowedMentionUsername } : { body: text };

      console.log("[movie-comments-debug] submit mode:", mode);
      console.log("[movie-comments-debug] textarea value:", text);
      console.log("[movie-comments-debug] mentioned_username final:", allowedMentionUsername);
      console.log("[movie-comments-debug] submit payload:", payload);

      let submitResponse: Awaited<ReturnType<typeof debugApiRequest>> | null = null;
      let submitError: unknown = null;

      if (mode === "directed") {
        for (let index = 0; index < directedEndpoints.length; index += 1) {
          const endpoint = directedEndpoints[index];
          try {
            const requestPayload = { ...payload, movie_id: movieId };
            console.log("[movie-comments-debug] endpoint used:", endpoint);
            console.log("[movie-comments-debug] submit url:", joinApiUrl(endpoint));
            console.log("[movie-comments-debug] final request payload:", requestPayload);
            submitResponse = await debugApiRequest(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestPayload),
            });
            break;
          } catch (error) {
            submitError = error;
            if (error instanceof ApiError && [404, 405].includes(error.status) && index < directedEndpoints.length - 1) {
              continue;
            }
            throw error;
          }
        }
      } else {
        console.log("[movie-comments-debug] endpoint used:", publicEndpoint);
        console.log("[movie-comments-debug] submit url:", joinApiUrl(publicEndpoint));
        console.log("[movie-comments-debug] final request payload:", payload);
        submitResponse = await debugApiRequest(publicEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!submitResponse) {
        throw submitError ?? new Error("No endpoint available for directed submit.");
      }

      console.log("[movie-comments-debug] submit response status:", submitResponse.status);
      const parsedSubmittedComment = parseComments([submitResponse.body], mode)[0];

      if (mode === "directed") {
        try {
          const refreshed = await fetchWithFallbacks<unknown>(buildMovieDirectedFetchEndpoints(movieId), "[movie-detail-debug]");
          setDirectedConversations(groupDirectedConversations(refreshed.payload, authenticatedUsername, movieId));
          setLoadingFullHistoryByConversationKey({});
          setFullLoadedByConversationKey({});
          setDirectedError("");
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 401) {
            router.replace("/login");
            return;
          }
          if (parsedSubmittedComment) {
            const counterpart = buildCounterpartData(parsedSubmittedComment, authenticatedUsername);
            const conversationKey = `conversation-${counterpart.counterpartKey}`;
            setDirectedConversations((current) => {
              const target = current.find((conversation) => conversation.key === conversationKey);
              const nextMessage: SocialComment = { ...parsedSubmittedComment, direction: counterpart.direction };
              if (!target) {
                return [
                  {
                    key: conversationKey,
                    counterpartKey: counterpart.counterpartKey,
                    otherUsername: counterpart.username,
                    otherDisplayName: counterpart.displayName,
                    otherAvatar: counterpart.avatar,
                    restrictedCurrentUser: parsedSubmittedComment.authorRestrictedCurrentUser,
                    messages: [nextMessage],
                    messagesEndpoint: null,
                    next: null,
                    lastMessageAt: parsedSubmittedComment.createdAt,
                  },
                  ...current,
                ];
              }
              return current.map((conversation) =>
                conversation.key === conversationKey
                  ? {
                      ...conversation,
                      messages: [nextMessage, ...conversation.messages.filter((message) => String(message.id) !== String(nextMessage.id))],
                      lastMessageAt: parsedSubmittedComment.createdAt,
                    }
                  : conversation,
              );
            });
            setExpandedConversationKey(conversationKey);
          }
        }
      } else {
        try {
          const refreshed = await debugApiRequest(buildMoviePublicSubmitEndpoint(movieId));
          const parsed = parseCommentsPage(refreshed.body, "public");
          setPublicComments(parsed.comments);
          setPublicNext(normalizeEndpointPath(parsed.next));
          setPublicError("");
        } catch (refreshError) {
          if (refreshError instanceof ApiError && refreshError.status === 401) {
            router.replace("/login");
            return;
          }
          if (parsedSubmittedComment) {
            setPublicComments((current) => [parsedSubmittedComment, ...current]);
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        console.log("[movie-comments-debug] submit response status:", error.status);
        console.log("[movie-comments-debug] submit response body on error:", error.message);
        if (error.code === "bilateral_restriction") {
          setComposerError("No puedes enviar un comentario dirigido a este usuario.");
          return;
        }
      }
      console.error("Comment submit error", error);
      setComposerError(translate(locale, "movieDetailCommentPostError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDirectReply = async (conversation: DirectedConversation) => {
    const conversationKey = conversation.key;
    const body = (directReplyDrafts[conversationKey] ?? "").trim();
    const recipientUsername = conversation.otherUsername;
    if (!movieId || !body || !recipientUsername || directReplySubmittingRef.current.has(conversationKey)) return;

    directReplySubmittingRef.current.add(conversationKey);
    setDirectReplySubmitting((current) => ({ ...current, [conversationKey]: true }));
    setDirectReplyErrors((current) => ({ ...current, [conversationKey]: "" }));

    try {
      let submitResponse: Awaited<ReturnType<typeof debugApiRequest>> | null = null;
      let submitError: unknown = null;
      const payload = { body, mentioned_username: recipientUsername, movie_id: movieId };

      const endpoints = buildMovieDirectedSubmitEndpoints(movieId);
      for (let index = 0; index < endpoints.length; index += 1) {
        try {
          submitResponse = await debugApiRequest(endpoints[index], {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          break;
        } catch (error) {
          submitError = error;
          if (error instanceof ApiError && [404, 405].includes(error.status) && index < endpoints.length - 1) continue;
          throw error;
        }
      }
      if (!submitResponse) throw submitError ?? new Error("No endpoint available for directed submit.");

      const parsedSubmittedComment = parseComments([submitResponse.body], "directed")[0];
      setDirectReplyDrafts((current) => ({ ...current, [conversationKey]: "" }));
      if (parsedSubmittedComment) {
        const nextMessage: SocialComment = { ...parsedSubmittedComment, direction: "sent" };
        setDirectedConversations((current) =>
          current.map((item) =>
            item.key === conversationKey
              ? {
                  ...item,
                  messages: mergeUniqueMessages(item.messages, [nextMessage]),
                  lastMessageAt: nextMessage.createdAt,
                }
              : item,
          ),
        );
      }

      try {
        const refreshed = await fetchWithFallbacks<unknown>(buildMovieDirectedFetchEndpoints(movieId), "[movie-detail-debug]");
        const snapshots = groupDirectedConversations(refreshed.payload, authenticatedUsername, movieId);
        setDirectedConversations((current) => mergeDirectedConversationSnapshots(current, snapshots));
        setLoadingFullHistoryByConversationKey({});
        setFullLoadedByConversationKey({});
        setDirectedError("");
      } catch (refreshError) {
        if (refreshError instanceof ApiError && refreshError.status === 401) {
          router.replace("/login");
          return;
        }
        if (parsedSubmittedComment) {
          const nextMessage: SocialComment = { ...parsedSubmittedComment, direction: "sent" };
          setDirectedConversations((current) =>
            current.map((item) =>
              item.key === conversationKey
                ? {
                    ...item,
                    messages: mergeUniqueMessages(item.messages, [nextMessage]),
                    lastMessageAt: nextMessage.createdAt,
                  }
                : item,
            ),
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setDirectReplyErrors((current) => ({
        ...current,
        [conversationKey]: translate(locale, "movieDetailCommentPostError"),
      }));
    } finally {
      directReplySubmittingRef.current.delete(conversationKey);
      setDirectReplySubmitting((current) => ({ ...current, [conversationKey]: false }));
    }
  };

  const handleReact = async (commentId: number | string, reaction: ReactionType) => {
    setReactionError("");

    const previousPublic = publicComments;
    const previousConversations = directedConversations;

    setPublicComments((current) => applyReactionToCollection(current, commentId, reaction));
    setDirectedConversations((current) =>
      current.map((conversation) => ({
        ...conversation,
        messages: applyReactionToCollection(conversation.messages, commentId, reaction),
      })),
    );

    try {
      const endpoint = buildReactionEndpoint(commentId);
      const method = reaction === null ? "DELETE" : "PUT";
      const response = await apiFetch(
        endpoint,
        reaction === null
          ? {
              method,
            }
          : {
              method,
              body: JSON.stringify({ reaction }),
            },
      );

      setPublicComments((current) => applyReactionResultToCollection(current, commentId, response));
      setDirectedConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          messages: applyReactionResultToCollection(conversation.messages, commentId, response),
        })),
      );
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Reaction request failed", {
          commentId,
          endpoint: buildReactionEndpoint(commentId),
          method: reaction === null ? "DELETE" : "PUT",
          payload: reaction === null ? null : { reaction },
          status: error.status,
          responseBody: error.message,
        });
      } else {
        console.error("Reaction request failed", {
          commentId,
          endpoint: buildReactionEndpoint(commentId),
          method: reaction === null ? "DELETE" : "PUT",
          payload: reaction === null ? null : { reaction },
          error,
        });
      }
      setPublicComments(previousPublic);
      setDirectedConversations(previousConversations);
      setReactionError(translate(locale, "movieDetailReactionError"));
    }
  };

  const isMyComment = useCallback(
    (comment: SocialComment) => normalizeUsername(comment.authorUsername) === normalizeUsername(authenticatedUsername),
    [authenticatedUsername],
  );

  const handleStartEdit = useCallback((comment: SocialComment) => {
    const commentId = String(comment.id);
    setEditingCommentId(commentId);
    setEditingCommentValue(comment.text);
    setCommentActionErrorById((current) => {
      const next = { ...current };
      delete next[commentId];
      return next;
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditingCommentValue("");
  }, []);

  const handleSaveEdit = useCallback(
    async (comment: SocialComment) => {
      const commentId = String(comment.id);
      const trimmedValue = editingCommentValue.trim();
      if (!trimmedValue || !isMyComment(comment)) return;

      setSavingEditCommentId(commentId);
      setCommentActionErrorById((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });

      const endpoint = buildCommentDetailEndpoint(comment.id);
      try {
        try {
          await apiFetch(endpoint, {
            method: "PATCH",
            body: JSON.stringify({ body: trimmedValue }),
          });
        } catch (error) {
          if (error instanceof ApiError && [404, 405].includes(error.status)) {
            await apiFetch(endpoint, {
              method: "PUT",
              body: JSON.stringify({ body: trimmedValue }),
            });
          } else {
            throw error;
          }
        }

        setPublicComments((current) => updateCommentTextInCollection(current, comment.id, trimmedValue));
        setDirectedConversations((current) =>
          current.map((conversation) => ({
            ...conversation,
            messages: updateCommentTextInCollection(conversation.messages, comment.id, trimmedValue),
          })),
        );
        setEditingCommentId(null);
        setEditingCommentValue("");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setCommentActionErrorById((current) => ({
          ...current,
          [commentId]: "No se pudo guardar la edición. Revisa el texto e intenta nuevamente.",
        }));
      } finally {
        setSavingEditCommentId(null);
      }
    },
    [editingCommentValue, isMyComment, router],
  );

  const handleDeleteComment = useCallback(
    async (comment: SocialComment) => {
      const commentId = String(comment.id);
      if (!isMyComment(comment)) return;
      setDeletingCommentIds((current) => ({ ...current, [commentId]: true }));
      setCommentActionErrorById((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });

      try {
        await apiFetch(buildCommentDetailEndpoint(comment.id), { method: "DELETE" });
        setPublicComments((current) => removeCommentFromCollection(current, comment.id));
        setDirectedConversations((current) =>
          current
            .map((conversation) => ({
              ...conversation,
              messages: removeCommentFromCollection(conversation.messages, comment.id),
            }))
            .filter((conversation) => conversation.messages.length > 0),
        );
        if (editingCommentId === commentId) {
          setEditingCommentId(null);
          setEditingCommentValue("");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setCommentActionErrorById((current) => ({
          ...current,
          [commentId]: "No se pudo eliminar el comentario. Intenta nuevamente.",
        }));
      } finally {
        setDeletingCommentIds((current) => {
          const next = { ...current };
          delete next[commentId];
          return next;
        });
      }
    },
    [editingCommentId, isMyComment, router],
  );

  const friendFilterUsers = useMemo<CommentFilterUser[]>(
    () =>
      friends.map((friend) => ({
        id: String(friend.id),
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
      })),
    [friends],
  );

  const followingFilterUsers = useMemo<CommentFilterUser[]>(
    () =>
      followingUsers.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: buildCommentFilterDisplayName(user.firstName, user.lastName, user.displayName),
        avatarUrl: user.avatarUrl,
      })),
    [followingUsers],
  );

  const publicFilterUsers = useMemo(
    () => mergeCommentFilterUsers(friendFilterUsers, followingFilterUsers),
    [friendFilterUsers, followingFilterUsers],
  );

  const filteredPublicComments = useMemo(
    () =>
      selectedPublicFilterUser
        ? publicComments.filter((comment) => doesPublicCommentBelongToUser(comment, selectedPublicFilterUser))
        : publicComments,
    [publicComments, selectedPublicFilterUser],
  );

  const filteredDirectedConversations = useMemo(
    () =>
      selectedDirectedFilterUser
        ? directedConversations.filter((conversation) => doesConversationBelongToUser(conversation, selectedDirectedFilterUser))
        : directedConversations,
    [directedConversations, selectedDirectedFilterUser],
  );


  const composerFriends = canShowDirectedComments ? friends : [];
  const isSeriesDetail = isSeriesContentType(movie?.contentType);
  const detailTitle = isSeriesDetail ? t("movieDetailSeriesTitle") : t("movieDetailTitle");
  const composerPlaceholder = isSeriesDetail ? t("movieDetailSeriesCommentPlaceholder") : t("movieDetailCommentPlaceholder");
  const composerTitle = isSeriesDetail ? t("movieDetailSeriesCommentTitle") : t("movieDetailCommentTitle");

  const changeTrailerCompanionView = useCallback((next: TrailerCompanionView) => {
    setTrailerCompanionView(next);
    document.body.dataset.trailerCompanionView = next;
    if (next !== "reaction") {
      document.querySelectorAll<HTMLVideoElement>('[data-video-comment-player="true"]').forEach((video) => {
        video.pause();
        video.muted = true;
      });
    } else {
      window.dispatchEvent(new Event("qnext:companion-reaction-enter"));
    }
  }, []);

  useEffect(() => {
    const initializeCompanion = () => {
      setTrailerCompanionOpen(true);
      changeTrailerCompanionView(commentInputMode === "video-comment" ? "reaction" : "public-comments");
    };
    const closeCompanion = () => {
      setTrailerCompanionOpen(false);
      if (companionTransitionTimerRef.current !== null) window.clearTimeout(companionTransitionTimerRef.current);
      companionTransitionTimerRef.current = null;
      document.body.classList.remove("trailer-companion-dragging", "trailer-companion-settling");
      document.body.style.removeProperty("--trailer-companion-drag-x");
    };
    window.addEventListener("qnext:detail-trailer-open", initializeCompanion);
    window.addEventListener("qnext:detail-trailer-close", closeCompanion);
    return () => {
      window.removeEventListener("qnext:detail-trailer-open", initializeCompanion);
      window.removeEventListener("qnext:detail-trailer-close", closeCompanion);
    };
  }, [changeTrailerCompanionView, commentInputMode]);

  const handleCompanionTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    companionTouchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    companionTouchAxisRef.current = null;
    document.body.classList.remove("trailer-companion-settling");
  };
  const handleCompanionTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const start = companionTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || window.matchMedia("(min-width: 1280px)").matches) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (companionTouchAxisRef.current === null && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
      companionTouchAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) * TRAILER_COMPANION_HORIZONTAL_DOMINANCE ? "horizontal" : "vertical";
    }
    if (companionTouchAxisRef.current !== "horizontal") return;
    const views: TrailerCompanionView[] = ["reaction", "public-comments", "directed-comments"];
    const currentIndex = views.indexOf(trailerCompanionView);
    const atBoundary = (currentIndex === 0 && deltaX > 0) || (currentIndex === views.length - 1 && deltaX < 0);
    const offset = atBoundary ? deltaX * 0.18 : deltaX;
    document.body.classList.add("trailer-companion-dragging");
    document.body.style.setProperty("--trailer-companion-drag-x", `${offset}px`);
  };
  const handleCompanionTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = companionTouchStartRef.current;
    const touch = event.changedTouches[0];
    companionTouchStartRef.current = null;
    const horizontal = companionTouchAxisRef.current === "horizontal";
    companionTouchAxisRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    if (!horizontal) {
      document.body.classList.remove("trailer-companion-dragging", "trailer-companion-settling");
      document.body.style.removeProperty("--trailer-companion-drag-x");
      return;
    }
    const views: TrailerCompanionView[] = ["reaction", "public-comments", "directed-comments"];
    const currentIndex = views.indexOf(trailerCompanionView);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const shouldNavigate = horizontal && Math.abs(deltaX) >= TRAILER_COMPANION_SWIPE_THRESHOLD_PX && nextIndex >= 0 && nextIndex < views.length;
    document.body.classList.remove("trailer-companion-dragging");
    document.body.classList.add("trailer-companion-settling");
    const panelWidth = Math.max(1, window.innerWidth - 24);
    document.body.style.setProperty("--trailer-companion-drag-x", shouldNavigate ? `${deltaX < 0 ? -panelWidth : panelWidth}px` : "0px");
    if (companionTransitionTimerRef.current !== null) window.clearTimeout(companionTransitionTimerRef.current);
    companionTransitionTimerRef.current = window.setTimeout(() => {
      if (shouldNavigate) changeTrailerCompanionView(views[nextIndex]);
      document.body.classList.remove("trailer-companion-settling");
      document.body.style.removeProperty("--trailer-companion-drag-x");
      companionTransitionTimerRef.current = null;
    }, TRAILER_COMPANION_SWIPE_TRANSITION_MS);
  };

  return (
    <main className="min-h-screen bg-black" onTouchStart={(event) => { if (document.body.classList.contains("detail-trailer-active")) handleCompanionTouchStart(event); }} onTouchMove={(event) => { if (document.body.classList.contains("detail-trailer-active")) handleCompanionTouchMove(event); }} onTouchEnd={(event) => { if (document.body.classList.contains("detail-trailer-active")) handleCompanionTouchEnd(event); }}>
      {debugNotificationTarget ? (
        <aside data-notification-target-debug className="fixed bottom-2 right-2 z-[2000] max-h-[42dvh] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-lg border border-[#86ADE0]/60 bg-black/90 p-2 font-mono text-[10px] leading-4 text-[#c7dcf6] shadow-2xl pointer-events-none" aria-live="polite">
          <strong className="block text-xs text-white">Notification target debug</strong>
          <strong className="mt-1 block text-white">RECEIVED</strong>
          <div>target: {receivedNotificationTarget?.type ?? "none"}</div>
          <div>targetId: {receivedNotificationTarget?.id ?? "—"}</div>
          <div>reaction: {receivedNotificationTarget?.reaction ?? "—"}</div>
          <strong className="mt-1 block text-white">CURRENT</strong>
          <div>target: {notificationTarget?.type ?? "none"}</div>
          <div>status: {notificationDiagnosticStatus}</div>
          <div>viewport: {notificationDiagnosticViewport}</div>
          <div>mainTab: {commentInputMode}</div>
          <div>activeCommentsTab: {activeCommentsTab}</div>
          {notificationDiagnosticEntries.map((entry, index) => <div key={`${index}-${entry}`} className="mt-1 border-t border-white/10 pt-1 break-words">{entry}</div>)}
        </aside>
      ) : null}
      <div
        data-trailer-companion-controls
        className="hidden"
      >
        <div className="trailer-companion-navigation">
          {trailerCompanionView !== "reaction" ? <button type="button" aria-label="Vista anterior" onClick={() => changeTrailerCompanionView(trailerCompanionView === "directed-comments" ? "public-comments" : "reaction")}>←</button> : <span />}
          <span className="trailer-companion-mobile-title text-sm font-semibold text-[#c7dcf6]">{trailerCompanionView === "reaction" ? t("movieDetailVideoCommentTitle") : trailerCompanionView === "public-comments" ? t("movieDetailPublicComments") : t("movieDetailDirectedComments")}</span>
          {trailerCompanionView === "public-comments" ? <h2 className="trailer-companion-desktop-title trailer-companion-desktop-title--public hidden font-bold text-[#86ADE0]">{t("movieDetailPublicComments")}</h2> : null}
          {trailerCompanionView !== "directed-comments" ? <button type="button" aria-label="Vista siguiente" onClick={() => changeTrailerCompanionView(trailerCompanionView === "reaction" ? "public-comments" : "directed-comments")}>→</button> : <span />}
        </div>
        {trailerCompanionView === "reaction" ? <h2 className="trailer-companion-desktop-title trailer-companion-desktop-title--reaction hidden text-xl font-bold text-[#86ADE0]">{t("movieDetailVideoCommentTitle")}</h2> : null}
        {trailerCompanionView === "directed-comments" ? <h2 className="trailer-companion-desktop-title trailer-companion-desktop-title--directed hidden text-xl font-bold text-[#86ADE0]">{t("movieDetailDirectedComments")}</h2> : null}
      </div>
      <div className="mx-auto w-full max-w-[1000px] space-y-6 px-4 py-3 xl:px-8 xl:py-8">
        <div ref={stickyHeaderRef} data-mobile-detail-sticky="true" className="sticky top-0 z-40 -mx-4 space-y-6 bg-black px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] xl:static xl:z-auto xl:mx-0 xl:bg-transparent xl:p-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-zinc-100">{detailTitle}</h1>
            <Link
              href="/feed"
              className="inline-flex items-center overflow-hidden rounded-lg bg-transparent px-1 py-1 transition"
              aria-label="Volver al feed"
            >
              <AppLogo
                branding={branding}
                slot="movie_detail_logo_url"
                alt="Volver al feed"
                className="block h-11 w-auto max-w-[220px] object-contain object-center"
                textClassName="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200"
              />
            </Link>
          </div>

          {movieLoading ? <div className="rounded-xl border border-white/15 bg-zinc-950/45 p-4 text-zinc-300">{t("movieDetailLoadingMovie")}</div> : null}
          {!movieLoading && movieError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{movieError}</div>
          ) : null}
          {!movieLoading && !movieError && movie ? (
            <div data-tour="detail-info"><MovieCard
              movie={movie}
              variant="feed"
              linkToDetail={false}
              showExtendedMetadata
              highlightMyRatingSlot
              enlargeInteractionIcons
              extendedMetadataMiddleSlot={<StreamingProviders movieId={movie.id} />}
              ratingsActionsTmdbSlot={<MovieDetailStreamingCountrySelector />}
              separateRatingsActionsCard
              onRated={handleMovieRated}
              creditsLoading={creditsLoading}
              preloadPersonDetails
              enableMobileDetailCarousel
              branding={branding}
            /></div>
          ) : null}

          <div data-mobile-comment-tabs className="relative flex items-center justify-between gap-4 xl:hidden" role="tablist" aria-label={composerTitle}>
            <AuthenticatedProfileAvatar mobileTourTarget="detail-profile-avatar-mobile" user={authenticatedUser} label={t("movieDetailMyProfileAvatarLabel")} className="absolute left-0 top-1/2 z-10 h-9 w-9 -translate-y-1/2 cursor-pointer" />
            {(["video-comment", "text-comment"] as const).map((mode) => {
              const isActiveMode = commentInputMode === mode;

              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={isActiveMode}
                  data-tour-mobile={mode === "text-comment" ? "detail-comment-tab-mobile" : undefined}
                  className={`flex min-h-11 flex-1 items-center justify-center py-2 text-center leading-tight transition-[color,font-size,font-weight] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${mode === "video-comment" ? "pl-6 pr-2" : "px-2"} ${isActiveMode ? "text-base font-bold text-[#86ADE0]" : "text-sm font-medium text-zinc-400"}`}
                  data-comment-input-mode={mode}
                  onClick={() => handleCommentInputTabClick(mode)}
                >
                  {mode === "text-comment" ? composerTitle : <span data-tour-mobile="detail-video-tab-mobile">{t("movieDetailVideoCommentTitle")}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div data-desktop-comment-tabs className="relative hidden items-center justify-center gap-16 xl:flex" role="tablist" aria-label={composerTitle}>
          <AuthenticatedProfileAvatar tourTarget="detail-profile" user={authenticatedUser} label={t("movieDetailMyProfileAvatarLabel")} className="absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 cursor-pointer" />
          {(["video-comment", "text-comment"] as const).map((mode) => {
            const isActiveMode = commentInputMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={isActiveMode}
                data-tour-desktop={mode === "video-comment" ? "detail-video-reactions" : "detail-comment-composer"}
                className={`min-h-11 px-3 py-2 text-center leading-tight transition-[color,font-size,font-weight] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${isActiveMode ? "text-xl font-bold text-[#86ADE0]" : "text-base font-medium text-zinc-400 hover:text-zinc-300"}`}
                data-comment-input-mode={mode}
                onClick={() => handleCommentInputTabClick(mode)}
              >
                {mode === "text-comment" ? composerTitle : t("movieDetailVideoCommentTitle")}
              </button>
            );
          })}
        </div>

        <div ref={textCommentStartRef} data-mobile-text-comment data-active={commentInputMode === "text-comment"} className={`xl:hidden ${commentInputMode === "text-comment" ? "block" : "hidden"}`}>
          <CommentComposer friends={composerFriends} searchMentionSuggestions={searchMentionSuggestions} onSubmit={handleSubmitComment} loading={isSubmitting} error={composerError} placeholder={composerPlaceholder} title={composerTitle} hideTitleOnMobile />
        </div>
        <div ref={videoCommentStartRef} data-video-reaction-section>
          <MobileVideoComments movieId={movieId} movieTitle={resolveMovieTitles(locale, movie?.titleSpanish, movie?.titleEnglish, movie?.displayTitle).primary} moviePoster={movie?.posterUrl ?? null} active={commentInputMode === "video-comment" || (trailerCompanionOpen && trailerCompanionView === "reaction")} notificationTarget={notificationTarget?.type === "video-reaction" ? { id: notificationTarget.id, reaction: notificationTarget.reaction } : null} onNotificationTargetConsumed={consumeNotificationTarget} logNotificationTarget={logNotificationTarget} t={t} onAuthorClick={handleAuthorNavigation} />
        </div>
        <div data-desktop-comment-composer className={`${commentInputMode === "text-comment" ? "hidden xl:block" : "hidden"}`}>
          <CommentComposer friends={composerFriends} searchMentionSuggestions={searchMentionSuggestions} onSubmit={handleSubmitComment} loading={isSubmitting} error={composerError} placeholder={composerPlaceholder} title={composerTitle} />
        </div>

        {commentInputMode === "text-comment" && reactionError ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{reactionError}</div> : null}

        <div
          data-comment-history
          data-tour-mobile={commentInputMode === "text-comment" ? `detail-${activeCommentsTab}-comments-section-mobile` : undefined}
          className={`${commentInputMode === "text-comment" ? "grid" : "hidden"} relative grid-cols-1 gap-6 ${shouldRenderDirectedComments ? "xl:grid-cols-2 xl:gap-10" : ""}`}
        >
          {shouldRenderDirectedComments ? (
            <>
              <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 top-12 hidden w-px -translate-x-1/2 bg-[#2d3a4f] xl:block" />
              <div className="flex rounded-xl border border-white/10 bg-zinc-950/60 p-1 xl:hidden" role="tablist" aria-label="Comments sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCommentsTab === "public"}
                  data-tour-mobile="detail-public-comments-mobile"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeCommentsTab === "public" ? "border border-[#86ADE0]/45 bg-zinc-950/50 text-[#c7dcf6] shadow-[0_0_16px_rgba(134,173,224,0.16)]" : "border border-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => setActiveCommentsTab("public")}
                >
                  {t("movieDetailPublicComments")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCommentsTab === "directed"}
                  data-tour-mobile="detail-directed-comments-mobile"
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    activeCommentsTab === "directed" ? "border border-[#86ADE0]/45 bg-zinc-950/50 text-[#c7dcf6] shadow-[0_0_16px_rgba(134,173,224,0.16)]" : "border border-transparent text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => setActiveCommentsTab("directed")}
                >
                  {t("movieDetailDirectedComments")}
                </button>
              </div>
            </>
          ) : null}
          <section data-tour-desktop="detail-public-comments" ref={publicCommentsSectionRef} data-trailer-public-comments className={`space-y-3 ${shouldRenderDirectedComments && activeCommentsTab !== "public" ? "hidden xl:block" : ""}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!trailerCompanionOpen ? <h2 className={`text-xl font-bold text-[#86ADE0] ${shouldRenderDirectedComments ? "hidden xl:block" : ""}`}>{t("movieDetailPublicComments")}</h2> : null}
              <CommentUserSearch
                users={publicFilterUsers}
                query={publicSearchQuery}
                selectedUser={selectedPublicFilterUser}
                isOpen={isPublicSearchOpen}
                placeholder={t("movieDetailSearchUser")}
                allLabel={t("movieDetailAll")}
                hasContentLabel={t("movieDetailHasComments")}
                noContentLabel={t("movieDetailNoComments")}
                getHasContent={(user) => publicComments.some((comment) => doesPublicCommentBelongToUser(comment, user))}
                onQueryChange={setPublicSearchQuery}
                onOpenChange={setIsPublicSearchOpen}
                onSelect={setSelectedPublicFilterUser}
              />
            </div>
            <div data-trailer-public-comments-list data-empty={publicComments.length === 0} className="contents">
            <CommentsList
              comments={filteredPublicComments}
              loading={loadingPublic}
              error={publicError}
              emptyMessage={publicComments.length === 0 ? t("movieDetailTrailerCompanionEmpty") : t("movieDetailNoPublicComments")}
              onReact={handleReact}
              onAuthorClick={handleAuthorNavigation}
              singleContainer
              onLoadMore={() => void appendPublicComments()}
              hasMore={Boolean(publicNext)}
              loadingMore={loadingPublicMore}
              canManageComment={isMyComment}
              editingCommentId={editingCommentId}
              editingValue={editingCommentValue}
              onStartEdit={handleStartEdit}
              onEditValueChange={setEditingCommentValue}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              savingEditCommentId={savingEditCommentId}
              onDeleteComment={handleDeleteComment}
              deletingCommentIds={deletingCommentIds}
              actionErrorByCommentId={commentActionErrorById}
              borderlessContainer
              unboundedOnMobile
              desktopDarkScrollbar
              exposePublicCommentIds
              containerRef={publicCommentsScrollRef}
            />
            </div>
          </section>

          {shouldRenderDirectedComments ? (
            <section data-tour-desktop="detail-directed-comments" data-trailer-directed-comments ref={directedCommentsSectionRef} className={`space-y-3 ${activeCommentsTab !== "directed" ? "hidden xl:block" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden text-xl font-bold text-[#86ADE0] xl:block">{t("movieDetailDirectedComments")}</h2>
                <CommentUserSearch
                  users={friendFilterUsers}
                  query={directedSearchQuery}
                  selectedUser={selectedDirectedFilterUser}
                  isOpen={isDirectedSearchOpen}
                  placeholder={t("movieDetailSearchUser")}
                  allLabel={t("movieDetailAll")}
                  hasContentLabel={t("movieDetailHasConversation")}
                  noContentLabel={t("movieDetailNoComments")}
                  getHasContent={(user) => directedConversations.some((conversation) => doesConversationBelongToUser(conversation, user))}
                  onQueryChange={setDirectedSearchQuery}
                  onOpenChange={setIsDirectedSearchOpen}
                  onSelect={setSelectedDirectedFilterUser}
                />
              </div>
              {loadingDirected ? <div className="p-4 text-sm text-zinc-300">{t("movieDetailLoadingComments")}</div> : null}
              {!loadingDirected && directedError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{directedError}</div>
              ) : null}
              {!loadingDirected && !directedError && filteredDirectedConversations.length === 0 ? (
                <p data-trailer-directed-empty={directedConversations.length === 0} className="p-4 text-sm text-zinc-400">
                  {directedConversations.length === 0 ? t("movieDetailTrailerCompanionEmpty") : selectedDirectedFilterUser ? t("movieDetailNoDirectedCommentsWithUser") : t("movieDetailNoDirectedComments")}
                </p>
              ) : null}
              {!loadingDirected && !directedError ? (
                <div ref={directedCommentsScrollRef} className="desktop-dark-scrollbar px-1 py-2 xl:max-h-[28rem] xl:overflow-y-auto">
                  <div className="space-y-0">
                    {filteredDirectedConversations.map((conversation) => {
                      const isExpanded = expandedConversationKey === conversation.key;
                      return (
                        <article
                          key={conversation.key}
                          className={`px-3 py-4 transition-colors ${
                            isExpanded
                              ? "my-2 rounded-xl border border-[#86ADE0]/30 border-l-4 border-l-[#86ADE0] bg-[#0b1f3a]/35 shadow-[0_0_24px_rgba(134,173,224,0.12)]"
                              : "border-b border-white/10 bg-transparent hover:bg-white/[0.03]"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 text-left"
                            onClick={() => {
                              void handleToggleConversation(conversation);
                            }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-zinc-900 text-xs font-semibold text-zinc-200">
                                {conversation.otherAvatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={conversation.otherAvatar} alt={conversation.otherDisplayName} className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  (conversation.otherDisplayName || conversation.otherUsername || "Usuario").charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-zinc-100">{conversation.otherDisplayName || conversation.otherUsername || "Usuario"}</p>
                                <div className="flex items-center gap-2">
                                  {conversation.otherUsername ? <p className="text-xs text-zinc-400">@{conversation.otherUsername}</p> : null}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-zinc-400">{isExpanded ? t("movieDetailHide") : t("movieDetailShow")}</span>
                          </button>

                          {isExpanded ? (
                            <div
                              className="mt-3 border-t border-white/10 pt-3 xl:scrollbar-metallic-blue xl:max-h-[24rem] xl:overflow-y-auto"
                              onScroll={(event) => {
                                const target = event.currentTarget;
                                if (
                                  conversation.next &&
                                  !loadingDirectedMoreByKey[conversation.key] &&
                                  target.scrollTop + target.clientHeight >= target.scrollHeight - 48
                                ) {
                                  void loadMoreConversationMessages(conversation.key);
                                }
                              }}
                            >
                              <input
                                type="text"
                                value={directReplyDrafts[conversation.key] ?? ""}
                                onChange={(event) =>
                                  setDirectReplyDrafts((current) => ({ ...current, [conversation.key]: event.target.value }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                                  event.preventDefault();
                                  void handleSubmitDirectReply(conversation);
                                }}
                                enterKeyHint="send"
                                placeholder={t("movieDetailDirectReplyPlaceholder")}
                                disabled={!conversation.otherUsername || directReplySubmitting[conversation.key]}
                                aria-busy={directReplySubmitting[conversation.key] || undefined}
                                className="mb-3 h-10 w-full rounded-lg border border-[#86ADE0]/35 bg-black/45 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#86ADE0] focus:ring-1 focus:ring-[#86ADE0]/40 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              {directReplyErrors[conversation.key] ? (
                                <p className="mb-3 text-xs text-red-300" role="alert">{directReplyErrors[conversation.key]}</p>
                              ) : null}
                              <CommentsList
                                comments={conversation.messages}
                                emptyMessage={t("movieDetailNoConversationMessages")}
                                onReact={handleReact}
                                onAuthorClick={handleAuthorNavigation}
                                singleContainer={false}
                                itemBadgeLabel={(message) =>
                                  message.authorUsername === authenticatedUsername ? t("movieDetailSent") : t("movieDetailReceived")
                                }
                                canManageComment={isMyComment}
                                editingCommentId={editingCommentId}
                                editingValue={editingCommentValue}
                                onStartEdit={handleStartEdit}
                                onEditValueChange={setEditingCommentValue}
                                onCancelEdit={handleCancelEdit}
                                onSaveEdit={handleSaveEdit}
                                savingEditCommentId={savingEditCommentId}
                                onDeleteComment={handleDeleteComment}
                                deletingCommentIds={deletingCommentIds}
                                actionErrorByCommentId={commentActionErrorById}
                                getDisplayText={(message) =>
                                  message.type === "directed" ? stripLeadingMention(message.text) : message.text
                                }
                                exposeDirectedCommentIds
                                unboundedOnMobile
                              />
                              {loadingDirectedMoreByKey[conversation.key] ? (
                                <p className="pt-2 text-xs text-zinc-400">{t("movieDetailLoadingPreviousMessages")}</p>
                              ) : null}
                              {loadingFullHistoryByConversationKey[conversation.key] ? (
                                <p className="pt-2 text-xs text-zinc-400">{t("movieDetailLoadingFullHistory")}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function MovieDetailPage() {
  return (
    <Suspense fallback={null}>
      <MovieDetailPageContent />
    </Suspense>
  );
}
