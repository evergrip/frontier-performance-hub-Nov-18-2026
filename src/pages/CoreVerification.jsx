import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AuditRunner from '@/components/verification/AuditRunner';
import FindingWorkspace from '@/components/verification/FindingWorkspace';
import VerificationScope from '@/components/verification/VerificationScope';
export default function CoreVerification() {
  const auth = useQuery({ queryKey: ['verificationUser'], queryFn: () => base44.auth.me() });
  if (auth.isLoading) return <p className="py-12 text-center text-muted-foreground">Checking admin access…</p>;
  if (auth.data?.role !== 'admin') return <p className="py-12 text-center text-destructive">Core verification is available to administrators only.</p>;
  return <div className="max-w-7xl mx-auto space-y-6"><header><p className="text-xs uppercase tracking-widest text-primary font-semibold">Admin · business integrity</p><h1 className="text-3xl font-heading font-bold mt-2">Core Verification</h1><p className="text-muted-foreground mt-2">Trace the rules, inspect the inputs, and flag discrepancies for human review.</p></header><AuditRunner /><VerificationScope /><FindingWorkspace /></div>;
}