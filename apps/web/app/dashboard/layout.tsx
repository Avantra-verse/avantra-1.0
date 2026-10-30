import { DashboardData } from "./data";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // md+: no top bar (the sidebar replaces it), so take back <main>'s top padding and clear the sidebar.
  return (
    <div className="md:-mt-16 md:pl-60">
      <DashboardData>{children}</DashboardData>
    </div>
  );
}
