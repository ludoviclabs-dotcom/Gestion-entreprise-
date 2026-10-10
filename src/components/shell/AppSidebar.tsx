import { Sidebar } from "./Sidebar";
import SidebarContent from "./SidebarContent";
import type { NavReview } from "./nav";

/**
 * Sidebar fixe : pleine (≥ lg), rail compact icône + libellé court (md → lg),
 * cachée sous md (le tiroir MobileSidebar prend le relais).
 */
export default function AppSidebar({ review }: { review?: NavReview }) {
  return (
    <Sidebar collapsible="rail" className="hidden md:flex">
      <SidebarContent review={review} instance="desktop" />
    </Sidebar>
  );
}
