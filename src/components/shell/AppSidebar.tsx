import SidebarContent from "./SidebarContent";

/** Sidebar fixe sur >= md ; cachée en mobile (utiliser MobileSidebar). */
export default function AppSidebar({ demoMode }: { demoMode: boolean }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <SidebarContent demoMode={demoMode} />
    </aside>
  );
}
