export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-16">
      {Icon && <Icon size={48} className="mx-auto mb-4 text-gray-300" />}
      <h3 className="text-lg font-semibold text-body">{title}</h3>
      {description && <p className="text-body-muted mt-1">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
