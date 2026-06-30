"use client";

import type { ReactNode } from "react";

type PermissionGateProps = {
  when: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate(props: PermissionGateProps) {
  const { when, fallback = null, children } = props;
  return <>{when ? children : fallback}</>;
}
