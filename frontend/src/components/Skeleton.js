// Simple loading skeleton placeholders.
export default function Skeleton({ className = '', width = 'full', height = 16 }) {
  const w = width === 'full' ? 'w-full' : `w-[${width}px]`;
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200 ${w} ${className}`}
      style={{ height }}
    />
  );
}
