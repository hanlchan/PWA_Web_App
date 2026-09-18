type Point = { label: string; value: number };

export function TrendChart({ points, privateValues = false }: { points: Point[]; privateValues?: boolean }) {
  if (points.length < 2) return <p className="py-8 text-center text-sm text-slate-500">至少记录两次后显示趋势</p>;
  const width = 320;
  const height = 150;
  const padding = 16;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points.map((point, index) => {
    const x = padding + index * ((width - padding * 2) / (points.length - 1));
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={privateValues ? "私人真实体重趋势" : "公开归一化体重趋势"} className="w-full overflow-visible">
        <path d={path} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="flex justify-between text-xs text-slate-400">
        <span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}
