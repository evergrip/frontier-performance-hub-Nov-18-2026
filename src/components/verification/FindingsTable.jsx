import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
export default function FindingsTable({ rows, onOpen }) {
  if (!rows.length) return <div className="border rounded-md p-10 text-center text-muted-foreground">No findings match these filters. Run verification to check saved records.</div>;
  return <Table><TableHeader><TableRow><TableHead>Record / area</TableHead><TableHead>Rule and evidence</TableHead><TableHead>Severity</TableHead><TableHead>Verification outcome</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map(f => <TableRow key={f.id}>
    <TableCell className="align-top"><p className="font-semibold">{f.record_title}</p><p className="text-xs text-muted-foreground">{f.area} · {f.entity_type}</p></TableCell>
    <TableCell className="max-w-lg align-top"><p>{f.summary}</p><p className="text-xs text-muted-foreground mt-1">Rule: {f.rule}</p><div className="mt-2 text-xs"><p><strong>Expected:</strong> {f.expected}</p><p><strong>Observed:</strong> {f.observed}</p></div></TableCell>
    <TableCell className="align-top"><Badge variant={f.severity === 'high' ? 'destructive' : 'outline'}>{f.severity}</Badge><p className="text-xs text-muted-foreground mt-2">{f.confidence === 'invariant' ? 'Rule mismatch' : 'Evidence needs review'}</p></TableCell>
    <TableCell className="align-top"><Badge variant="outline">{f.detected ? 'Still detected' : 'Cleared on rerun'}</Badge><p className="text-xs mt-2">{f.review_status === 'resolved' ? 'Human marked resolved' : f.review_status === 'investigate' ? 'Needs investigation' : 'Manual review'}</p>{f.detected && f.review_status === 'resolved' && <p className="text-xs text-destructive mt-1">Still flagged despite manual resolution.</p>}</TableCell>
    <TableCell className="align-top"><Button variant="outline" size="sm" onClick={() => onOpen(f)}>Inspect / review</Button></TableCell>
  </TableRow>)}</TableBody></Table>;
}