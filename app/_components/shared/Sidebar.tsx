"use client";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  links: { name: string; href: string; icon: any }[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar = ({ links, isOpen, setIsOpen }: SidebarProps) => {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
        fixed top-0 left-0 z-50 h-screen w-[260px] bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-6 border-b">
          <h1 className="text-xl font-bold text-[#1e3a8a]">Kibali Center</h1>
          <button
            aria-label="toggle sidebar"
            className="lg:hidden"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-[#1e3a8a]/10 text-[#1e3a8a]"
                      : "text-slate-600 hover:bg-slate-100"
                  }
                `}
                onClick={() => setIsOpen(false)} // Close on mobile after click
              >
                <Icon size={18} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
