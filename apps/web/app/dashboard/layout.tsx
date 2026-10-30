import { DashboardData } from "./data";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardData>{children}</DashboardData>;
}
