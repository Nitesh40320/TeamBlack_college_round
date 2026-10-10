import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  PlusCircle,
  History,
  FileCheck2,
  Activity,
  ChevronRight,
  Sparkles,
  BarChart3,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const location = useLocation();

  const getBreadcrumbs = () => {
    if (location.pathname.startsWith('/new')) return 'New Audit';
    if (location.pathname.startsWith('/audit')) return 'Audit Report';
    if (location.pathname.startsWith('/history')) return 'Audit History';
    if (location.pathname.startsWith('/evaluation')) return 'Evaluation Benchmark';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/60 border-r border-white/5 flex flex-col justify-between shrink-0 glass-panel">
        <div>
          {/* Logo Header */}
          <div className="p-6 border-b border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-1.5">
                Second Opinion
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Fact Audit Engine
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1.5">
            <NavLink
              to="/new"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>New Audit</span>
            </NavLink>

            <NavLink
              to="/audit/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <span>Active Audit</span>
            </NavLink>

            <NavLink
              to="/history"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Audit History</span>
            </NavLink>

            <NavLink
              to="/evaluation"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`
              }
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-teal-400" />
              <span>Eval Benchmark</span>
            </NavLink>
          </nav>
        </div>


        {/* Footer info */}
        <div className="p-4 border-t border-white/5">
          <div className="glass-card p-3 rounded-xl border border-white/5 bg-slate-900/40 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-medium">Model Service</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Mock Active
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b border-white/5 bg-slate-900/40 glass-panel px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Second Opinion</span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className="text-slate-100 font-semibold">{getBreadcrumbs()}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              <span>Pipeline Engine v0.1.0</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
