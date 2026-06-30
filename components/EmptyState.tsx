import React from "react";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { title, description, icon, action } = props;
  return (
    <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-300 shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
