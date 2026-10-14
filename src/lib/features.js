// Feature flags. KPIs are OFF unless CompanySettings.kpis_enabled is explicitly true
// (toggle in Company Settings). Turning them off hides pages/menus only; no code or data is removed.
export const KPI_PAGES = ['MyKPIs', 'KPIDashboard', 'KPIDefinitions', 'KPIAgentChat'];
export const isKpiEnabled = (settings) => settings?.kpis_enabled === true;
