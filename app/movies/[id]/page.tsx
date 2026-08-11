"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppLogo from "../../../components/AppLogo";
import CommentComposer from "../../../components/social/CommentComposer";
import CommentsList from "../../../components/social/CommentsList";
import MovieCard from "../../../components/MovieCard";
import StreamingProviders from "../../../components/StreamingProviders";
import MovieDetailStreamingCountrySelector from "../../../components/MovieDetailStreamingCountrySelector";
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
import { getTopFollowing } from "../../../lib/profile-feed/adapters";
import { SocialUser } from "../../../lib/profile-feed/types";
import { t as translate } from "../../../lib/i18n";

type CommentInputMode = "text-comment" | "video-comment";

const VIDEO_COMMENT_MAX_SECONDS = 20;
const VIDEO_COMMENT_MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_COMMENT_PERMISSION_SESSION_KEY = "qnext_video_comment_permission_info_accepted";
const VIDEO_COMMENT_SOUND_SESSION_KEY = "qnext-video-sound";
const VIDEO_COMMENT_VISIBILITY_THRESHOLD = 0.15;
const VIDEO_COMMENT_DOMINANCE_MARGIN = 0.08;
const VIDEO_REACTION_WIDTH = 720;
const VIDEO_REACTION_HEIGHT = 1280;
const VIDEO_REACTION_SOURCE_WIDTH = 960;
const VIDEO_REACTION_SOURCE_HEIGHT = 1280;
type VideoSoundPreference = "muted" | "sound-on";
const VIDEO_COMMENT_ALLOWED_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];
const VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT = "min(calc(100dvh - 230px), calc((100vw - 40px) * 16 / 9))";
const VIDEO_COMMENT_CARD_VIDEO_HEIGHT = "clamp(14rem, 36dvh, 18rem)";
const VIDEO_COMMENT_MIME_CANDIDATES = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
const IOS_VIDEO_COMMENT_MIME_CANDIDATES = ["video/mp4", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/webm"];
const VIDEO_COMMENT_DIAGNOSTIC_MIMES = ["video/mp4", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"];
type VideoRecorderState = "idle" | "menu" | "permissionInfo" | "requestingPermission" | "preparingRecorder" | "recording" | "validatingSelected" | "previewRecorded" | "previewSelected" | "uploading" | "error";
interface VideoCommentUser { id: string | number; username: string; avatar: string | null; }
interface VideoComment { id: string | number; user: VideoCommentUser; video_url: string; duration_seconds: number | null; mime_type: string | null; file_size: number | null; created_at: string; updated_at: string; can_delete: boolean; }
interface VideoCommentsPage { count: number; next: string | null; previous: string | null; results: VideoComment[]; }
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

function getCurrentUsernameFromPayload(payload: unknown): string | null {
  const root = toRecord(payload);
  const user = toRecord(root?.user);
  return typeof (user?.username ?? root?.username) === "string" ? String(user?.username ?? root?.username) : null;
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
          className="scrollbar-dark mt-2 mb-3 max-h-64 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-[#86ADE0]/20 bg-[#0b1f3a]/35 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.28),0_0_18px_rgba(134,173,224,0.08)] backdrop-blur lg:absolute lg:right-0 lg:z-40 lg:mb-0 lg:border-white/10 lg:bg-zinc-950/95 lg:shadow-2xl lg:shadow-black/50"
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

function MobileVideoComments({ movieId, active, t, onAuthorClick }: { movieId: string; active: boolean; t: (key: Parameters<typeof translate>[1]) => string; onAuthorClick: (username: string) => void }) {
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
  const [, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasFrameRef = useRef<number | null>(null);
  const compositionLoggedRef = useRef(false);
  const recorderOutputStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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
  const expandedVideosRef = useRef(new Map<string, HTMLVideoElement>());
  const expandedBodyOverflowRef = useRef<string | null>(null);
  const expandedOpenRef = useRef(false);

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

  const chooseVisibleHistoryVideo = useCallback(() => {
    if (expandedOpenRef.current || document.hidden) return;
    const stickyBottom = document.querySelector<HTMLElement>('[data-mobile-detail-sticky="true"]')?.getBoundingClientRect().bottom ?? 0;
    historyVideosRef.current.forEach((video, id) => {
      visibilityRef.current.set(id, calculatePlayableIntersectionRatio(video.getBoundingClientRect(), window.innerHeight, stickyBottom));
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
  }, [playHistoryVideo, syncPlayerState]);

  useEffect(() => {
    if (!active || typeof IntersectionObserver === "undefined") return;
    const historyVideos = historyVideosRef.current;
    const visibility = visibilityRef.current;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        const id = video.dataset.videoCommentId;
        if (!id || entry.isIntersecting) return;
        visibilityRef.current.set(id, 0);
      });
      chooseVisibleHistoryVideo();
    }, { root: null, threshold: [0, 0.15, 0.25, 0.5, 0.75, 1] });
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
    window.addEventListener("resize", reevaluatePlayableViewport);
    return () => {
      window.removeEventListener("scroll", reevaluatePlayableViewport);
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
  }, [comments, recorderState, syncPlayerState]);

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
    if (recorderState !== "menu") return;
    const onDown = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setRecorderState("idle"); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [recorderState]);

  useEffect(() => {
    if (!active || recorderState !== "idle" || !next || initialLoading || loadingMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && next && !loadingMore) fetchPage(next, "more");
    }, { root: null, rootMargin: "260px" });
    obs.observe(node);
    return () => obs.disconnect();
  }, [active, fetchPage, initialLoading, loadingMore, next, recorderState]);

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
      if (isLandscapeViewport()) {
        if (!orientationPausedRef.current) {
          orientationPausedRef.current = true;
          setOrientationPaused(true);
        }
        if (recorderRef.current?.state === "recording") recorderRef.current.pause();
        return;
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
        context.drawImage(preview, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh);
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
    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const syncOrientation = () => {
      const landscape = mediaQuery.matches || isLandscapeViewport();
      const recorder = recorderRef.current;
      if (landscape && !orientationPausedRef.current) {
        orientationPausedRef.current = true;
        setOrientationPaused(true);
        if (recorder?.state === "recording") recorder.pause();
      } else if (!landscape && orientationPausedRef.current) {
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

  const continueToNativePermissions = useCallback(async () => {
    setError("");
    setRecorderState("requestingPermission");
    if (!window.isSecureContext) { setError(t("movieDetailVideoInsecureContext")); setRecorderState("error"); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t("movieDetailVideoUnsupportedBrowser")); setRecorderState("error"); return; }
    try {
      cleanupRecorder({ clearPreview: true, nextState: "idle" });
      const stream = await navigator.mediaDevices.getUserMedia({
        // Ask for a native portrait sensor frame first. Requesting 9:16 here can make
        // the user agent crop the camera before QNext can measure or preserve its FOV.
        video: { facingMode: "user", width: { ideal: VIDEO_REACTION_SOURCE_WIDTH }, height: { ideal: VIDEO_REACTION_SOURCE_HEIGHT } },
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
      let cameraSettings = reportCameraConfiguration("getUserMedia");
      const zoomMinimum = capabilities?.zoom?.min;
      if (cameraSettings.facingMode && cameraSettings.facingMode !== "user") throw new Error("unexpected-non-user-camera");
      if (capabilities?.resizeMode?.includes("none")) {
        try {
          await cameraTrack.applyConstraints({
            width: { ideal: VIDEO_REACTION_SOURCE_WIDTH },
            height: { ideal: VIDEO_REACTION_SOURCE_HEIGHT },
            aspectRatio: { ideal: 3 / 4 },
            resizeMode: "none",
            advanced: zoomMinimum === undefined ? undefined : [{ zoom: zoomMinimum } as MediaTrackConstraintSet],
          } as MediaTrackConstraints);
          cameraSettings = reportCameraConfiguration("native-fov-source");
        } catch (nativeSourceError) {
          appendVideoDebugLog("CAMERA_CONSTRAINT_REJECTED", { phase: "native-fov-source", message: nativeSourceError instanceof Error ? nativeSourceError.message : String(nativeSourceError) });
        }
      }
      const isPortraitSource = (settings: MediaTrackSettings) => Boolean(settings.width && settings.height && settings.height > settings.width);
      if (!isPortraitSource(cameraSettings)) {
        const portraitBackoff: MediaTrackConstraints[] = [
          { width: { ideal: 960 }, height: { ideal: 1280 }, aspectRatio: { ideal: 3 / 4 } },
          { width: { ideal: 720 }, height: { ideal: 1080 }, aspectRatio: { ideal: 2 / 3 } },
          { width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } },
        ];
        for (const constraints of portraitBackoff) {
          try {
            await cameraTrack.applyConstraints(zoomMinimum === undefined ? constraints : { ...constraints, advanced: [{ zoom: zoomMinimum } as MediaTrackConstraintSet] });
            cameraSettings = reportCameraConfiguration("portrait-backoff");
            if (isPortraitSource(cameraSettings)) break;
          } catch (constraintError) {
            appendVideoDebugLog("CAMERA_CONSTRAINT_REJECTED", { message: constraintError instanceof Error ? constraintError.message : String(constraintError) });
          }
        }
      }
      if (zoomMinimum !== undefined) {
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
          selection: "default-user-facing-camera",
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

  const toggleHistoryPlayback = useCallback((id: string) => {
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    if (video.paused) void playHistoryVideo(id, true);
    else {
      pausedByUserRef.current.add(id);
      video.pause();
    }
  }, [playHistoryVideo]);

  const toggleHistorySound = useCallback((id: string) => {
    const video = historyVideosRef.current.get(id);
    if (!video) return;
    const preference: VideoSoundPreference = video.muted ? "sound-on" : "muted";
    video.muted = preference === "muted";
    soundPreferenceRef.current = preference;
    setSoundPreference(preference);
    try { sessionStorage.setItem(VIDEO_COMMENT_SOUND_SESSION_KEY, preference === "sound-on" ? "on" : "off"); } catch { /* Storage can be unavailable in private contexts. */ }
    syncPlayerState(video);
  }, [syncPlayerState]);



  const openExpandedVideo = useCallback((id: string) => {
    expandedOpenRef.current = true;
    historyVideosRef.current.forEach((video) => { video.pause(); video.currentTime = 0; });
    activeVideoIdRef.current = null;
    setExpandedVideoId(id);
  }, []);

  const closeExpandedVideo = useCallback(() => {
    const currentId = expandedVideoId;
    expandedVideosRef.current.forEach((video) => { video.pause(); video.currentTime = 0; });
    expandedOpenRef.current = false;
    setExpandedVideoId(null);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-video-comment-card="${CSS.escape(currentId ?? "")}"]`)?.scrollIntoView({ block: "center" });
    }, 0);
  }, [expandedVideoId]);

  useEffect(() => {
    if (expandedVideoId === null) return;
    expandedBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = expandedBodyOverflowRef.current ?? "";
      expandedBodyOverflowRef.current = null;
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


  return <section data-mobile-video-reaction data-active={active} data-video-sound-preference={soundPreference} className={`${isRecordingOverlay ? "fixed inset-x-0 bottom-0 top-[var(--mobile-video-overlay-top,144px)] z-50 bg-black px-5 py-3" : "rounded-2xl bg-zinc-950/55 p-4"} md:hidden ${active ? "block" : "hidden"}`}>
    <div className="flex flex-col items-center gap-4 pb-[env(safe-area-inset-bottom)]">
      <div ref={menuRef} className="relative flex justify-center">
        {!isLocalVideoState ? <button type="button" className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-[#86ADE0]/70 bg-[#0b1f3a]/80 text-sm font-bold uppercase tracking-[0.18em] text-[#c7dcf6] shadow-[0_0_24px_rgba(134,173,224,0.18)]" aria-label={t("movieDetailVideoCommentTitle")} onClick={() => setRecorderState((state) => state === "menu" ? "idle" : "menu")}>Rec</button> : null}
        {showMenu ? <div className="absolute left-1/2 top-full z-30 mt-3 w-52 -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl">
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10" aria-label={t("movieDetailVideoRecord")} onClick={beginRecordingFlow}><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{t("movieDetailVideoRecord")}</button>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-100 hover:bg-white/10" aria-label={t("movieDetailVideoUpload")} onClick={() => fileInputRef.current?.click()}><span>▣</span>{t("movieDetailVideoUpload")}</button>
        </div> : null}
      </div>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => { const input = event.currentTarget; const selectedFile = input.files?.item(0) ?? undefined; input.value = ""; void processSelectedVideo(selectedFile); }} />
      {recorderState === "permissionInfo" ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl"><p className="text-sm font-semibold text-zinc-100">{t("movieDetailVideoPermissionInfo")}</p><div className="mt-5 flex gap-3"><button type="button" className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={() => setRecorderState("menu")}>{t("movieDetailVideoCancel")}</button><button type="button" className="flex-1 rounded-xl bg-[#86ADE0] px-4 py-2 text-sm font-bold text-black" onClick={continueToNativePermissions}>{t("movieDetailVideoContinue")}</button></div></div></div> : null}
      {deleteConfirmId !== null ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"><div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950 p-5 text-center shadow-2xl"><p className="text-sm font-semibold text-zinc-100">{t("movieDetailVideoDeleteConfirm")}</p><div className="mt-5 flex gap-3"><button type="button" className="flex-1 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={() => setDeleteConfirmId(null)}>{t("movieDetailVideoCancel")}</button><button type="button" className="flex-1 rounded-xl bg-red-400 px-4 py-2 text-sm font-bold text-black" onClick={() => { const id = deleteConfirmId; setDeleteConfirmId(null); void deleteVideo(id); }}>{t("movieDetailVideoDeleteAction")}</button></div></div></div> : null}
      {recorderState === "validatingSelected" ? <div className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-center"><p className="text-sm text-zinc-300">{t("movieDetailVideoReadingSelectedFile")}</p></div> : null}
      {recorderState === "requestingPermission" ? <div className="w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-center"><p className="text-sm text-zinc-300">{t("movieDetailVideoRequestingPermission")}</p><button type="button" className="mt-3 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-100" onClick={cancelRequest}>{t("movieDetailVideoCancel")}</button></div> : null}
      {showRecorderShell ? <div className={`w-full space-y-3 ${orientationPaused ? "invisible" : "visible"}`}>
        <div className="relative mx-auto max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={{ aspectRatio: previewAspectRatio, height: recorderState === "preparingRecorder" || recorderState === "recording" || isRecordedPreviewOverlay ? VIDEO_COMMENT_RECORDING_PREVIEW_HEIGHT : undefined, width: previewOrigin === "selected" ? "100%" : undefined, maxHeight: "calc(100dvh - 230px)" }}>
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
    {videoDebugEnabled ? <aside className="mt-4 max-h-56 w-full overflow-auto rounded-xl border border-amber-400/40 bg-black p-3 font-mono text-[10px] text-amber-200" aria-label="Video debug"><strong>VIDEO DEBUG ACTIVO</strong>{videoDebugEntries.map((entry, index) => <div key={`${index}-${entry}`}>{entry}</div>)}</aside> : null}
    <div className="mt-5 space-y-3">
      {recorderState === "idle" && initialLoading ? <p className="text-center text-sm text-zinc-400">{t("movieDetailVideoLoadingVideos")}</p> : null}
      {recorderState === "idle" && historyError ? <div className="text-center text-sm text-red-200"><p>{historyError}</p><button type="button" className="mt-2 rounded-lg border border-white/10 px-3 py-1 text-zinc-100" onClick={reloadFirstPage}>{t("movieDetailVideoRetry")}</button></div> : null}
      {showEmpty ? <p className="text-center text-sm text-zinc-500">{t("movieDetailVideoEmpty")}</p> : null}
      {recorderState === "idle" ? comments.map((comment) => {
        const id = String(comment.id);
        const state = playerStates[id] ?? { paused: true, muted: soundPreference !== "sound-on" };
        return <article key={comment.id} data-video-comment-card={id} className="space-y-1.5 rounded-2xl border border-white/10 bg-black/25 p-2.5">
          <div className="flex items-center gap-3"><button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xs text-zinc-300" aria-label={`Ver perfil de ${comment.user.username}`} onClick={() => onAuthorClick(comment.user.username)}>{comment.user.avatar ? // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.user.avatar} alt="" className="h-full w-full object-cover" /> : comment.user.username.slice(0,2).toUpperCase()}</button><div className="flex min-w-0 flex-1 items-baseline gap-3"><button type="button" className="min-w-0 truncate text-left text-sm font-bold text-zinc-100 hover:text-[#86ADE0]" onClick={() => onAuthorClick(comment.user.username)}>{comment.user.username}</button><time className="shrink-0 text-xs text-zinc-500">{new Date(comment.created_at).toLocaleDateString()}</time></div>{comment.can_delete === true ? <button type="button" className="rounded-lg border border-red-400/30 px-2 py-1 text-xs font-semibold text-red-200 disabled:opacity-60" disabled={!!deletingIds[id]} onClick={() => setDeleteConfirmId(comment.id)}>{t("movieDetailVideoDelete")}</button> : null}</div>
          <div className="flex w-full items-center justify-center overflow-hidden rounded-xl bg-black">
            <div className="relative inline-flex max-w-full overflow-hidden rounded-xl">
              <video data-video-comment-player="true" data-video-comment-id={id} src={comment.video_url} preload="metadata" playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="h-auto w-auto max-w-full object-contain" style={{ maxHeight: VIDEO_COMMENT_CARD_VIDEO_HEIGHT }} onClick={() => toggleHistoryPlayback(id)} onPlay={(event) => { activeVideoIdRef.current = id; pauseOtherHistoryVideos(id); syncPlayerState(event.currentTarget); }} onPause={(event) => syncPlayerState(event.currentTarget)} onVolumeChange={(event) => syncPlayerState(event.currentTarget)} onEnded={(event) => { endedRef.current.add(id); syncPlayerState(event.currentTarget); }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-7">
                <button type="button" className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-base text-white" aria-label={t(state.muted ? "movieDetailVideoSoundOn" : "movieDetailVideoMute")} onClick={() => toggleHistorySound(id)}>{state.muted ? "🔇" : "🔊"}</button>
                <button type="button" className="pointer-events-auto ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-lg text-white" aria-label={t("movieDetailVideoExpand")} onClick={() => openExpandedVideo(id)}>⛶</button>
              </div>
            </div>
          </div>
        </article>;
      }) : null}
      {recorderState === "idle" && loadingMore ? <p className="text-center text-sm text-zinc-400">{t("movieDetailVideoLoadingVideos")}</p> : null}{recorderState === "idle" ? <div ref={sentinelRef} aria-hidden="true" className="h-1" /> : null}
    </div>
    {orientationPaused ? <div className="fixed inset-0 z-[200] flex h-[100dvh] w-[100dvw] items-center justify-center bg-black px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center" role="alert" aria-live="assertive"><div className="w-full max-w-lg"><span className="video-reaction-phone mx-auto mb-6 block h-20 w-11 rounded-xl border-2 border-white" aria-hidden="true" /><p className="text-lg font-bold leading-relaxed text-white sm:text-xl">{t("movieDetailVideoRotatePortrait")}</p></div></div> : null}
    {previewExpanded && previewUrl ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black p-3" role="dialog" aria-modal="true" aria-label={t("movieDetailVideoExpand")}><button type="button" className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900/80 text-2xl text-white" aria-label={t("movieDetailVideoCloseExpanded")} onClick={() => setPreviewExpanded(false)}>×</button><video src={previewUrl} autoPlay muted playsInline controls={false} controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className={`${previewOrigin === "recorded" ? "aspect-[9/16] h-[calc(100dvh-1.5rem)] w-auto" : "max-h-[calc(100dvh-1.5rem)] max-w-full"} object-contain`} /></div> : null}
    {expandedVideoId !== null ? (() => {
      const comment = comments.find((item) => String(item.id) === expandedVideoId);
      if (!comment) return null;
      const state = playerStates[expandedVideoId] ?? { paused: true, muted: true };
      return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-2" role="dialog" aria-modal="true" aria-label={t("movieDetailVideoExpandedFeed")}>
        <button type="button" className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl text-white" aria-label={t("movieDetailVideoCloseExpanded")} onClick={closeExpandedVideo}>×</button>
        <div className="relative flex h-full w-full items-center justify-center">
          <video ref={(node) => { if (node) expandedVideosRef.current.set(expandedVideoId, node); else expandedVideosRef.current.delete(expandedVideoId); }} src={comment.video_url} autoPlay muted playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback className="max-h-[calc(100dvh-1rem)] max-w-full object-contain" onClick={(event) => event.currentTarget.paused ? void event.currentTarget.play() : event.currentTarget.pause()} onPlay={(event) => syncPlayerState(event.currentTarget)} onPause={(event) => syncPlayerState(event.currentTarget)} onVolumeChange={(event) => syncPlayerState(event.currentTarget)} />
          <button type="button" className="absolute bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl text-white" aria-label={t(state.muted ? "movieDetailVideoSoundOn" : "movieDetailVideoMute")} onClick={() => { const video = expandedVideosRef.current.get(expandedVideoId); if (!video) return; video.muted = !video.muted; syncPlayerState(video); }}>{state.muted ? "🔇" : "🔊"}</button>
        </div>
      </div>;
    })() : null}
  </section>;
}

function MovieDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branding = useAppBranding();
  const { locale, t } = useI18n();
  const params = useParams<{ id: string }>();
  const movieId = params?.id ? String(params.id) : "";

  const [movie, setMovie] = useState<Movie | null>(null);
  const [movieLoading, setMovieLoading] = useState(true);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [movieError, setMovieError] = useState("");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [followingUsers, setFollowingUsers] = useState<SocialUser[]>([]);
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
  const [publicSearchQuery, setPublicSearchQuery] = useState("");
  const [directedSearchQuery, setDirectedSearchQuery] = useState("");
  const [selectedPublicFilterUser, setSelectedPublicFilterUser] = useState<CommentFilterUser | null>(null);
  const [selectedDirectedFilterUser, setSelectedDirectedFilterUser] = useState<CommentFilterUser | null>(null);
  const [isPublicSearchOpen, setIsPublicSearchOpen] = useState(false);
  const [isDirectedSearchOpen, setIsDirectedSearchOpen] = useState(false);
  const [activeCommentsTab, setActiveCommentsTab] = useState<"public" | "directed">("public");
  const [commentInputMode, setCommentInputMode] = useState<CommentInputMode>("video-comment");
  const [pendingDirectedNotificationTarget, setPendingDirectedNotificationTarget] =
    useState<PendingDirectedNotificationTarget | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const textCommentStartRef = useRef<HTMLDivElement | null>(null);
  const videoCommentStartRef = useRef<HTMLDivElement | null>(null);
  const pendingCommentInputScrollRef = useRef<CommentInputMode | null>(null);
  const directedCommentsSectionRef = useRef<HTMLElement | null>(null);
  const processedDirectedTargetRef = useRef<string | null>(null);


  const getMobileStickyOffset = useCallback(() => {
    // Keep targets below the primary mobile sticky header plus the page gap; desktop keeps the existing static layout.
    if (typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches) return 0;
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
      if (commentInputMode === mode) {
        scrollCommentStartIntoView(mode);
        return;
      }

      pendingCommentInputScrollRef.current = mode;
      setCommentInputMode(mode);
    },
    [commentInputMode, scrollCommentStartIntoView],
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
          apiFetch("/me/").then(
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

        const meUsername = meResult.ok ? getCurrentUsernameFromPayload(meResult.payload) ?? "" : "";
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

  useEffect(() => {
    if (searchParams.get("section") !== "directed-comments") return;
    const actorId = normalizeId(searchParams.get("actorId"));
    const actorUsername = normalizeUsername(searchParams.get("actorUsername"));
    const commentId = normalizeId(searchParams.get("commentId"));
    if (!actorId && !actorUsername) return;

    const targetKey = `${movieId}:${actorId ?? ""}:${actorUsername ?? ""}:${commentId ?? ""}`;
    if (processedDirectedTargetRef.current === targetKey) return;
    processedDirectedTargetRef.current = targetKey;
    setActiveCommentsTab("directed");
    setCommentInputMode("text-comment");
    setPendingDirectedNotificationTarget({ actorId, actorUsername, commentId, conversationKey: null, stage: "find-conversation" });
  }, [movieId, searchParams]);

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

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-[1000px] space-y-6 px-4 py-3 md:px-8 md:py-8">
        <div ref={stickyHeaderRef} data-mobile-detail-sticky="true" className="sticky top-0 z-40 -mx-4 space-y-6 bg-black px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:static md:z-auto md:mx-0 md:bg-transparent md:p-0">
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
            <MovieCard
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
            />
          ) : null}

          <div data-mobile-comment-tabs className="flex items-center justify-between gap-4 md:hidden" role="tablist" aria-label={composerTitle}>
            {(["video-comment", "text-comment"] as const).map((mode) => {
              const isActiveMode = commentInputMode === mode;

              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={isActiveMode}
                  className={`flex min-h-11 flex-1 items-center justify-center px-2 py-2 text-center leading-tight transition-[color,font-size,font-weight] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86ADE0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${isActiveMode ? "text-base font-bold text-[#86ADE0]" : "text-sm font-medium text-zinc-400"}`}
                  onClick={() => handleCommentInputTabClick(mode)}
                >
                  {mode === "text-comment" ? composerTitle : t("movieDetailVideoCommentTitle")}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={textCommentStartRef} data-mobile-text-comment data-active={commentInputMode === "text-comment"} className={`md:hidden ${commentInputMode === "text-comment" ? "block" : "hidden"}`}>
          <CommentComposer friends={composerFriends} searchMentionSuggestions={searchMentionSuggestions} onSubmit={handleSubmitComment} loading={isSubmitting} error={composerError} placeholder={composerPlaceholder} title={composerTitle} hideTitleOnMobile />
        </div>
        <div ref={videoCommentStartRef}>
          <MobileVideoComments movieId={movieId} active={commentInputMode === "video-comment"} t={t} onAuthorClick={handleAuthorNavigation} />
        </div>
        <div data-desktop-comment-composer className="hidden md:block">
          <CommentComposer friends={composerFriends} searchMentionSuggestions={searchMentionSuggestions} onSubmit={handleSubmitComment} loading={isSubmitting} error={composerError} placeholder={composerPlaceholder} title={composerTitle} />
        </div>

        {reactionError ? <div className={`rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 ${commentInputMode === "video-comment" ? "hidden md:block" : ""}`}>{reactionError}</div> : null}

        <div data-comment-history data-video-active={commentInputMode === "video-comment"} className={`relative grid-cols-1 gap-6 ${commentInputMode === "video-comment" ? "hidden md:grid" : "grid"} ${shouldRenderDirectedComments ? "lg:grid-cols-2 lg:gap-10" : ""}`}>
          {shouldRenderDirectedComments ? (
            <>
              <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 top-12 hidden w-px -translate-x-1/2 bg-[#2d3a4f] lg:block" />
              <div className="flex rounded-xl border border-white/10 bg-zinc-950/60 p-1 lg:hidden" role="tablist" aria-label="Comments sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCommentsTab === "public"}
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
          <section className={`space-y-3 ${shouldRenderDirectedComments && activeCommentsTab !== "public" ? "hidden lg:block" : ""}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className={`text-xl font-bold text-[#86ADE0] ${shouldRenderDirectedComments ? "hidden lg:block" : ""}`}>{t("movieDetailPublicComments")}</h2>
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
            <CommentsList
              comments={filteredPublicComments}
              loading={loadingPublic}
              error={publicError}
              emptyMessage={t("movieDetailNoPublicComments")}
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
            />
          </section>

          {shouldRenderDirectedComments ? (
            <section ref={directedCommentsSectionRef} className={`space-y-3 ${activeCommentsTab !== "directed" ? "hidden lg:block" : ""}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="hidden text-xl font-bold text-[#86ADE0] lg:block">{t("movieDetailDirectedComments")}</h2>
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
                <p className="p-4 text-sm text-zinc-400">
                  {selectedDirectedFilterUser ? t("movieDetailNoDirectedCommentsWithUser") : t("movieDetailNoDirectedComments")}
                </p>
              ) : null}
              {!loadingDirected && !directedError ? (
                <div className="px-1 py-2 lg:scrollbar-dark lg:max-h-[28rem] lg:overflow-y-auto">
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
                              className="mt-3 border-t border-white/10 pt-3 lg:scrollbar-metallic-blue lg:max-h-[24rem] lg:overflow-y-auto"
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
