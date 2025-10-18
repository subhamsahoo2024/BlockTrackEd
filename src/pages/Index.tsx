import React from 'react';
import { Web3Provider } from '@/contexts/Web3Context';
import { WalletConnect } from '@/components/WalletConnect';
import { AdminPortal } from '@/components/portals/AdminPortal';
import { SchoolPortal } from '@/components/portals/SchoolPortal';
import { StudentPortal } from '@/components/portals/StudentPortal';
import { useWeb3 } from '@/contexts/Web3Context';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function AppContent() {
  const { isConnected, userRole } = useWeb3();

  if (!isConnected) {
    return <WalletConnect />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header with mobile-first design */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">B</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BlockTrackEd
            </h1>
          </div>
          <div className="shrink-0">
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {userRole === 'owner' && <AdminPortal />}
        {userRole === 'school' && <SchoolPortal />}
        {(userRole === 'student' || !userRole) && <StudentPortal />}
      </main>
    </div>
  );
}

const Index = () => {
  return (
    <Web3Provider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </Web3Provider>
  );
};

export default Index;
