import React, { useState, useEffect } from 'react';
import { GraduationCap, CheckCircle, XCircle, Clock, Users, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useContract, useWeb3 } from '@/contexts/Web3Context';
import { ethers } from 'ethers';

// Safe utility function for formatting ETH amounts
const safeFormatEther = (value: any): string => {
  if (value === null || value === undefined) return '0';
  try {
    return ethers.formatEther(value);
  } catch {
    return '0';
  }
};

interface Application {
  student: string;
  fundId: number;
  firstName: string;
  lastName: string;
  email: string;
  cgpa: number;
  major: string;
  status: number; // 0: Pending, 1: Verified, 2: Rejected, 3: Disbursed
  amount: string;
  index: number;
}

interface Fund {
  id: number;
  amount: string;
  criteria: string;
  deadline: number;
  remaining: string;
  active: boolean;
}

export function SchoolPortal() {
  const { toast } = useToast();
  const { getContract } = useContract();
  const { account } = useWeb3();
  
  const [applications, setApplications] = useState<Application[]>([]);
  const [availableFunds, setAvailableFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvalAmounts, setApprovalAmounts] = useState<Record<string, string>>({});

  const loadApplications = async () => {
    try {
      setLoading(true);
      const contract = getContract();
      const allApplications: Application[] = [];

      // Query for all StudentApplied events from genesis block to get list of applications
      const filter = contract.filters.StudentApplied();
      const events = await contract.queryFilter(filter, 0n);
      
      console.log('StudentApplied events found:', events.length);

      // For each event, get the full application details
      for (const event of events) {
        try {
          // Type cast to access event args with robust access
          const eventLog = event as ethers.EventLog;
          if (!eventLog.args) continue;
          
          const student = eventLog.args.student ?? eventLog.args[0];
          const appIndex = eventLog.args.appIndex ?? eventLog.args[2];
          console.log('Processing application:', student, appIndex?.toString());
          
          const app = await contract.getApplication(student, Number(appIndex));
          if(Number(app[6])===2 || Number(app[6])===3) {
            // Skip rejected or disbursed applications
            continue;
          }
          // Use numeric indices for robust access to avoid Proxy issues
          allApplications.push({
            student,
            fundId: Number(app.fundId ?? app[0]),
            firstName: app.firstName ?? app[1],
            lastName: app.lastName ?? app[2],
            email: app.email ?? app[3],
            cgpa: Number(app.cgpa ?? app[4]),
            major: app.major ?? app[5],
            status: Number(app.status ?? app[6]),
            amount: safeFormatEther(app.amountApproved ?? app[7]),
            index: Number(appIndex)
          });
        } catch (appError) {
          console.error('Error loading individual application:', appError);
        }
      }

      // Sort applications: pending first, then approved, then rejected/disbursed
      allApplications.sort((a, b) => {
        if (a.status === 0 && b.status !== 0) return -1;
        if (a.status !== 0 && b.status === 0) return 1;
        if (a.status === 1 && b.status > 1) return -1;
        if (a.status > 1 && b.status === 1) return 1;
        return 0;
      });

      console.log('Total applications loaded:', allApplications.length);
      setApplications(allApplications);
    } catch (error) {
      console.error('Error loading applications:', error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFunds = async () => {
    try {
      const contract = getContract();
      const count = await contract.fundCount();
      const fundsList: Fund[] = [];
      const currentTime = Math.floor(Date.now() / 1000);
      
      for (let i = 0n; i < count; i++) {
        const fundDetails = await contract.getFundDetails(i);
        // Show active funds that haven't expired
        if (fundDetails.isActive && Number(fundDetails.deadline) > currentTime && Number(fundDetails.remaining) > 0) {
          fundsList.push({
            id: Number(i),
            amount: safeFormatEther(fundDetails.amount),
            criteria: fundDetails.criteria,
            deadline: Number(fundDetails.deadline),
            remaining: safeFormatEther(fundDetails.remaining),
            active: fundDetails.isActive
          });
        }
      }
      setAvailableFunds(fundsList);
    } catch (error) {
      console.error('Error loading available funds:', error);
    }
  };

  useEffect(() => {
    if (account) {
      loadApplications();
      loadAvailableFunds();
    }
  }, [account]);

  // Event listeners for real-time updates
  useEffect(() => {
    if (account) {
      try {
        const contract = getContract();
        
        const onStudentApplied = (student: string, fundId: bigint, appIndex: bigint) => {
          console.log('StudentApplied event:', { student, fundId: fundId.toString(), appIndex: appIndex.toString() });
          loadApplications();
        };

        const onStudentApproved = (student: string, appIndex: bigint, amount: bigint) => {
          console.log('StudentApproved event:', { student, appIndex: appIndex.toString(), amount: safeFormatEther(amount) });
          loadApplications();
          loadAvailableFunds(); // Refresh fund balances after approval
        };

        const onStudentRejected = (student: string, appIndex: bigint) => {
          console.log('StudentRejected event:', { student, appIndex: appIndex.toString() });
          loadApplications();
        };

        const onFundCreated = (fundId: bigint, amount: bigint, deadline: bigint) => {
          console.log('FundCreated event:', { fundId: fundId.toString(), amount: safeFormatEther(amount), deadline: deadline.toString() });
          loadAvailableFunds();
        };
        
        contract.on('StudentApplied', onStudentApplied);
        contract.on('StudentApproved', onStudentApproved);
        contract.on('StudentRejected', onStudentRejected);
        contract.on('FundCreated', onFundCreated);
        
        return () => {
          contract.off('StudentApplied', onStudentApplied);
          contract.off('StudentApproved', onStudentApproved);
          contract.off('StudentRejected', onStudentRejected);
          contract.off('FundCreated', onFundCreated);
        };
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
  }, [account]);

  const approveStudent = async (student: string, appIndex: number, amount: string) => {
    // Validate amount before processing
    if (!amount || amount.trim() === '' || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid approval amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const contract = getContract();
      
      // Find the application to get its fundId
      const application = applications.find(app => 
        app.student === student && app.index === appIndex
      );
      
      if (!application) {
        toast({
          title: "Error",
          description: "Application not found",
          variant: "destructive"
        });
        return;
      }

      // Fetch up-to-date fund details from contract
      const fundDetails = await contract.getFundDetails(application.fundId);
      const enteredWei = ethers.parseEther(amount.trim());
      const remainingWei = fundDetails.remaining;
      
      console.log('Approval validation:', {
        fundId: application.fundId,
        enteredAmount: amount + ' ETH',
        enteredWei: enteredWei.toString(),
        remainingAmount: safeFormatEther(remainingWei) + ' ETH',
        remainingWei: remainingWei.toString()
      });

      // Check if entered amount exceeds fund's remaining balance
      if (enteredWei > remainingWei) {
        toast({
          title: "Error",
          description: "The Accepted amount must be less than fund's remaining amount",
          variant: "destructive"
        });
        return;
      }

      const tx = await contract.approveStudent(
        student, 
        appIndex, 
        enteredWei
      );
      await tx.wait();

      toast({
        title: "Success",
        description: "Student application approved",
      });
      
      loadApplications();
    } catch (error: any) {
      // Handle parseEther errors
      if (error.message?.includes('invalid decimal value')) {
        toast({
          title: "Error",
          description: "Please enter a valid number format",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to approve student",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const rejectStudent = async (student: string, appIndex: number) => {
    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.rejectStudent(student, appIndex);
      await tx.wait();

      toast({
        title: "Success",
        description: "Student application rejected",
      });
      
      loadApplications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject student",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <Badge variant="outline" className="text-warning border-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 1:
        return <Badge variant="outline" className="text-success border-success"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 2:
        return <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 3:
        return <Badge variant="outline" className="text-primary border-primary">Disbursed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="flex-1">
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl">
        {/* Header - Better mobile alignment */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow shrink-0">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">School Portal</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Review and approve student applications</p>
          </div>
        </div>

        {/* Stats - Better responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-warning/10 rounded-lg flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {applications.filter(app => app.status === 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 rounded-lg flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Approved</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {applications.filter(app => app.status === 1).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-destructive/10 rounded-lg flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Rejected</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {applications.filter(app => app.status === 2).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                  <p className="text-lg sm:text-2xl font-bold">{applications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Funds Section */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="h-5 w-5" />
                  Available Funds
                </CardTitle>
                <CardDescription className="text-sm">
                  Active scholarship funds available for application
                </CardDescription>
              </div>
              <Button onClick={() => { loadAvailableFunds(); }} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {availableFunds.map((fund, index) => (
                <div key={index} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Fund #{fund.id}</h4>
                    <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{fund.criteria}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">{fund.amount} ETH</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Funds remaining</p>
                      <p className="font-medium">{fund.remaining} ETH</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deadline</p>
                      <p className="font-medium">{new Date(fund.deadline * 1000).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
              {availableFunds.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No active funds available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Applications */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pending Student Applications</CardTitle>
            <CardDescription className="text-sm">
              Review and approve/reject scholarship applications
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {applications.map((app, index) => (
                <div key={index} className="border border-border/50 rounded-lg p-4 sm:p-6 bg-card/50">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="lg:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-semibold truncate">
                            {app.firstName} {app.lastName}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{app.email}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {app.student.slice(0, 10)}...{app.student.slice(-8)}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {getStatusBadge(app.status)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground">Major</p>
                          <p className="font-medium truncate">{app.major}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CGPA</p>
                          <p className="font-medium">{(app.cgpa / 100).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fund ID</p>
                          <p className="font-medium">#{app.fundId}</p>
                        </div>
                        {app.amount !== '0' && (
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-medium">{app.amount} ETH</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {app.status === 0 && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor={`amount-${index}`} className="text-sm font-medium">Approval Amount (ETH)</Label>
                              <Input
                                id={`amount-${index}`}
                                type="number"
                                step="0.01"
                                min="0"
                                max={availableFunds.find(fund => fund.id === app.fundId)?.remaining || undefined}
                                placeholder="1.0"
                                value={approvalAmounts[`${app.student}-${app.index}`] || ''}
                                onChange={(e) => setApprovalAmounts({
                                  ...approvalAmounts,
                                  [`${app.student}-${app.index}`]: e.target.value
                                })}
                                className="w-full"
                              />
                              {availableFunds.find(fund => fund.id === app.fundId) && (
                                <p className="text-xs text-muted-foreground">
                                  Remaining: {availableFunds.find(fund => fund.id === app.fundId)?.remaining} ETH
                                </p>
                              )}
                            </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => approveStudent(
                                app.student, 
                                app.index, 
                                approvalAmounts[`${app.student}-${app.index}`] || '0'
                              )}
                              disabled={loading || !approvalAmounts[`${app.student}-${app.index}`]}
                              className="w-full sm:w-auto"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectStudent(app.student, app.index)}
                              disabled={loading}
                              className="w-full sm:w-auto"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {applications.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    No applications yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Student applications will appear here for review
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}