import React from 'react';
import WeeklyGpForecastDialog from '@/components/sales/WeeklyGpForecastDialog';
export default function PreconAllocationDialog({ open, onOpenChange, sale, onSaved }) {
  return open && sale ? <WeeklyGpForecastDialog key={sale.id} saleId={sale.id} onClose={() => onOpenChange(false)} onSaved={onSaved} /> : null;
}