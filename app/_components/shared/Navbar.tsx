"use client";
import { Bell, Menu, Search, User } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white/80 px-4 backdrop-blur-md lg:px-8">
      {/* Left: Mobile Menu & Search */}
      <div className="flex items-center gap-4">
        <button
          aria-label="toggle navbar"
          onClick={onMenuClick}
          className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} className="text-slate-600" />
        </button>

        <div className="relative hidden items-center md:flex">
          <Search className="absolute left-3 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search students..."
            className="h-9 w-64 rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
          />
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          aria-label="notifications"
          className="relative rounded-full p-2 hover:bg-slate-100"
        >
          <Bell size={20} className="text-slate-600" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-slate-200 mx-2"></div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-900">Admin User</p>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e3a8a] text-white">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
