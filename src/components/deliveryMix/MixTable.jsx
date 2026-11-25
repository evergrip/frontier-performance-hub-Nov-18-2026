import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MixTable({ headers, rows, empty = 'Nothing to show yet.', label }) {
  return <div className="min-w-0 overflow-x-auto rounded-md border bg-card"><Table className="whitespace-nowrap" aria-label={label}>
    <TableHeader><TableRow>{headers.map((title, i) => <TableHead key={i} scope="col">{title}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{rows.length ? rows.map(({ id, cells, className }) => <TableRow key={id} className={className}>{cells.map((cell, index) => <TableCell key={index} className="align-top">{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="py-8 text-center text-muted-foreground">{empty}</TableCell></TableRow>}</TableBody>
  </Table></div>;
}