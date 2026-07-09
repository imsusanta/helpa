import { DashboardDispatcher } from "@/components/dashboard/dashboard-dispatcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Dashboard - ReplyDesk",
};

export default function DashboardPage() {
  return <DashboardDispatcher />;
}
