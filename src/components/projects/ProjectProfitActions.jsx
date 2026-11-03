import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import WeeklyGpForecastDialog from '@/components/sales/WeeklyGpForecastDialog';
import ProjectRecognitionDialog from '@/components/projects/ProjectRecognitionDialog';
export default function ProjectProfitActions({ project }) {
  const [editor, setEditor] = useState(null);
  return <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
    {project.recognition_mode !== 'monthly_actual' && <Button type="button" size="sm" variant="outline" onClick={() => setEditor('forecast')}>Edit GP allocations</Button>}
    <Button type="button" size="sm" variant="outline" onClick={() => setEditor('actual')}>{project.inventory_status === 'held' ? 'Costs / sell inventory' : 'Costs, realized GP & inventory'}</Button>
    {editor === 'forecast' && <WeeklyGpForecastDialog projectId={project.id} onClose={() => setEditor(null)} />}
    {editor === 'actual' && <ProjectRecognitionDialog project={project} onClose={() => setEditor(null)} />}
  </div>;
}