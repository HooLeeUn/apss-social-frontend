# Mobile horizontal access

## Scope and audit

- `components/MovieCard.tsx`: main feed information area; poster remains 108 x 164 CSS px (114 x 172 at sm). Existing absolute interaction icons, truncated metadata, and fixed minimum action widths can collide. Extended metadata / Detail Movie keep their original rendering branch.
- `components/profile-feed/ProfileIdentityCard.tsx`: shared own/visited identity; truncated username/full name, wrapping chips, and an absolute follower pill. Avatar, padding and existing card height classes are retained.
- `components/profile-feed/FavoriteMoviesBlock.tsx`: fixed 180px card; secondary ratings now pan without changing this height. RatingPopover already renders through a portal.
- `components/profile-feed/MyActivityColumn.tsx`: own activity header previously wrapped buttons.
- `components/profile-feed/SocialActivityTabsBlock.tsx`: three equal columns previously compressed text; mobile columns now have an intrinsic minimum width. The absolute animated activity slot measures its translated labels through an invisible intrinsic sizing element.
- `components/profile-feed/ProfileQuickNavigation.tsx` and `app/profile-feed/page.tsx`: page already reserved 7rem plus the safe area; reservation now also includes the measured navigation height plus 3.5rem clearance for its floating control.

## New shared components and activation rules

`components/AutoReturnHorizontalScroll.tsx` uses native scrolling below 1280 CSS px. It enables keyboard access only when scrollWidth exceeds clientWidth by more than 1px. ResizeObserver, content mutations and font readiness refresh the measurement. Scrollbars are hidden; vertical scrolling and native clicks are not intercepted. A 1500ms inactivity timer returns scrollLeft to zero, with smooth scrolling or instant return for reduced motion. New gestures cancel the timer, momentum restarts it, keyboard focus pauses it, and unmount removes timers, observers and listeners. Fitting non-text rows keep overflow visible to retain existing shadows.

`components/AdaptiveFeedInformation.tsx` keeps the original feed information as the normal layout. Below 1280px, compact mode activates only for measured horizontal overflow, genre/icon collision, overlapping rating boxes, or rating-row scroll overflow. An inert invisible normal-layout probe keeps detection stable while compact. The compact view uses the existing poster height, a fixed title, and horizontally snapping metadata/controls panels; it starts at zero whenever mounted. The probe and the compact controls are mounted together only in compact mode.

The profile follower pill joins the mobile chip row only when the sum of measured chip widths, gaps and follower width exceeds the row width. Otherwise its existing absolute placement is retained. Its original box remains invisible during this mode so repeated measurements cannot oscillate.

## Files changed

- app/globals.css
- app/profile-feed/page.tsx
- components/AutoReturnHorizontalScroll.tsx (new)
- components/AdaptiveFeedInformation.tsx (new)
- components/MovieCard.tsx
- components/profile-feed/ProfileIdentityCard.tsx
- components/profile-feed/FavoriteMoviesBlock.tsx
- components/profile-feed/MyActivityColumn.tsx
- components/profile-feed/SocialActivityTabsBlock.tsx
- components/profile-feed/ProfileQuickNavigation.tsx
- tests/mobile-horizontal-access.test.mjs (new)
- docs/mobile-horizontal-access.md (this report)

No backend, native Android/TWA, native navigation, or Detail Movie feature changes.

## Verification

- `npx tsc --noEmit`: passed.
- `npm test`: 303 passed, 0 failed. Initial sandbox EPERM required running the test command with approval outside the sandbox.
- New runtime tests exercise the scroll effect with mocked DOM geometry, timers and listeners: fitting/desktop regions, 1500ms return, reduced motion, touch cancellation, momentum reset, listener/timer cleanup and absence of click interception. Source assertions cover nowrap and measured compact-mode gating.
- ESLint on changed components: no errors; six image-element warnings in MovieCard and FavoriteMoviesBlock. Final lint on new scrolling/measurement components and profile/tabs changes: passed.
- `git diff --check`: passed.

## Pending manual acceptance

No browser automation connector or Android device was available in this session. Visual identity at normal scale and real Android/TWA gesture behavior have not been manually verified. Before release, check normal scale, system display scale +1/+2, long usernames, short chip rows, all tabs, and the last favorite card above the floating panel. Also check translated labels, moderate font scaling, keyboard focus and reduced motion. These are pending acceptance checks, not claimed passing results. Extreme scaling where even a single control exceeds the available card height may require a separate design pass; no card height was increased here.
