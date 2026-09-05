// @ts-nocheck
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

export default function PortalRouter() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated") return;
    const destination = session.user.role === "superadmin" ? "/superadmin" : session.user.role === "admin" ? "/admin" : "/driver";
    router.replace(destination);
  }, [status, session, router]);

  return <div className="page"><p className="empty">Opening your portal...</p></div>;
}