import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Target, Briefcase, Building2, TrendingUp, Settings2, CheckCircle2, Activity } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfMonth, endOfMonth, format, eachMonthOfInterval } from 'date-fns';
import { getFiscalYearDates, getCurrentFiscalYear, getFiscalQuarterDates, getCurrentFiscalQuarter, parseLocalDate, endOfLocalDay } from '@/components/utils/fiscalYear';
import { buildPipelineForecast } from '@/lib/pipelineForecast';
import { buildStaffCapacity } from '@/lib/staffCapacity';
import BuildCapacityForecast from '../components/dashboard/BuildCapacityForecast';
import { projectPeriodFinancials, projectClosedDate } from '@/components/utils/projectPeriod';
import CarryoverAllocationReview from '@/components/projects/CarryoverAllocationReview';
import MetricDrilldownDialog from '../components/dashboard/MetricDrilldownDialog';
import DateRangeSelector from '../components/dashboard/DateRangeSelector';
import AnnualProfitForecast from '../components/dashboard/AnnualProfitForecast';
import FiscalGoalProgress from '../components/dashboard/FiscalGoalProgress';
import FiscalProfitProgress from '@/components/dashboard/FiscalProfitProgress';
import RevenueTrendChart from '../components/dashboard/RevenueTrendChart';
import CustomizeMetricsDialog from '../components/dashboard/CustomizeMetricsDialog';

import GettingStartedChecklist from '../components/dashboard/GettingStartedChecklist';

import CEOGrossMarginDialog from '../components/dashboard/CEOGrossMarginDialog';
import ProjectTypeExportButton from '../components/dashboard/ProjectTypeExportButton';
import { calculateProjectFinancials } from '@/lib/projectFinancials';
import { calculateAnnualProfitForecast } from '@/lib/profitForecast';
import useMonthlyPeriodTotals from '@/hooks/useMonthlyPeriodTotals';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  const [selectedDateRangeType, setSelectedDateRangeType] = useState('fiscal_year');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentFiscalQuarter());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [fiscalYear, setFiscalYear] = useState(() => getCurrentFiscalYear());
  const [drilldownMetric, setDrilldownMetric] = useState(null);
  const [ceoGMDialogOpen, setCeoGMDialogOpen] = useState(false);

  const [visibleMetrics, setVisibleMetrics] = useState({
    totalRevenue: true,
    activeProjects: true,
    activeSales: true,
    activeLeads: true,
    cashFlow: true,
    margins: true,
    grossProfit: true,
    conversionRate: true,
    preconRevenue: true,
    constructionRevenue: true,
    winRate: true,
    avgProjectSize: true,
    medianProjectSize: true
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: companySettings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => base44.entities.CompanySettings.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: fiscalGoals = [], dataUpdatedAt: goalsUpdatedAt } = useQuery({
    queryKey: ['fiscalGoals'],
    queryFn: () => base44.entities.FiscalGoal.list(),
    staleTime: 5 * 60 * 1000,
  });



  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('listUsersBasic');
      return response.data?.users || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Staff-capacity inputs (admin-only data, like listUsersBasic)
  const isAdminUser = user?.role === 'admin';
  const { data: subtrades = [] } = useQuery({ queryKey: ['subtrades'], queryFn: () => base44.entities.Subtrade.list(), enabled: isAdminUser, staleTime: 5 * 60 * 1000 });
  const { data: unavailability = [] } = useQuery({ queryKey: ['employee-unavailability'], queryFn: () => base44.entities.EmployeeUnavailability.list(), enabled: isAdminUser, staleTime: 5 * 60 * 1000 });
  const { data: holidays = [] } = useQuery({ queryKey: ['holidays'], queryFn: () => base44.entities.Holiday.list(), enabled: isAdminUser, staleTime: 5 * 60 * 1000 });



  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: projects = [], isLoading: projectsLoading, dataUpdatedAt: projectsUpdatedAt } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: gmReports = [] } = useQuery({
    queryKey: ['gross-margin-reports'],
    queryFn: () => base44.entities.GrossMarginReport.list('-reporting_date'),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = settingsLoading || leadsLoading || salesLoading || projectsLoading;



  const settings = companySettings[0] || {};
  const fiscalYearStartMonth = settings.fiscal_year_start_month || 10;
  useEffect(() => { setFiscalYear(getCurrentFiscalYear(fiscalYearStartMonth)); }, [fiscalYearStartMonth]);

  const dateRange = useMemo(() => {
    if (selectedDateRangeType === 'month') {
      return {
        start: startOfMonth(new Date(selectedYear, selectedMonth - 1, 1)),
        end: endOfMonth(new Date(selectedYear, selectedMonth - 1, 1))
      };
    } else if (selectedDateRangeType === 'quarter') {
      // Fiscal quarters: Q1 = first three months of the selected fiscal year (Oct–Dec for an October start).
      const { startDate, endDate } = getFiscalQuarterDates(fiscalYear, selectedQuarter || 1, fiscalYearStartMonth);
      return { start: startDate, end: endDate };
    } else if (selectedDateRangeType === 'fiscal_year') {
      const { startDate, endDate } = getFiscalYearDates(fiscalYear, fiscalYearStartMonth);
      return { start: startDate, end: endDate };
    } else if (selectedDateRangeType === 'custom') {
      return {
        start: parseLocalDate(customStartDate),
        end: endOfLocalDay(customEndDate)
      };
    }
    return { start: null, end: null };
  }, [selectedDateRangeType, selectedMonth, selectedYear, selectedQuarter, fiscalYear, fiscalYearStartMonth, customStartDate, customEndDate]);

  // Helper: get effective date for a sale using phase_history dates
  const getSaleEffectiveDate = (sale) => {
    const history = sale.phase_history || [];
    if (sale.status === 'closed_won') {
      const closed = [...history].reverse().find(h => h.status === 'closed_won');
      return new Date(closed?.entered_date || sale.close_date || sale.created_date);
    }
    if (history.length > 0) return new Date(history[0].entered_date);
    if (sale.close_date) return new Date(sale.close_date);
    return new Date(sale.created_date);
  };

  // Helper: get effective date for a project using status_history dates
  const getProjectEffectiveDate = (project) => {
    if (project.status === 'closed') return projectClosedDate(project);
    const history = project.status_history || [];
    const constructionEntry = history.find(h => h.status === 'awaiting_to_be_scheduled');
    if (constructionEntry) return new Date(constructionEntry.entered_date);
    if (history.length > 0) return new Date(history[0].entered_date);
    if (project.start_date) return new Date(project.start_date);
    return new Date(project.created_date);
  };

  // For non-admin users, scope data to their own records
  const isAdmin = user?.role === 'admin';

  const isUserSale = (sale) => {
    if (!user) return false;
    if (sale.assigned_to === user.id) return true;
    if ((sale.sale_contributors || []).some(c => c.user_id === user.id)) return true;
    return false;
  };

  const isUserProject = (project) => {
    if (!user) return false;
    if (project.project_manager_id === user.id) return true;
    // Check if user was on the originating sale
    const originatingSale = sales.find(s => s.id === project.sale_id);
    if (originatingSale && isUserSale(originatingSale)) return true;
    return false;
  };

  const isUserLead = (lead) => {
    if (!user) return false;
    return lead.assigned_to === user.id;
  };

  const scopedSales = useMemo(() => isAdmin ? sales : sales.filter(isUserSale), [sales, user, isAdmin]);
  const scopedProjects = useMemo(() => isAdmin ? projects : projects.filter(isUserProject), [projects, sales, user, isAdmin]);
  const scopedLeads = useMemo(() => isAdmin ? leads : leads.filter(isUserLead), [leads, user, isAdmin]);
  const monthlyTotalsQuery = useMonthlyPeriodTotals(scopedProjects, dateRange, user?.id);
  const monthlyTotals = monthlyTotalsQuery.data || {};

  // Memoized filtered data (date range applied on top of scoped data)
  const filteredSales = useMemo(() => scopedSales.filter(sale => {
    if (!dateRange.start || !dateRange.end) return true;
    const effectiveDate = getSaleEffectiveDate(sale);
    return effectiveDate >= dateRange.start && effectiveDate <= dateRange.end;
  }), [scopedSales, dateRange]);

  const filteredProjects = useMemo(() => scopedProjects.filter(project => {
    if (!dateRange.start || !dateRange.end) return true;
    if (project.project_type === 'construction') return projectPeriodFinancials(project, dateRange, true, fiscalYearStartMonth).percentage > 0;
    const effectiveDate = getProjectEffectiveDate(project);
    return effectiveDate >= dateRange.start && effectiveDate <= dateRange.end;
  }), [scopedProjects, dateRange, fiscalYearStartMonth]);

  const filteredLeads = useMemo(() => scopedLeads.filter(lead => {
    if (!dateRange.start || !dateRange.end) return true;
    const leadDate = new Date(lead.created_date);
    return leadDate >= dateRange.start && leadDate <= dateRange.end;
  }), [scopedLeads, dateRange]);

  // Memoized metrics calculations
  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const closedSales = filteredSales.filter(s => s.status === 'closed_won');
    const closedProjects = filteredProjects.filter(p => p.status === 'closed');
    
    const preconRevenue = closedSales.filter(s => s.sale_type === 'preconstruction').reduce((sum, s) => sum + (s.contract_value || 0), 0);
    
    const constructionFinancials = scopedProjects.filter(p => p.project_type === 'construction').map(p => ({ project: p, ...projectPeriodFinancials(p, dateRange, false, fiscalYearStartMonth, monthlyTotals[p.id]) }));
    const activeRecognizedRevenue = constructionFinancials.filter(f => f.project.status !== 'closed').reduce((sum, f) => sum + f.revenue, 0);
    const constructionRevenue = constructionFinancials.reduce((sum, f) => sum + f.revenue, 0);
    const totalRevenue = preconRevenue + constructionRevenue;
    
    const activeProjectsCount = scopedProjects.filter(p => !['closed', 'completion'].includes(p.status) && !['held', 'sold'].includes(p.inventory_status)).length;
    const activeSalesCount = scopedSales.filter(s => ['feasibility', 'design_material_selections', 'engineering_permits', 'pending_construction_sale'].includes(s.status)).length;
    const activeLeadsCount = scopedLeads.filter(l => !['converted', 'disqualified'].includes(l.status)).length;
    
    const totalProjectRevenue = constructionRevenue;
    const totalGrossProfit = constructionFinancials.reduce((sum, f) => sum + f.grossProfit, 0);
    const marginPercent = totalProjectRevenue > 0 ? totalGrossProfit / totalProjectRevenue * 100 : 0;

    const closedConstructionProjects = closedProjects.filter(p => p.project_type === 'construction');
    const avgProjectSize = closedConstructionProjects.length > 0
      ? closedConstructionProjects.reduce((sum, p) => sum + (p.contract_value || 0), 0) / closedConstructionProjects.length
      : 0;

    const medianProjectSize = (() => {
      const vals = closedConstructionProjects.map(p => p.contract_value || 0).sort((a, b) => a - b);
      if (vals.length === 0) return 0;
      const mid = Math.floor(vals.length / 2);
      return vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    })();

    const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length;
    const totalLeadsForConversion = filteredLeads.filter(l => ['converted', 'disqualified'].includes(l.status)).length;
    const conversionRate = totalLeadsForConversion > 0 ? (convertedLeads / totalLeadsForConversion) * 100 : 0;

    const proposalLeads = filteredLeads.filter(l => {
      const statusHistory = l.status_history || [];
      return statusHistory.some(h => h.status === 'preconstruction_proposal');
    });
    const convertedAfterProposal = proposalLeads.filter(l => l.status === 'converted').length;
    const winRate = proposalLeads.length > 0 ? (convertedAfterProposal / proposalLeads.length) * 100 : 0;

    return {
      closedSales, closedProjects, preconRevenue, constructionRevenue, totalRevenue,
      activeProjectsCount, activeSalesCount, activeLeadsCount,
      totalGrossProfit, marginPercent,
      convertedLeads, totalLeadsForConversion, conversionRate,
      proposalLeads, convertedAfterProposal, winRate,
      activeRecognizedRevenue,
      avgProjectSize, medianProjectSize, closedConstructionProjects
    };
  }, [filteredSales, filteredProjects, filteredLeads, scopedProjects, scopedSales, scopedLeads, dateRange, monthlyTotals]);

  const currentFiscalGoal = useMemo(() => fiscalGoals.find(g => Number(g.fiscal_year) === Number(fiscalYear)), [fiscalGoals, fiscalYear]);
  // Full fiscal-year range (Oct 1 – Sep 30 by default) used by the annual forecast, goal progress and capacity
  // forecast regardless of the month/quarter/custom range selected above.
  const fyRange = useMemo(() => {
    const { startDate, endDate } = getFiscalYearDates(fiscalYear, fiscalYearStartMonth);
    return { start: startDate, end: endDate };
  }, [fiscalYear, fiscalYearStartMonth]);
  const annualProfitForecast = useMemo(() => calculateAnnualProfitForecast({
    projects: scopedProjects,
    sales: scopedSales,
    allSales: sales,
    dateRange: fyRange,
    settings,
  }), [scopedProjects, scopedSales, sales, fyRange, settings]);

  // FY goal progress: always the full fiscal year, construction projects only for project count / margin.
  const fyGoalMetrics = useMemo(() => {
    const preconRevenue = scopedSales.filter(s => s.sale_type === 'preconstruction' && s.status === 'closed_won').filter(s => {
      const d = getSaleEffectiveDate(s);
      return d >= fyRange.start && d <= fyRange.end;
    }).reduce((sum, s) => sum + (Number(s.contract_value) || 0), 0);
    const constructionRevenue = scopedProjects.filter(p => p.project_type === 'construction')
      .reduce((sum, p) => sum + projectPeriodFinancials(p, fyRange, false, fiscalYearStartMonth).revenue, 0);
    const closedConstructionCount = scopedProjects.filter(p => p.project_type === 'construction' && p.status === 'closed' && projectClosedDate(p) >= fyRange.start && projectClosedDate(p) <= fyRange.end).length;
    return {
      totalRevenue: preconRevenue + constructionRevenue,
      marginPercent: constructionRevenue > 0 ? annualProfitForecast.realizedGP / constructionRevenue * 100 : 0,
      closedConstructionCount,
    };
  }, [scopedSales, scopedProjects, fyRange, fiscalYearStartMonth, annualProfitForecast]);

  // Build capacity forecast (shared pipeline forecast; construction projects only)
  const pipelineFY = useMemo(() => buildPipelineForecast({ projects: scopedProjects, sales: scopedSales, allSales: sales, range: fyRange, settings }), [scopedProjects, scopedSales, sales, fyRange, settings]);
  const staffCapacity = useMemo(() => buildStaffCapacity({ forecast: pipelineFY, range: fyRange, settings, users: allUsers, projects, subtrades, unavailability, holidays }),
    [pipelineFY, fyRange, settings, allUsers, projects, subtrades, unavailability, holidays]);

  const capacityForecast = useMemo(() => {
    const now = new Date();
    const forecast = pipelineFY;
    // Monthly $ capacity: staff-based (avg of remaining FY months) when staff are known; else manual schedule / revenue target.
    const remainingMonths = staffCapacity.months.filter(m => m.month >= new Date(now.getFullYear(), now.getMonth(), 1));
    const staffKnown = staffCapacity.staff.pmCount > 0 || staffCapacity.staff.crewCount > 0;
    const staffMonthlyCapacity = staffKnown && remainingMonths.length ? remainingMonths.reduce((s, m) => s + m.dollarCapacity, 0) / remainingMonths.length : null;
    if (!staffMonthlyCapacity && !currentFiscalGoal?.revenue_target && !(settings.monthly_capacity_schedule || []).length) return null;

    // Whole months left in the FY, counting the current month.
    const monthsLeftInYear = Math.max(0, (fyRange.end.getFullYear() - now.getFullYear()) * 12 + (fyRange.end.getMonth() - now.getMonth()) + 1);
    const capacitySchedule = (settings.monthly_capacity_schedule || [])
      .filter(e => e.effective_year && e.effective_month && e.monthly_capacity)
      .sort((a, b) => a.effective_year !== b.effective_year ? a.effective_year - b.effective_year : a.effective_month - b.effective_month);
    const getCapacityForMonth = (year, month) => {
      let capacity = null;
      for (const entry of capacitySchedule) {
        if (entry.effective_year < year || (entry.effective_year === year && entry.effective_month <= month)) capacity = entry.monthly_capacity;
      }
      return capacity;
    };
    const currentCapacity = getCapacityForMonth(now.getFullYear(), now.getMonth() + 1);
    const currentYearMonthlyCapacity = staffMonthlyCapacity || currentCapacity || ((currentFiscalGoal?.revenue_target || 0) / 12);
    const nextFYStart = getFiscalYearDates(Number(fiscalYear) + 1, fiscalYearStartMonth).startDate;
    const nextYearCapacity = getCapacityForMonth(nextFYStart.getFullYear(), nextFYStart.getMonth() + 1);
    const nextYearMonthlyCapacity = staffMonthlyCapacity || nextYearCapacity || (settings.next_year_revenue_target ? settings.next_year_revenue_target / 12 : currentYearMonthlyCapacity);

    const split = (rows, key) => rows.reduce((acc, r) => { const t = r.buildType === 'subcontractor' ? 'sub' : r.buildType === 'in_house' ? 'inHouse' : 'mixed'; acc[t] += r[key] || 0; return acc; }, { inHouse: 0, sub: 0, mixed: 0 });
    const activeRows = [...forecast.activeProjects, ...forecast.signedNoProject.map(r => ({ ...r, remainingValue: r.fyValue + r.beyondValue }))];
    const active = split(activeRows, 'remainingValue');
    const preconRows = forecast.precon.map(r => ({ ...r, total: r.fyValue + r.beyondValue }));
    const precon = split(preconRows, 'total');
    const activeProjectsValue = active.inHouse + active.sub + active.mixed;
    const preconPipelineValue = precon.inHouse + precon.sub + precon.mixed;

    const backlogMonths = (load) => {
      const capYR = currentYearMonthlyCapacity * monthsLeftInYear;
      if (load > capYR) return monthsLeftInYear + (nextYearMonthlyCapacity > 0 ? (load - capYR) / nextYearMonthlyCapacity : 0);
      return currentYearMonthlyCapacity > 0 ? load / currentYearMonthlyCapacity : 0;
    };
    const activeInHouseLoad = active.inHouse + active.mixed * 0.5;
    const preconInHouseLoad = precon.inHouse + precon.mixed * 0.5;
    const t = forecast.totals;
    return {
      monthlyCapacity: currentYearMonthlyCapacity, nextYearMonthlyCapacity, monthsLeftInYear,
      activeProjectsValue, preconPipelineValue, preconPipelineValueRaw: t.preconRaw, totalPipeline: activeProjectsValue + preconPipelineValue,
      thisFY: { active: t.activeFY + t.signedFY, precon: t.preconFY, total: t.activeFY + t.signedFY + t.preconFY },
      beyondFY: { active: t.activeBeyond + t.signedBeyond, precon: t.preconBeyond, total: t.activeBeyond + t.signedBeyond + t.preconBeyond },
      signedNoProjectValue: t.signedFY + t.signedBeyond, signedNoProjectCount: forecast.signedNoProject.length,
      monthsOfBacklog: backlogMonths(activeInHouseLoad + preconInHouseLoad),
      bookedBacklog: backlogMonths(activeInHouseLoad),
      preconConversionRate: forecast.conversion.rate ?? 0, convertedToConstruction: forecast.conversion.converted, totalClosedPrecon: forecast.conversion.decided,
      conversionHasHistory: forecast.conversion.hasHistory, stageProbabilities: forecast.probabilities,
      inHouseLoad: activeInHouseLoad + preconInHouseLoad,
      usingGrowthForecast: !!settings.next_year_revenue_target || !!nextYearCapacity,
      hasManualCapacity: !staffMonthlyCapacity && !!currentCapacity,
      capacitySource: staffMonthlyCapacity ? 'staff' : currentCapacity ? 'manual' : 'target',
      activeInHouse: active.inHouse, activeSub: active.sub, activeMixed: active.mixed,
      preconInHouse: precon.inHouse, preconSub: precon.sub, preconMixed: precon.mixed,
      excludedProjectsCount: forecast.excludedProjectsCount, excludedSalesCount: forecast.excludedSalesCount,
    };
  }, [currentFiscalGoal, pipelineFY, staffCapacity, settings, fiscalYear, fiscalYearStartMonth, fyRange]);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    return eachMonthOfInterval({ start: dateRange.start, end: dateRange.end }).map(month => {
      const mStart = startOfMonth(month);
      const mEnd = endOfMonth(month);
      const monthNum = month.getMonth() + 1;
      const yearNum = month.getFullYear();
      
      const monthPrecon = scopedSales.filter(s => {
        if (s.sale_type !== 'preconstruction' || s.status !== 'closed_won') return false;
        const d = getSaleEffectiveDate(s);
        return d >= mStart && d <= mEnd;
      }).reduce((sum, s) => sum + (s.contract_value || 0), 0);
      
      const monthConstruction = scopedProjects.filter(p => p.project_type === 'construction').reduce((sum, p) => sum + projectPeriodFinancials(p, { start: mStart, end: mEnd }, false, fiscalYearStartMonth).revenue, 0);
      return { month: format(month, 'MMM yy'), revenue: (monthPrecon + monthConstruction) / 1000 };
    });
  }, [dateRange, scopedSales, scopedProjects]);

  // Loading skeleton
  if (isLoading || monthlyTotalsQuery.isPending) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-lg text-slate-500">Loading dashboard data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (monthlyTotalsQuery.error) return <div role="alert" className="space-y-3"><p className="text-destructive">Could not load monthly financial allocations: {monthlyTotalsQuery.error.message}</p><Button variant="outline" onClick={() => monthlyTotalsQuery.refetch()}>Reload financials</Button></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-lg text-slate-500">Real-time snapshot of revenue, pipeline, and project performance</p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectTypeExportButton projects={scopedProjects} sales={scopedSales} dateRange={dateRange} />
          <Button onClick={() => setCustomizeDialogOpen(true)} variant="outline">
            <Settings2 className="w-4 h-4 mr-2" />
            Customize
          </Button>
        </div>
      </div>



      {/* Getting Started Checklist - for new companies */}
      <GettingStartedChecklist
        clientCount={clients.length}
        leadCount={leads.length}
        saleCount={sales.length}
        projectCount={projects.length}
        hasCompanySettings={!!(settings.company_name)}
        userCount={allUsers.length}
        isAdmin={user?.role === 'admin'}
      />



      {/* Date Range Selector */}
      <DateRangeSelector
        selectedDateRangeType={selectedDateRangeType} setSelectedDateRangeType={setSelectedDateRangeType}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedQuarter={selectedQuarter} setSelectedQuarter={setSelectedQuarter}
        customStartDate={customStartDate} setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate} setCustomEndDate={setCustomEndDate}
        fiscalYear={fiscalYear} setFiscalYear={setFiscalYear}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />

      <CarryoverAllocationReview projects={scopedProjects} dateRange={dateRange} companySettings={settings} />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleMetrics.totalRevenue && (
          <StatCard title="Recognized Revenue" value={`$${(metrics.totalRevenue / 1000).toFixed(0)}K`} icon={DollarSign}
            subtitle={`${metrics.closedSales.length} closed sales`} onClick={() => setDrilldownMetric('totalRevenue')} />
        )}
        {visibleMetrics.preconRevenue && (
          <StatCard title="Pre-Construction Revenue" value={`$${(metrics.preconRevenue / 1000).toFixed(0)}K`} icon={Briefcase}
            subtitle={`${metrics.closedSales.filter(s => s.sale_type === 'preconstruction').length} closed precon sales`} onClick={() => setDrilldownMetric('preconRevenue')} />
        )}
        {visibleMetrics.constructionRevenue && (
          <StatCard title="Construction Revenue" value={`$${(metrics.constructionRevenue / 1000).toFixed(0)}K`} icon={Building2}
            subtitle={`${metrics.closedProjects.filter(p => p.project_type === 'construction').length} closed + $${(metrics.activeRecognizedRevenue / 1000).toFixed(0)}K recognized from active`}
            onClick={() => setDrilldownMetric('constructionRevenue')} />
        )}
        {visibleMetrics.activeProjects && (
          <StatCard title="Active Projects" value={metrics.activeProjectsCount} icon={Activity}
            subtitle={`${scopedProjects.length} total projects`} onClick={() => setDrilldownMetric('activeProjects')} />
        )}
        {visibleMetrics.activeSales && (
          <StatCard title="Active Pre-Con Sales" value={metrics.activeSalesCount} icon={Briefcase}
            subtitle="In pipeline" onClick={() => setDrilldownMetric('activeSales')} />
        )}
        {visibleMetrics.activeLeads && (
          <StatCard title="Active Leads" value={metrics.activeLeadsCount} icon={Target}
            subtitle={`${scopedLeads.length} total leads`} onClick={() => setDrilldownMetric('activeLeads')} />
        )}
        {visibleMetrics.grossProfit && (
          <StatCard title="Total Gross Profit" value={`$${(metrics.totalGrossProfit / 1000).toFixed(0)}K`} icon={DollarSign}
            subtitle="Allocated to selected period" onClick={() => setDrilldownMetric('grossProfit')} />
        )}
        {visibleMetrics.margins && (
          <StatCard title="Gross Margin %" value={`${metrics.marginPercent.toFixed(1)}%`} icon={TrendingUp}
            subtitle="Weighted average" trend={metrics.marginPercent > 20 ? 'Healthy' : 'Below target'}
            trendDirection={metrics.marginPercent > 20 ? 'up' : 'down'} onClick={() => setDrilldownMetric('margins')} />
        )}
        {isAdmin && (() => {
          const activeConstruction = projects.filter(p => {
            if (p.status === 'closed' || p.project_type !== 'construction') return false;
            return (p.monthly_revenue_allocations || []).some(allocation => {
              const [periodYear, periodMonth] = (allocation.period || '').split('-').map(Number);
              const year = Number(allocation.year) || periodYear;
              const month = Number(allocation.month) || periodMonth;
              if (!year || !month) return false;
              const allocationDate = new Date(year, month - 1, 1);
              return allocationDate >= dateRange.start && allocationDate <= dateRange.end && Number(allocation.percentage) > 0;
            });
          });
          const withProjections = activeConstruction.filter(p => {
            const latestReport = gmReports.find(r => r.project_id === p.id);
            return latestReport?.projected_gross_margin_at_completion != null;
          });
          const atRisk = withProjections.filter(p => {
            const sale = sales.find(s => s.id === p.sale_id);
            const latestReport = gmReports.find(r => r.project_id === p.id);
            if (!sale?.estimated_margin || !latestReport?.projected_gross_margin_at_completion) return false;
            return latestReport.projected_gross_margin_at_completion < sale.estimated_margin - 3;
          });
          const avgGM = withProjections.length > 0
            ? withProjections.reduce((sum, p) => {
                const r = gmReports.find(r => r.project_id === p.id);
                return sum + (r?.projected_gross_margin_at_completion || 0);
              }, 0) / withProjections.length
            : 0;
          return (
            <StatCard
              title="Projected GM at Completion"
              value={withProjections.length > 0 ? `${avgGM.toFixed(1)}%` : '—'}
              icon={TrendingUp}
              subtitle={`${withProjections.length} reported · ${atRisk.length} at risk`}
              trend={atRisk.length > 0 ? `${atRisk.length} at risk` : 'On track'}
              trendDirection={atRisk.length > 0 ? 'down' : 'up'}
              onClick={() => setCeoGMDialogOpen(true)}
            />
          );
        })()}
        {visibleMetrics.conversionRate && (
          <StatCard title="Lead Conversion Rate" value={`${metrics.conversionRate.toFixed(1)}%`} icon={Target}
            subtitle={`${metrics.convertedLeads}/${metrics.totalLeadsForConversion} converted`} onClick={() => setDrilldownMetric('conversionRate')} />
        )}
        {visibleMetrics.winRate && (
          <StatCard title="Win Rate (After Proposal)" value={`${metrics.winRate.toFixed(1)}%`} icon={CheckCircle2}
            subtitle={`${metrics.convertedAfterProposal}/${metrics.proposalLeads.length} won`} onClick={() => setDrilldownMetric('winRate')} />
        )}
        {visibleMetrics.avgProjectSize && (
          <StatCard title="Avg Project Size" value={`$${(metrics.avgProjectSize / 1000).toFixed(0)}K`} icon={Building2}
            subtitle={`${metrics.closedConstructionProjects.length} closed construction projects`} onClick={() => setDrilldownMetric('avgProjectSize')} />
        )}
        {visibleMetrics.medianProjectSize && (
          <StatCard title="Median Project Size" value={`$${(metrics.medianProjectSize / 1000).toFixed(0)}K`} icon={Building2}
            subtitle={`${metrics.closedConstructionProjects.length} closed construction projects`} onClick={() => setDrilldownMetric('avgProjectSize')} />
        )}
      </div>

      <FiscalProfitProgress fiscalYear={fiscalYear} userId={user?.id} projectsUpdatedAt={projectsUpdatedAt} goalsUpdatedAt={goalsUpdatedAt} />

      <AnnualProfitForecast
        forecast={annualProfitForecast}
        target={currentFiscalGoal?.gross_profit_target}
        fiscalYear={fiscalYear}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />

      {isAdminUser && (
        <BuildCapacityForecast
          capacityForecast={capacityForecast}
          staffCapacity={staffCapacity}
          currentFiscalGoal={currentFiscalGoal}
          fiscalYear={fiscalYear}
          fiscalYearStartMonth={fiscalYearStartMonth}
          settings={settings}
          projects={scopedProjects}
          preconSales={scopedSales.filter(s => s.sale_type === 'preconstruction' && !['closed_won', 'closed_lost'].includes(s.status))}
          clients={clients}
          sales={scopedSales}
        />
      )}

      {/* Fiscal Goal Progress */}
      <FiscalGoalProgress
        currentFiscalGoal={currentFiscalGoal}
        totalRevenue={fyGoalMetrics.totalRevenue}
        marginPercent={fyGoalMetrics.marginPercent}
        actualGrossProfit={annualProfitForecast.realizedGP}
        filteredProjectsCount={fyGoalMetrics.closedConstructionCount}
        fiscalYear={fiscalYear}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />

      {/* Revenue Trend Chart */}
      <RevenueTrendChart monthlyTrendData={monthlyTrendData} />

      {/* Metric Drilldown Dialog */}
      <MetricDrilldownDialog
        open={!!drilldownMetric}
        onOpenChange={(open) => !open && setDrilldownMetric(null)}
        metricKey={drilldownMetric}
        sales={scopedSales}
        projects={scopedProjects}
        leads={scopedLeads}
        clients={clients}
        dateRange={dateRange}
        monthlyTotals={monthlyTotals}
        getSaleEffectiveDate={getSaleEffectiveDate}
        getProjectEffectiveDate={getProjectEffectiveDate}
      />

      {/* CEO Gross Margin Dialog */}
      <CEOGrossMarginDialog
        open={ceoGMDialogOpen}
        onOpenChange={setCeoGMDialogOpen}
        projects={projects}
        sales={sales}
        gmReports={gmReports}
        dateRange={dateRange}
      />

      {/* Customize Dialog */}
      <CustomizeMetricsDialog
        open={customizeDialogOpen}
        onOpenChange={setCustomizeDialogOpen}
        visibleMetrics={visibleMetrics}
        setVisibleMetrics={setVisibleMetrics}
      />
    </div>
  );
}