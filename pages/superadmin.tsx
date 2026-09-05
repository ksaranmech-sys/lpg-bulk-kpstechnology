// @ts-nocheck
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Dashboard from "./dashboard";
import DriverOnboarding from "../components/DriverOnboarding";

export default function SuperadminPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === "authenticated" && session.user.role !== "superadmin") router.replace("/portal"); }, [status, session, router]);
  return status === "authenticated" && session.user.role === "superadmin" ? <><Dashboard /><main className="page"><DriverOnboarding /></main></> : <div className="page"><p className="empty">Opening KPS portal...</p></div>;
}