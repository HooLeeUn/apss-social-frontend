"use client";

export default function VideoReactionMovieMetadata({ poster, title, onTitleClick }: { poster: string | null; title: string; onTitleClick: () => void }) {
  if (!title) return null;
  return <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[52%] -translate-x-1/2 items-center gap-2 bg-transparent text-white lg:hidden">
    {poster ? <img src={poster} alt="" className="h-11 w-8 shrink-0 rounded-md border border-white/20 object-cover shadow-lg" /> : null}
    <button type="button" onClick={(event) => { event.stopPropagation(); onTitleClick(); }} className="line-clamp-2 min-w-0 text-left text-sm font-bold leading-tight [text-shadow:0_2px_5px_rgb(0_0_0/0.95)] hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" title={title}>{title}</button>
  </div>;
}
