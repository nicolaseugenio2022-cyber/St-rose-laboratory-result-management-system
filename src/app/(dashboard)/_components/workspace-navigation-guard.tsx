"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

export type WorkspaceNavigationInterceptor = (href: string) => boolean;

export interface WorkspaceNavigationInterceptorRef {
  current: WorkspaceNavigationInterceptor | null;
}

export interface WorkspaceNavigationCoordinator {
  registerNavigationInterceptor: (
    interceptor: WorkspaceNavigationInterceptor | null
  ) => () => void;
  requestNavigation: (href: string) => boolean;
}

export function createWorkspaceNavigationCoordinator(
  interceptorRef: WorkspaceNavigationInterceptorRef
): WorkspaceNavigationCoordinator {
  const registerNavigationInterceptor = (
    interceptor: WorkspaceNavigationInterceptor | null
  ) => {
    interceptorRef.current = interceptor;

    return () => {
      if (interceptorRef.current === interceptor) {
        interceptorRef.current = null;
      }
    };
  };

  const requestNavigation = (href: string) => {
    const interceptor = interceptorRef.current;
    return interceptor !== null && interceptor(href) === true;
  };

  return { registerNavigationInterceptor, requestNavigation };
}

const WorkspaceNavigationGuardContext = createContext<WorkspaceNavigationCoordinator | null>(null);

export function WorkspaceNavigationGuardProvider({ children }: { children: ReactNode }) {
  const interceptorRef = useRef<WorkspaceNavigationInterceptor | null>(null);
  const coordinator = useMemo(
    () => createWorkspaceNavigationCoordinator(interceptorRef),
    [interceptorRef]
  );

  return (
    <WorkspaceNavigationGuardContext.Provider value={coordinator}>
      {children}
    </WorkspaceNavigationGuardContext.Provider>
  );
}

function useWorkspaceNavigationGuard(consumerName: string) {
  const guard = useContext(WorkspaceNavigationGuardContext);

  if (!guard) {
    throw new Error(`${consumerName} must be used within WorkspaceNavigationGuardProvider.`);
  }

  return guard;
}

export function useWorkspaceNavigationRequester() {
  return useWorkspaceNavigationGuard("useWorkspaceNavigationRequester").requestNavigation;
}

export function useWorkspaceNavigationInterceptor() {
  return useWorkspaceNavigationGuard(
    "useWorkspaceNavigationInterceptor"
  ).registerNavigationInterceptor;
}
