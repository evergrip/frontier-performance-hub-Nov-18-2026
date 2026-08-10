import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REPORT_START = new Date('2025-10-01T00:00:00');

const getProjectDate = (project) => {
  const history = project.status_history || [];
  const constructionEntry = history.find((entry) => entry.status === 'awaiting_to_be_scheduled');
  return new Date(constructionEntry?.entered_date || history[0]?.entered_date || project.start_date || project.created_date);
};

const getSaleDate = (sale) => new Date((sale.phase_history || [])[0]?.entered_date || sale.close_date || sale.created_date);

const csvValue = (value) => `"${String(value).replaceAll('"', '""')}"`;

export default function ProjectTypeExportButton({ projects, sales }) {
  const downloadReport = () => {
    const constructionSales = new Map(sales.filter((sale) => sale.sale_type === 'construction').map((sale) => [sale.id, sale]));
    const linkedPreconIds = new Set(sales.filter((sale) => sale.linked_precon_sale_id).map((sale) => sale.linked_precon_sale_id));

    const constructionRows = projects
      .filter((project) => project.project_type === 'construction' && getProjectDate(project) >= REPORT_START)
      .map((project) => ({
        name: project.title,
        type: constructionSales.get(project.sale_id)?.linked_precon_sale_id ? 'Both' : 'Construction',
      }));

    const preconstructionRows = sales
      .filter((sale) => sale.sale_type === 'preconstruction' && getSaleDate(sale) >= REPORT_START && !linkedPreconIds.has(sale.id))
      .map((sale) => ({ name: sale.title, type: 'Preconstruction' }));

    const rows = [...constructionRows, ...preconstructionRows]
      .sort((a, b) => a.name.localeCompare(b.name));
    const csv = ['Project Name,Type', ...rows.map((row) => `${csvValue(row.name)},${csvValue(row.type)}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'frontier-project-types-oct-2025-to-today.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" onClick={downloadReport}>
      <Download className="w-4 h-4 mr-2" />
      Download Project List
    </Button>
  );
}