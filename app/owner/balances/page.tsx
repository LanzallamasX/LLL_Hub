"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OwnerBalancesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/balances");
  }, [router]);

  return null;
}
