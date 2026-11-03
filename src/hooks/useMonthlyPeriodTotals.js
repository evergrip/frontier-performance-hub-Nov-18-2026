import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
export default function useMonthlyPeriodTotals(projects, dateRange, userId) {
  const client = useQueryClient();
  const projectIds = projects.filter(project => project.project_type === 'construction').map(project => project.id).sort();
  const start = dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : null;
  const end = dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : null;
  const query = useQuery({ queryKey: ['dashboardMonthlyAllocations', userId, projectIds, start, end], enabled: !!userId, queryFn: async () => {
    const response = await base44.functions.invoke('jobGpForecast', { action: 'periodTotals', projectIds, start, end });
    if (response.data.error) throw new Error(response.data.error);
    return response.data.projects;
  } });
  useEffect(() => base44.entities.GrossProfitForecast.subscribe(() => client.invalidateQueries({ queryKey: ['dashboardMonthlyAllocations'] })), [client]);
  return query;
}