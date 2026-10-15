import React from 'react';
import GpForecastTable from '@/components/projects/GpForecastTable';
export default function ConstructionForecast({ assignedUserId }) {
  return <GpForecastTable assignedUserId={assignedUserId} />;
}