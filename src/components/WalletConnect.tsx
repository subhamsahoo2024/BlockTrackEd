import React from 'react';
import { Wallet, LogOut, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWeb3 } from '@/contexts/Web3Context';

export function WalletConnect() {
  const { account, isConnected, userRole, connect, disconnect, loading, error } = useWeb3();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-card shadow-elegant border-0">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Connecting to MetaMask...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 sm:space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-glow">
              <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BlockTrackEd
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Decentralized scholarship distribution and management platform
            </p>
          </div>

          <Card className="bg-gradient-card shadow-elegant border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-semibold mb-2">Connect Your Wallet to Login</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                    Connect with MetaMask to access the scholarship platform
                  </p>
                </div>

                {error && (
                  <Alert className="border-destructive/20 bg-destructive/5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive text-sm">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={connect} 
                  className="w-full mobile-touch-target" 
                  variant="gradient"
                  size="lg"
                  disabled={loading}
                >
                  <Wallet className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Connect MetaMask
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Make sure you have MetaMask installed and connected to the correct network
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2">
      <div className="text-right hidden sm:block">
        <p className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[120px]">
          {account?.slice(0, 6)}...{account?.slice(-4)}
        </p>
        <p className="text-xs text-muted-foreground capitalize truncate">
          {userRole} Portal
        </p>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={disconnect}
        className="gap-1 sm:gap-2 shrink-0 mobile-touch-target"
      >
        <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline text-xs">Disconnect</span>
      </Button>
    </div>
  );
}