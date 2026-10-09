import React from 'react';
import { Input } from '@/components/ui/input';
const areas = ['Clients','Leads','Pre-Construction','Projects','Dashboard','Reports','Commissions','Surveys'];
export default function FindingFilters({ value, onChange }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm';
  return <div className="flex flex-wrap gap-3">
    <Input aria-label="Search findings" placeholder="Search record, rule or finding…" value={value.search} onChange={e => set('search', e.target.value)} className="max-w-sm" />
    <select className={selectClass} aria-label="Area" value={value.area} onChange={e => set('area', e.target.value)}><option value="all">All eight areas</option>{areas.map(a => <option key={a}>{a}</option>)}</select>
    <select className={selectClass} aria-label="Detection state" value={value.detection} onChange={e => set('detection', e.target.value)}><option value="active">Still detected</option><option value="cleared">Cleared on rerun</option><option value="all">All findings</option></select>
    <select className={selectClass} aria-label="Manual review status" value={value.status} onChange={e => set('status', e.target.value)}><option value="all">Any review status</option><option value="manual_review">Manual review</option><option value="investigate">Needs investigation</option><option value="resolved">Human marked resolved</option></select>
  </div>;
}