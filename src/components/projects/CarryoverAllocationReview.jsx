import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { carryoverIssue, projectPeriodFinancials } from '@/components/utils/projectPeriod';
import ProjectAllocationDialog from '@/components/projects/ProjectAllocationDialog';

export default function CarryoverAllocationReview({ projects, dateRange, companySettings }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = projects.find(p => p.id === selectedId);
  const issues = projects.map(project => ({ project, issue: carryoverIssue(project, dateRange) })).filter(row => row.issue);
  if (!issues.length && !selected) return null;
  return <>
    <Card className="border-primary/40">
      <CardHeader><CardTitle>Carryover allocations need review ({issues.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Historical months stay in their original year. Only this period’s scheduled share contributes to its forecast; unscheduled work is not assumed. Invalid, duplicate, or over-100% schedules are excluded until corrected.</p>
        {issues.map(({ project, issue }) => <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div><p className="font-medium">{project.title}</p><p className="text-sm text-destructive">{issue}</p><p className="text-xs text-muted-foreground">Selected period: {projectPeriodFinancials(project, dateRange, true).percentage.toFixed(1)}% of contract</p></div>
          <Button variant="outline" onClick={() => setSelectedId(project.id)}>Review allocations</Button>
        </div>)}
      </CardContent>
    </Card>
    <ProjectAllocationDialog open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }} project={selected} companySettings={companySettings} />
  </>;
}