import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CopilotFloatingTrigger from '../copilot/CopilotFloatingTrigger';
import CopilotChatPanel from '../copilot/CopilotChatPanel';

export default function AppLayout({ children, title }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-app-bg text-main-text flex">
      {/* Sidebar */}
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0 transition-all duration-300">
        <Header onMenuClick={() => setIsMobileOpen(true)} title={title} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Global AI Copilot Voice & Chat Elements */}
      <CopilotFloatingTrigger />
      <CopilotChatPanel />
    </div>
  );
}
