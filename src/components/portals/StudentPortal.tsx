import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Eye, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface Application {
  fundId: number;
  firstName: string;
  lastName: string;
  email: string;
  cgpa: number;
  major: string;
  status: number;
  amountApproved: string;
}

// Safe utility function for formatting ETH amounts
const safeFormatEther = (value: any): string => {
  if (value === null || value === undefined) return '0';
  try {
    return ethers.formatEther(value);
  } catch {
    return '0';
  }
};

export function StudentPortal() {
  const { toast } = useToast();
  const { getContract } = useContract();
  const { account } = useWeb3();
  
  const [funds, setFunds] = useState<Fund[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedFund, setSelectedFund] = useState<number | null>(null);
  
  const [applicationForm, setApplicationForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    cgpa: '',
    major: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const contract = getContract();
      
      // Load available funds - show both active and expired for completeness
      const count = await contract.fundCount();
      const fundsList: Fund[] = [];
      const currentTime = Math.floor(Date.now() / 1000);
      
      for (let i = 0n; i <=count; i++) {
        const fundDetails = await contract.getFundDetails(i);
        if (fundDetails.isActive) {
          const fund: Fund = {
            id: Number(i),
            amount: ethers.formatEther(fundDetails.amount),
            criteria: fundDetails.criteria,
            deadline: Number(fundDetails.deadline),
            remaining: safeFormatEther(fundDetails.remaining), // Will be populated in future if needed
            active: fundDetails.isActive
          };
          if(Number(fundDetails.deadline) < currentTime || fundDetails.remaining <= 0n) {
              fund.active = false; // Mark as inactive if past deadline or no remaining funds
          }
          fundsList.push(fund);
        }
      }
      fundsList.reverse(); // Show latest funds first
      fundsList.sort((a, b) => {
        if (a.active === b.active) return 0;
        return a.active ? -1 : 1;
      });
      setFunds(fundsList);
      
      // Load user's applications with robust mapping
      if (account) {
        const appCount = await contract.getApplicationsCount(account);
        const userApps: Application[] = [];
        
        // Convert BigInt to number for the loop
        const countNumber = Number(appCount);
        for (let i = 0; i < countNumber; i++) {
          const app = await contract.getApplication(account, i);
          // Use numeric indices for robust access
          userApps.push({
            fundId: Number(app.fundId ?? app[0]),
            firstName: app.firstName ?? app[1],
            lastName: app.lastName ?? app[2],
            email: app.email ?? app[3],
            cgpa: Number(app.cgpa ?? app[4]),
            major: app.major ?? app[5],
            status: Number(app.status ?? app[6]),
            amountApproved: safeFormatEther(app.amountApproved ?? app[7])
          });
        }
        userApps.reverse() // Show latest applications first
        setApplications(userApps);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account) {
      loadData();
    }
  }, [account]);

  // Listen for events to auto-refresh data
  useEffect(() => {
    if (account) {
      try {
        const contract = getContract();
        
        const onFundCreated = (fundId: bigint, amount: bigint, deadline: bigint) => {
          console.log('FundCreated event detected in StudentPortal:', { 
            fundId: fundId.toString(), 
            amount: ethers.formatEther(amount), 
            deadline: deadline.toString() 
          });
          loadData(); // Refresh the funds list
        };

        const onStudentApplied = (student: string, fundId: bigint, appIndex: bigint) => {
          console.log('StudentApplied event detected in StudentPortal:', { 
            student, fundId: fundId.toString(), appIndex: appIndex.toString() 
          });
          if (student.toLowerCase() === account.toLowerCase()) {
            loadData(); // Refresh applications if it's this user
          }
        };

        const onStudentApproved = (student: string, appIndex: bigint, amount: bigint) => {
          console.log('StudentApproved event detected in StudentPortal:', { 
            student, appIndex: appIndex.toString(), amount: safeFormatEther(amount) 
          });
          if (student.toLowerCase() === account.toLowerCase()) {
            loadData(); // Refresh applications if it's this user
          }
        };

        const onStudentRejected = (student: string, appIndex: bigint) => {
          console.log('StudentRejected event detected in StudentPortal:', { 
            student, appIndex: appIndex.toString() 
          });
          if (student.toLowerCase() === account.toLowerCase()) {
            loadData(); // Refresh applications if it's this user
          }
        };

        const onFundDisbursed = (student: string, amount: bigint) => {
          console.log('FundDisbursed event detected in StudentPortal:', { 
            student, amount: safeFormatEther(amount) 
          });
          if (student.toLowerCase() === account.toLowerCase()) {
            loadData(); // Refresh applications if it's this user
          }
        };
        
        contract.on('FundCreated', onFundCreated);
        contract.on('StudentApplied', onStudentApplied);
        contract.on('StudentApproved', onStudentApproved);
        contract.on('StudentRejected', onStudentRejected);
        contract.on('FundDisbursed', onFundDisbursed);
        
        return () => {
          contract.off('FundCreated', onFundCreated);
          contract.off('StudentApplied', onStudentApplied);
          contract.off('StudentApproved', onStudentApproved);
          contract.off('StudentRejected', onStudentRejected);
          contract.off('FundDisbursed', onFundDisbursed);
        };
      } catch (error) {
        console.error('Error setting up event listeners:', error);
      }
    }
  }, [account]);

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFund === null || selectedFund === undefined || !applicationForm.firstName || !applicationForm.lastName || 
        !applicationForm.email || !applicationForm.cgpa || !applicationForm.major) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const contract = getContract();
      
      const tx = await contract.applyForScholarship(
        selectedFund,
        applicationForm.firstName,
        applicationForm.lastName,
        applicationForm.email,
        Math.round(parseFloat(applicationForm.cgpa) * 100), // Convert to integer (e.g., 3.75 -> 375)
        applicationForm.major
      );
      await tx.wait();

      toast({
        title: "Success",
        description: "Application submitted successfully",
      });
      
      setApplicationForm({
        firstName: '',
        lastName: '',
        email: '',
        cgpa: '',
        major: ''
      });
      setShowApplicationForm(false);
      setSelectedFund(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
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

  const formatDeadline = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Student Portal</h1>
              <p className="text-muted-foreground">Apply for scholarships and track your applications</p>
            </div>
          </div>
          
          <Button
            variant="gradient"
            onClick={() => setShowApplicationForm(true)}
            disabled={loading}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Applied</p>
                  <p className="text-2xl font-bold">{applications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">
                    {applications.filter(app => app.status === 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">
                    {applications.filter(app => app.status === 1).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-purple/10 rounded-lg flex items-center justify-center">
                  <Eye className="h-6 w-6 text-accent-purple" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disbursed</p>
                  <p className="text-2xl font-bold">
                    {applications.filter(app => app.status === 3).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Application Form Modal */}
        {showApplicationForm && (
          <Card className="bg-gradient-card shadow-elegant border-0">
            <CardHeader>
              <CardTitle>New Scholarship Application</CardTitle>
              <CardDescription>
                Fill out your information to apply for a scholarship
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitApplication} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fundId">Select Fund</Label>
                    <Select onValueChange={(value) => setSelectedFund(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a scholarship fund" />
                      </SelectTrigger>
                      <SelectContent>
                        {funds
                        .filter((fund) => fund.active)
                        .map((fund) => (
                          <SelectItem key={fund.id} value={fund.id.toString()}>
                            Fund #{fund.id} - {fund.amount} ETH
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      type="text"
                      placeholder="Computer Science"
                      value={applicationForm.major}
                      onChange={(e) => setApplicationForm({...applicationForm, major: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={applicationForm.firstName}
                      onChange={(e) => setApplicationForm({...applicationForm, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={applicationForm.lastName}
                      onChange={(e) => setApplicationForm({...applicationForm, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={applicationForm.email}
                      onChange={(e) => setApplicationForm({...applicationForm, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cgpa">CGPA</Label>
                    <Input
                      id="cgpa"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      placeholder="3.75"
                      value={applicationForm.cgpa}
                      onChange={(e) => setApplicationForm({...applicationForm, cgpa: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading} variant="gradient">
                    <Send className="mr-2 h-4 w-4" />
                    Submit Application
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setShowApplicationForm(false);
                      setSelectedFund(null);
                      setApplicationForm({
                        firstName: '',
                        lastName: '',
                        email: '',
                        cgpa: '',
                        major: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* My Applications */}
        <Card className="bg-gradient-card shadow-elegant border-0">
          <CardHeader>
            <CardTitle>My Applications</CardTitle>
            <CardDescription>
              Track the status of your scholarship applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {applications.map((app, index) => (
                <div key={index} className="border border-border rounded-lg p-6 bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {app.firstName} {app.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">Fund #{app.fundId}</p>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{app.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Major</p>
                      <p className="font-medium">{app.major}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">CGPA</p>
                      <p className="font-medium">{(app.cgpa / 100).toFixed(2)}</p>
                    </div>
                    {app.amountApproved !== '0' && (
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">{app.amountApproved} ETH</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {applications.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    No applications yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Submit your first scholarship application to get started
                  </p>
                  <Button
                    className="mt-4"
                    variant="gradient"
                    onClick={() => setShowApplicationForm(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Apply Now
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Funds */}
        {funds.length > 0 && (
          <Card className="bg-gradient-card shadow-elegant border-0">
            <CardHeader>
              <CardTitle>Available Scholarships</CardTitle>
              <CardDescription>
                Browse available scholarship opportunities
                {funds.length === 0 && (
                  <span className="block text-xs text-warning mt-1">
                    Note: Some funds may be expired and hidden from view
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {funds.map((fund) => (
                  <div key={fund.id} className="border border-border rounded-lg p-6 bg-card">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">Fund #{fund.id}</h3>
                          <p className="text-2xl font-bold text-primary">
                            Total amount
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            {fund.amount} ETH
                          </p>
                        </div>
                        <Badge variant={fund.active ? "default" : "secondary"}>
                          {fund.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fund remaining</p>
                        <p className="text-sm">{fund.remaining}</p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Criteria</p>
                        <p className="text-sm">{fund.criteria}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Deadline</p>
                        <p className="text-sm font-medium">{formatDeadline(fund.deadline)}</p>
                      </div>
                      
                      {fund.active && (
                        <Button 
                          className="w-full"
                          variant="outline"
                          onClick={() => {
                            setSelectedFund(fund.id);
                            setShowApplicationForm(true);
                          }}
                        >
                          Apply Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}