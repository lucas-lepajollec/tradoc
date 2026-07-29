import React from 'react';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, BookMarked, Cpu, Sparkles, TestTube, ChevronRight, X } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, endpointStatus, endpointUrl, isOpen, onClose }) {
  const navItems = [
    { id: 'dashboard', label: 'Projets & Traduction', icon: LayoutDashboard },
    { id: 'jobs', label: 'Inspecteur & Segments', icon: BookOpen },
    { id: 'sandbox', label: 'Bac à sable (Aperçu)', icon: TestTube },
    { id: 'settings', label: 'Configuration GPU', icon: SettingsIcon },
    { id: 'glossary', label: 'Glossaires', icon: BookMarked },
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  const renderContent = (isMobile = false) => (
    <>
      {/* Top Brand & Navigation */}
      <div className="space-y-8">
        
        {/* Brand Logo */}
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            <img src="/logo.svg" alt="TraDoc Logo" className="w-9 h-9 rounded-xl shadow-md shadow-orange-500/10" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-extrabold text-lg text-white tracking-tight">TraDoc</span>
                <span className="text-[10px] font-mono text-orange-300 bg-orange-500/15 px-1.5 py-0.5 rounded border border-orange-500/30 font-bold">Pro</span>
              </div>
              <p className="text-[11px] text-zinc-400">Traduction Littéraire AI</p>
            </div>
          </div>

          {isMobile && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-3 mb-2">Menu Principal</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 font-semibold shadow-md shadow-orange-500/5'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-orange-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-orange-400" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Server Health Indicator */}
      <div className="pt-4 border-t border-white/5">
        <div className="card-chill p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300 flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <span>Serveur LLM</span>
            </span>
            <div className={`w-2 h-2 rounded-full ${endpointStatus ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>
          <p className="text-[11px] font-mono text-zinc-400 truncate">
            {endpointUrl || '192.168.0.201:1234'}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on lg screens) */}
      <aside className="w-64 flex-shrink-0 min-h-screen bg-[#0d0e14]/90 backdrop-blur-2xl border-r border-white/5 hidden lg:flex flex-col justify-between p-5 sticky top-0 z-40">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer & Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-[#0d0e14] border-r border-white/10 flex flex-col justify-between p-5 z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderContent(true)}
      </aside>
    </>
  );
}
