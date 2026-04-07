"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth/token";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getToken();
    const authed = Boolean(token);
    setIsAuthenticated(authed);
    setIsReady(true);
    if (!authed) {
      router.replace("/login");
    }
  }, [router]);

  if (!isReady || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
