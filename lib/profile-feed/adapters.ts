import { favoriteMoviesMock, followingMock, friendsMock, socialActivityMock } from "./mocks";
import { FavoriteMovie, PaginatedSocialActivity, SocialActivityItem, SocialTab, SocialUser } from "./types";

const PAGE_SIZE_DEFAULT = 6;

function sortUsersByFollowersDesc(users: SocialUser[]): SocialUser[] {
  return [...users].sort((a, b) => b.followersCount - a.followersCount);
}

function sortActivityByFollowersAndRecency(items: SocialActivityItem[]): SocialActivityItem[] {
  return [...items].sort((a, b) => {
    if (b.user.followersCount !== a.user.followersCount) {
      return b.user.followersCount - a.user.followersCount;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function withArtificialDelay<T>(payload: T, delayMs = 240): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), delayMs);
  });
}

export async function getFavoriteMovies(): Promise<FavoriteMovie[]> {
  return withArtificialDelay([...favoriteMoviesMock]);
}

export async function getTopFriends(limit = 5): Promise<SocialUser[]> {
  return withArtificialDelay(sortUsersByFollowersDesc(friendsMock).slice(0, limit));
}

export async function getTopFollowing(limit = 5): Promise<SocialUser[]> {
  return withArtificialDelay(sortUsersByFollowersDesc(followingMock).slice(0, limit));
}

export async function getSocialActivity(
  tab: SocialTab,
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
): Promise<PaginatedSocialActivity> {
  const sorted = sortActivityByFollowersAndRecency(socialActivityMock.filter((item) => item.tab === tab));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = sorted.slice(start, end);

  return withArtificialDelay({
    items,
    nextPage: end < sorted.length ? page + 1 : null,
  });
}
