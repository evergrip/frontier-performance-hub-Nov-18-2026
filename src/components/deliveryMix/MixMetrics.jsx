import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MixMetrics({ items }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    {items.map(([label, value, note, warn]) => <Card key={label} className="min-w-0"><CardHeader className="px-4 pb-2 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="px-4 pb-4"><p className={`break-words text-lg font-semibold tabular-nums ${warn ? 'text-destructive' : ''}`}>{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</CardContent></Card>)}
  </div>;
}