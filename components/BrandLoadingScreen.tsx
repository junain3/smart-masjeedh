"use client";

export function BrandLoadingScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-neutral-50 to-teal-50 px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(13,148,136,0.10),_transparent_34%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-emerald-100/80 bg-white/70 px-5 py-2 shadow-sm shadow-emerald-100/60 backdrop-blur">
          <span className="animate-pulse text-sm font-semibold tracking-[0.35em] text-emerald-700/90">
            SMART MASJEEDH
          </span>
        </div>

        <div className="relative mb-7 flex h-24 w-24 items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full border border-emerald-200/70 bg-emerald-100/20 animate-ping" />
          <div className="absolute h-20 w-20 rounded-full border-4 border-emerald-200/70" />
          <div className="h-20 w-20 animate-spin rounded-full border-4 border-emerald-600/90 border-t-transparent shadow-[0_0_40px_rgba(16,185,129,0.18)]" />
          <div className="absolute h-8 w-8 rounded-full bg-white/80 shadow-inner shadow-emerald-100" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
            Preparing Your Workspace
          </h1>
          <p className="text-sm font-medium tracking-[0.28em] text-emerald-900/55 uppercase sm:text-base">
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
}
