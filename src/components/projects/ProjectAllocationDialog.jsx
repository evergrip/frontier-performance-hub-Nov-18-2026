import React from 'react';
import WeeklyGpForecastDialog from '@/components/sales/WeeklyGpForecastDialog';
export default function ProjectAllocationDialog({ open, onOpenChange, project, onSaved }) {
  return open && project ? <WeeklyGpForecastDialog key={project.id} projectId={project.id} onClose={() => onOpenChange(false)} onSaved={onSaved} /> : null;
}