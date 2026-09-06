// @ts-nocheck
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import AdminDashboard from "../components/AdminDashboard";
import DriverOnboarding from "../components/DriverOnboarding";
import AdminTripHistory from "../components/AdminTripHistory";

export default function AdminPortal() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === "authenticated" && session.user.role !== "admin") router.replace("/portal"); }, [status, session, router]);
  return status === "authenticated" && session.user.role === "admin" ? <><AdminDashboard /><main className="page"><AdminTripHistory /><DriverOnboarding /></main></> : <div className="page"><p className="empty">Opening admin portal...</p></div>;
}