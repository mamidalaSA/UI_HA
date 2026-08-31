import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className = "" }: PanelProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
