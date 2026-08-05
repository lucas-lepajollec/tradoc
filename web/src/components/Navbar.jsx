import React from 'react';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, BookMarked, Cpu, Sparkles, TestTube } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, endpointStatus }) {
  const navItems = [
    { id: 'dashboard', label: 'Projets & Traduction', icon: LayoutDashboard },
    { id: 'jobs', label: 'Inspecteur & Segments', icon: BookOpen },
    { id: 'sandbox', label: 'Aperçu & Sandbox', icon: TestTube },
    { id: 'settings', label: 'Configuration & Serveur', icon: SettingsIcon },
    { id: 'glossary', label: 'Glossaires', icon: BookMarked },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#09090d]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg text-white tracking-tight">TraDoc</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hidden sm:inline">v2.0 Local AI</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-[#111116] p-1 rounded-xl border border-white/5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Server Endpoint Status Indicator */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-[#111116] px-3 py-1.5 rounded-full border border-white/5">
            <div className={`w-2 h-2 rounded-full ${endpointStatus ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap">
              {endpointStatus ? 'GPU Online' : 'GPU Injoignable'}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
