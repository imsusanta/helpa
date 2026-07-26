import { requireSuperAdmin } from "@/lib/auth/admin";
import { McpConnectView } from "@/components/admin/mcp-connect-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "MCP Server Integration Hub - Super Admin - Helpa Studio",
};

export default async function AdminMcpPage() {
  // Ensure only Super Admins can access this page
  await requireSuperAdmin();

  return (
    <div className="p-6">
      <McpConnectView />
    </div>
  );
}
