import React from "react";

export function EmptyState(props: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  const { title, description, icon } = props;
  return (
    <div className="app-card p-8 text-center">
      <div className="mx-auto w-16 h-16 rounded-3xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-400">
        {icon}
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-widest text-neutral-900">{title}</p>
      {description ? (
        <p className="mt-2 text-[11px] font-bold text-neutral-600">{description}</p>
      ) : null}
    </div>
  );
}
