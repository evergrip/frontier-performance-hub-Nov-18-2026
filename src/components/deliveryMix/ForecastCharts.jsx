import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cad, hrs } from '@/lib/deliveryMix';

export default function ForecastCharts({ rows, boundary }) {
  return <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
    <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Estimate-based GP by month</CardTitle></CardHeader>
      <CardContent className="h-72 pl-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} stackOffset="sign"><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" minTickGap={22} tick={{ fontSize: 11 }} /><YAxis width={72} tickFormatter={cad} tick={{ fontSize: 11 }} /><Tooltip formatter={cad} /><Legend /><Bar dataKey="baseline" name="Baseline GP" stackId="gp" fill="hsl(var(--chart-2))" /><Bar dataKey="added" name="Added GP" stackId="gp" fill="hsl(var(--chart-1))" />{boundary && <ReferenceLine x={boundary} stroke="hsl(var(--foreground))" strokeDasharray="4 3" />}</BarChart></ResponsiveContainer></CardContent>
    </Card>
    <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Crew hours by month</CardTitle></CardHeader>
      <CardContent className="h-72 pl-1"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" minTickGap={22} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={hrs} /><Legend /><Bar dataKey="allocated" name="Allocated hours" fill="hsl(var(--chart-1))" /><Line dataKey="capacity" name="Crew capacity" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />{boundary && <ReferenceLine x={boundary} stroke="hsl(var(--foreground))" strokeDasharray="4 3" />}</ComposedChart></ResponsiveContainer></CardContent>
    </Card>
  </div>;
}