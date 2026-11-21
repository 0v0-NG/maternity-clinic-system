export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 w-full">
      {Icon && <Icon size={48} className="mx-auto mb-4 text-gray-300 flex-shrink-0" />}
      <h3 className="text-lg font-semibold text-body text-center">{title}</h3>
      {description && (
        <p className="text-body-muted mt-1 text-center max-w-sm mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-6 flex justify-center items-center w-full">
          {action}
        </div>
      )}
    </div>
  );
}
