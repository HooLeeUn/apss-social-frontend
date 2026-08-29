interface ProfileRecommendationsLabelProps {
  label: string;
}

export default function ProfileRecommendationsLabel({ label }: ProfileRecommendationsLabelProps) {
  const highlightIndex = label.indexOf("Rec");

  if (highlightIndex < 0) return <>{label}</>;

  return (
    <>
      {label.slice(0, highlightIndex)}
      <span className="inline-block bg-gradient-to-r from-[#168BFF] via-[#6558F5] to-[#A63DFF] bg-clip-text text-[1.08em] font-bold leading-none text-transparent drop-shadow-[0_0_5px_rgba(99,88,245,.45)]">
        Rec
      </span>
      {label.slice(highlightIndex + 3)}
    </>
  );
}
