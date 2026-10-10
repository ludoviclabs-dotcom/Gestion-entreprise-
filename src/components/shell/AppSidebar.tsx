import { Sidebar } from "./Sidebar";
import SidebarContent from "./SidebarContent";

/** Sidebar fixe sur >= md ; cachée en mobile (utiliser MobileSidebar). */
export default function AppSidebar({ demoMode }: { demoMode: boolean }) {
  return (
    <Sidebar className="hidden md:flex">
      <SidebarContent demoMode={demoMode} />
    </Sidebar>
  );
}
