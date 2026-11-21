// White card with 12px rounded corners and a subtle border.
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-border shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
