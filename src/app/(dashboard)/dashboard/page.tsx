import { ClinicalDashboardClient } from "@/components/dashboard/clinical-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Clinical Dashboard - WACRM",
};

export default function DashboardPage() {
  return <ClinicalDashboardClient />;
}
