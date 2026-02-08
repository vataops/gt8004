"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { agent, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !agent) {
      router.replace("/login");
    }
  }, [loading, agent, router]);

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!agent) {
    return null;
  }

  return <>{children}</>;
}
