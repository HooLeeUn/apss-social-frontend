interface ProfileRecommendationsLabelProps {
  label: string;
  reactions?: boolean;
}

export default function ProfileRecommendationsLabel({ label, reactions = false }: ProfileRecommendationsLabelProps) {
  const highlightIndex = label.indexOf("Rec");

  const brandClassName = "inline-block bg-gradient-to-r from-[#168BFF] via-[#6558F5] to-[#A63DFF] bg-clip-text text-[1.08em] font-bold leading-none text-transparent drop-shadow-[0_0_5px_rgba(99,88,245,.45)]";
  if (reactions && label.startsWith("Reac")) return <><span className={brandClassName}>{label.slice(0, 2)}</span>{label.slice(2, 3)}<span className={brandClassName}>{label.slice(3, 4)}</span>{label.slice(4)}</>;

  if (highlightIndex < 0) return <>{label}</>;

  return (
    <>
      {label.slice(0, highlightIndex)}
      <span className={brandClassName}>
        Rec
      </span>
      {label.slice(highlightIndex + 3)}
    </>
  );
}
