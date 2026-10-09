import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
const routes = { Client: '/Clients', Lead: '/Leads', Sale: '/Sales', Project: '/Projects', CommissionTransaction: '/CommissionAudit', CommissionBank: '/CommissionsAdmin', CommissionRule: '/CommissionRules', Survey: '/Surveys', CompanySettings: '/CompanySettings', FiscalGoal: '/CompanySettings' };
export default function SourceRecord({ finding }) {
  const result = useQuery({ queryKey: ['verificationSource', finding.entity_type, finding.entity_id], queryFn: () => base44.entities[finding.entity_type].get(finding.entity_id), retry: false });
  const path = finding.entity_type === 'SurveyResponse' && result.data?.survey_id ? `/SurveyResults?id=${result.data.survey_id}` : routes[finding.entity_type];
  return <details className="border rounded-md p-3"><summary className="font-semibold cursor-pointer text-sm">Linked source record: {finding.entity_type} / {finding.entity_id}</summary>
    {path && <Link className="text-sm text-primary underline block my-2" to={path}>Open source area</Link>}
    {result.isLoading ? <p className="text-sm py-2">Loading source record…</p> : result.error ? <p className="text-sm text-destructive py-2">Source unavailable: {result.error.message}</p> : <pre className="text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto mt-3">{JSON.stringify(result.data, null, 2)}</pre>}
  </details>;
}