import React, { useState, useEffect } from 'react';
import { Shield, Plus, DollarSign, School, Users, Trash2, Send, RefreshCw, Download, CheckCircle, Crown, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerTrigger } from '@/components/ui/drawer';
import { useToast } from '@/hooks/use-toast';
import { useContract, useWeb3 } from '@/contexts/Web3Context';
import { ethers } from 'ethers';

interface Fund {
  id: number;
  amount: string;
  criteria: string;
  deadline: number;
  remaining: string;
  active: boolean;
}

interface School {
  name: string;
  address: string;
}

interface VerifiedApplication {
  student: string;
  index: number;
  fundId: number;
  amount: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function AdminPortal() {
  const { toast } = useToast();
  const { getContract } = useContract();
  const { account } = useWeb3();
  
  const [funds, setFunds] = useState<Fund[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [verifiedApps, setVerifiedApps] = useState<VerifiedApplication[]>([]);
  const [contractBalance, setContractBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [currentOwner, setCurrentOwner] = useState<string>('');
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>('');
  const [deactivatingFundId, setDeactivatingFundId] = useState<number | null>(null);

  // Form states
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [fundForm, setFundForm] = useState({
    amount: '',
    criteria: '',
    deadline: ''
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const safeFormatEther = (value: any): string => {
    try {
      return ethers.formatEther(value);
    } catch {
      return '0';
    }
  };

  const loadData = async () => {
    try {
      const contract = getContract();
      
      // Load contract balance
      const balance = await contract.getContractBalance();
      setContractBalance(safeFormatEther(balance));

      // Load current owner
      const owner = await contract.owner();
      setCurrentOwner(owner);

      // Load schools with new structure
      const schoolList = await contract.getSchoolList();
      const activeSchools: School[] = [];
      
      for (const schoolData of schoolList) {
        const isActive = await contract.isSchool(schoolData.schoolAddress);
        if (isActive) {
          activeSchools.push({
            name: schoolData.schoolName,
            address: schoolData.schoolAddress
          });
        }
      }
      setSchools(activeSchools);

      // Load funds
      const count = await contract.fundCount();
      const fundsList: Fund[] = [];
      
      for (let i = 1; i <=count; i++) {
        const fundDetails = await contract.getFundDetails(i);
        fundsList.push({
          id: Number(i),
          amount: safeFormatEther(fundDetails.amount),
          criteria: fundDetails.criteria,
          deadline: Number(fundDetails.deadline),
          remaining: safeFormatEther(fundDetails.remaining), // Will be populated in future if needed
          active: fundDetails.isActive
        });
      }
      setFunds(fundsList);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load contract data",
        variant: "destructive"
      });
    }
  };

  const loadVerifiedApps = async () => {
    try {
      const contract = getContract();
      
      // Query StudentApproved events from genesis block
      const events = await contract.queryFilter(contract.filters.StudentApproved(), 0n);
      
      // Deduplicate by student-appIndex combination
      const seenApps = new Set<string>();
      const uniqueEvents = events.filter(event => {
        // Type guard for EventLog
        if ('args' in event && event.args) {
          // Robust event arg access
          const student = event.args.student ?? event.args[0];
          const appIndex = event.args.appIndex ?? event.args[1];
          const key = `${student?.toLowerCase()}-${appIndex?.toString()}`;
          if (seenApps.has(key)) return false;
          seenApps.add(key);
          return true;
        }
        return false;
      });

      const verifiedList: VerifiedApplication[] = [];
      
      for (const event of uniqueEvents) {
        if ('args' in event && event.args) {
          // Robust event arg access
          const student = event.args.student ?? event.args[0];
          const appIndex = event.args.appIndex ?? event.args[1];
          
          try {
            const app = await contract.getApplication(student, appIndex);
            
            // Only include verified applications (status === 1) - Use numeric indices for robust access
            const status = Number(app.status ?? app[6]);
            if (status === 1) {
              verifiedList.push({
                student,
                index: Number(appIndex),
                fundId: Number(app.fundId ?? app[0]),
                amount: safeFormatEther(app.amountApproved ?? app[7]),
                firstName: app.firstName ?? app[1],
                lastName: app.lastName ?? app[2],
                email: app.email ?? app[3]
              });
            }
          } catch (error) {
            console.error('Error loading application details:', error);
          }
        }
      }
      
      setVerifiedApps(verifiedList);
    } catch (error) {
      console.error('Error loading verified applications:', error);
    }
  };

  useEffect(() => {
    if (account) {
      loadData();
      loadVerifiedApps();
    }
  }, [account]);

  // Event listeners for auto-refresh
  useEffect(() => {
    if (account) {
      try {
        const contract = getContract();
        
        const onFundCreated = (fundId: bigint, amount: bigint, deadline: bigint) => {
          console.log('FundCreated event:', { fundId: fundId.toString(), amount: safeFormatEther(amount), deadline: deadline.toString() });
          loadData();
        };

        const onStudentApproved = (student: string, appIndex: bigint, amount: bigint) => {
          console.log('StudentApproved event:', { student, appIndex: appIndex.toString(), amount: safeFormatEther(amount) });
          loadVerifiedApps();
        };

        const onFundDisbursed = (student: string, amount: bigint) => {
          console.log('FundDisbursed event:', { student, amount: safeFormatEther(amount) });
          loadData();
          loadVerifiedApps();
        };

        const onSchoolAdded = (schoolAddress: string, schoolName: string) => {
          console.log('SchoolAdded event:', { schoolAddress, schoolName });
          loadData();
        };

        const onSchoolRemoved = (schoolAddress: string) => {
          console.log('SchoolRemoved event:', { schoolAddress });
          loadData();
        };

        const onOwnershipTransferred = (previousOwner: string, newOwner: string) => {
          console.log('OwnershipTransferred event:', { previousOwner, newOwner });
          loadData();
        };

        const onFundDeactivated = (fundId: bigint) => {
          console.log('FundDeactivated event:', { fundId: fundId.toString() });
          loadData();
        };
        
        contract.on('FundCreated', onFundCreated);
        contract.on('StudentApproved', onStudentApproved);
        contract.on('FundDisbursed', onFundDisbursed);
        contract.on('SchoolAdded', onSchoolAdded);
        contract.on('SchoolRemoved', onSchoolRemoved);
        contract.on('OwnershipTransferred', onOwnershipTransferred);
        contract.on('FundDeactivated', onFundDeactivated);
        
        return () => {
          contract.off('FundCreated', onFundCreated);
          contract.off('StudentApproved', onStudentApproved);
          contract.off('FundDisbursed', onFundDisbursed);
          contract.off('SchoolAdded', onSchoolAdded);
          contract.off('SchoolRemoved', onSchoolRemoved);
          contract.off('OwnershipTransferred', onOwnershipTransferred);
          contract.off('FundDeactivated', onFundDeactivated);
        };
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
  }, [account]);

  const refreshData = () => {
    loadData();
    loadVerifiedApps();
  };

  const addSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newSchoolAddress) return;

    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.addSchool(newSchoolName, newSchoolAddress);
      await tx.wait();

      toast({
        title: "Success",
        description: "School added successfully",
      });
      
      setNewSchoolName('');
      setNewSchoolAddress('');
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add school",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeSchool = async (schoolAddress: string) => {
    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.removeSchool(schoolAddress);
      await tx.wait();

      toast({
        title: "Success",
        description: "School removed successfully",
      });
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove school",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundForm.amount || !fundForm.criteria || !fundForm.deadline) return;

    try {
      setLoading(true);
      const contract = getContract();
      const deadlineTimestamp = Math.floor(new Date(fundForm.deadline).getTime() / 1000);
      
      // Input validation
      const amountInWei = ethers.parseEther(fundForm.amount);
      if (amountInWei <= 0n) {
        throw new Error("Amount must be greater than 0");
      }
      
      if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
        throw new Error("Deadline must be in the future");
      }
      
      // Simulate transaction first to catch any reverts
      await contract.createFund.staticCall(
        amountInWei,
        fundForm.criteria,
        deadlineTimestamp
      );
      
      // Send actual transaction
      const tx = await contract.createFund(
        amountInWei,
        fundForm.criteria,
        deadlineTimestamp
      );
      
      console.log('createFund tx hash:', tx.hash);
      await tx.wait();

      toast({
        title: "Success",
        description: "Fund created successfully",
      });
      
      setFundForm({ amount: '', criteria: '', deadline: '' });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create fund",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const depositETH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount) return;

    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.deposit({ 
        value: ethers.parseEther(depositAmount) 
      });
      await tx.wait();

      toast({
        title: "Success",
        description: `Deposited ${depositAmount} ETH successfully`,
      });
      
      setDepositAmount('');
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to deposit ETH",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const withdrawAccidentalETH = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount) return;

    try {
      setLoading(true);
      const contract = getContract();
      const amountInWei = ethers.parseEther(withdrawAmount);
      const tx = await contract.withdrawAccidentalETH(amountInWei);
      await tx.wait();

      toast({
        title: "Success",
        description: `Withdrew ${withdrawAmount} ETH successfully`,
      });
      
      setWithdrawAmount('');
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to withdraw ETH",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerDisbursement = async (student: string, index: number) => {
    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.triggerDisbursement(student, index);
      await tx.wait();

      toast({
        title: "Success",
        description: "Disbursement triggered successfully",
      });
      
      loadData();
      loadVerifiedApps();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger disbursement",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerGroupDisbursement = async () => {
    if (selectedStudents.size === 0) return;

    try {
      setLoading(true);
      const contract = getContract();
      
      for (const key of selectedStudents) {
        const [student, index] = key.split('-');
        const tx = await contract.triggerDisbursement(student, parseInt(index));
        await tx.wait();
      }

      toast({
        title: "Success",
        description: `Disbursement triggered for ${selectedStudents.size} students`,
      });
      
      setSelectedStudents(new Set());
      loadData();
      loadVerifiedApps();
    } catch (error: any) {
      toast({
        title: "Error", 
        description: error.message || "Failed to trigger group disbursement",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const transferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerAddress) return;

    try {
      setLoading(true);
      const contract = getContract();
      const tx = await contract.transferOwnership(newOwnerAddress);
      await tx.wait();

      toast({
        title: "Success",
        description: "Ownership transferred successfully",
      });
      
      setNewOwnerAddress('');
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to transfer ownership",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deactivateFund = async (fundId: number) => {
    try {
      setDeactivatingFundId(fundId);
      const contract = getContract();
      
      // Simulate transaction first to catch any reverts
      await contract.deactivateFund.staticCall(fundId);
      
      // Send actual transaction
      const tx = await contract.deactivateFund(fundId);
      console.log('deactivateFund tx hash:', tx.hash);
      await tx.wait();

      toast({
        title: "Success",
        description: `Fund #${fundId} deactivated successfully`,
      });
      
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate fund",
        variant: "destructive"
      });
    } finally {
      setDeactivatingFundId(null);
    }
  };

  const toggleStudentSelection = (student: string, index: number) => {
    const key = `${student}-${index}`;
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedStudents(newSelected);
  };

  const selectAllStudents = () => {
    if (selectedStudents.size === verifiedApps.length) {
      setSelectedStudents(new Set());
    } else {
      const allKeys = verifiedApps.map(app => `${app.student}-${app.index}`);
      setSelectedStudents(new Set(allKeys));
    }
  };

  return (
    <div className="flex-1">
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow shrink-0">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">Admin Portal</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Manage schools, funds, and disbursements</p>
          </div>
          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Contract Balance</p>
                  <p className="text-lg sm:text-2xl font-bold truncate">{contractBalance} ETH</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <School className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Active Schools</p>
                  <p className="text-lg sm:text-2xl font-bold">{schools.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-warning/10 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Funds Created</p>
                  <p className="text-lg sm:text-2xl font-bold">{funds.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-info" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Verified Students</p>
                  <p className="text-lg sm:text-2xl font-bold">{verifiedApps.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verified Students Section */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Verified Students
                </CardTitle>
                <CardDescription>
                  Students approved for funds - select and trigger disbursement
                </CardDescription>
              </div>
              {verifiedApps.length > 0 && (
                <div className="flex gap-2">
                  <Button onClick={selectAllStudents} variant="outline" size="sm">
                    <Checkbox 
                      checked={selectedStudents.size === verifiedApps.length}
                      className="mr-2 h-4 w-4"
                    />
                    Select All
                  </Button>
                  {selectedStudents.size > 0 && (
                    <Button 
                      onClick={triggerGroupDisbursement} 
                      disabled={loading}
                      variant="success"
                      size="sm"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Disburse Selected ({selectedStudents.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verifiedApps.map((app, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <Checkbox 
                    checked={selectedStudents.has(`${app.student}-${app.index}`)}
                    onCheckedChange={() => toggleStudentSelection(app.student, app.index)}
                    className="mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm truncate">{app.firstName} {app.lastName}</h4>
                          <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full shrink-0">Verified</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{app.email}</p>
                        <p className="text-xs address-truncate text-muted-foreground">
                          {app.student.slice(0, 10)}...{app.student.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">Fund #{app.fundId} • {app.amount} ETH</p>
                      <Button
                        onClick={() => triggerDisbursement(app.student, app.index)}
                        disabled={loading}
                        variant="success"
                        size="sm"
                        className="mobile-touch-target shrink-0"
                      >
                        <Send className="mr-1 h-3 w-3" />
                        <span className="hidden sm:inline">Disburse</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {verifiedApps.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No verified students pending disbursement</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Funds Section */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Available Funds
            </CardTitle>
            <CardDescription>
              All created scholarship funds with details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funds.map((fund, index) => {
                const isExpired = fund.deadline < Math.floor(Date.now() / 1000);
                const status = !fund.active ? 'Inactive' : isExpired ? 'Expired' : 'Active';
                const statusVariant = !fund.active ? 'secondary' : isExpired ? 'destructive' : 'default';
                
                return (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Fund #{fund.id}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant}>
                          {status}
                        </Badge>
                        {fund.active && !isExpired && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                disabled={deactivatingFundId === fund.id}
                              >
                                {deactivatingFundId === fund.id ? 'Deactivating...' : 'Deactivate'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Fund #{fund.id}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently deactivate the fund. Students will no longer be able to apply for this fund. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deactivateFund(fund.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Deactivate Fund
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{fund.criteria}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">{fund.amount} ETH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Amount Remaining</p>
                        <p className="font-medium">{fund.remaining} ETH</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Deadline</p>
                        <p className="font-medium">{new Date(fund.deadline * 1000).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {funds.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No funds created yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ownership Transfer Section */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Change Admin
            </CardTitle>
            <CardDescription>
              Transfer contract ownership to another address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Current Owner</p>
                <p className="font-mono text-sm font-medium">
                  {currentOwner ? `${currentOwner.slice(0, 10)}...${currentOwner.slice(-8)}` : 'Loading...'}
                </p>
              </div>
              <form onSubmit={transferOwnership} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newOwner" className="text-sm font-medium">New Owner Address</Label>
                  <Input
                    id="newOwner"
                    type="text"
                    placeholder="0x..."
                    value={newOwnerAddress}
                    onChange={(e) => setNewOwnerAddress(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || !newOwnerAddress} 
                  variant="destructive" 
                  className="w-full sm:w-auto"
                >
                  <Crown className="mr-2 h-4 w-4" />
                  Transfer Ownership
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
          {/* School Management */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="bg-gradient-card shadow-elegant border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <School className="h-5 w-5" />
                  Add School
                </CardTitle>
                <CardDescription className="text-sm">
                  Add a new school to the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={addSchool} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="schoolName" className="text-sm font-medium">School Name</Label>
                    <Input
                      id="schoolName"
                      type="text"
                      placeholder="University of Technology"
                      value={newSchoolName}
                      onChange={(e) => setNewSchoolName(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolAddress" className="text-sm font-medium">School Address</Label>
                    <Input
                      id="schoolAddress"
                      type="text"
                      placeholder="0x..."
                      value={newSchoolAddress}
                      onChange={(e) => setNewSchoolAddress(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" disabled={loading || !newSchoolName || !newSchoolAddress} variant="gradient" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Add School
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Schools List */}
            <Card className="bg-gradient-card shadow-elegant border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Active Schools</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {schools.map((school, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{school.name}</h4>
                        <p className="font-mono text-xs text-muted-foreground">
                          {school.address.slice(0, 10)}...{school.address.slice(-8)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeSchool(school.address)}
                        disabled={loading}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {schools.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">No schools added yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fund & ETH Management */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="bg-gradient-card shadow-elegant border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Plus className="h-5 w-5" />
                  Create Fund
                </CardTitle>
                <CardDescription className="text-sm">
                  Create a new scholarship fund
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={createFund} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount (ETH)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="1.0"
                      value={fundForm.amount}
                      onChange={(e) => setFundForm({...fundForm, amount: e.target.value})}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="criteria" className="text-sm font-medium">Criteria</Label>
                    <Textarea
                      id="criteria"
                      placeholder="Scholarship criteria and requirements..."
                      value={fundForm.criteria}
                      onChange={(e) => setFundForm({...fundForm, criteria: e.target.value})}
                      className="w-full min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline" className="text-sm font-medium">Deadline</Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={fundForm.deadline}
                      onChange={(e) => setFundForm({...fundForm, deadline: e.target.value})}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" disabled={loading} variant="gradient" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Fund
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Deposit ETH */}
            <Card className="bg-gradient-card shadow-elegant border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5" />
                  Deposit ETH
                </CardTitle>
                <CardDescription className="text-sm">
                  Add funds to the contract
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={depositETH} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositAmount" className="text-sm font-medium">Amount (ETH)</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      step="0.01"
                      placeholder="1.0"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" disabled={loading} variant="success" className="w-full sm:w-auto">
                    <Send className="mr-2 h-4 w-4" />
                    Deposit
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Withdraw Accidental ETH */}
            <Card className="bg-gradient-card shadow-elegant border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Download className="h-5 w-5" />
                  Withdraw Accidental ETH
                </CardTitle>
                <CardDescription className="text-sm">
                  Withdraw accidentally deposited funds
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={withdrawAccidentalETH} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawAmount" className="text-sm font-medium">Amount (ETH)</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      step="0.01"
                      placeholder="1.0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button type="submit" disabled={loading} variant="outline" className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Withdraw
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}