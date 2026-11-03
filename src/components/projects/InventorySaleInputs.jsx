import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
export default function InventorySaleInputs({ date, price, onDate, onPrice, onApply, disabled }) {
  return <div className="space-y-3 border border-border p-3">
    <p className="font-medium">Sell from FBG inventory</p>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="inventory-sale-date">Sale date</Label><Input id="inventory-sale-date" type="date" required value={date} onChange={e => onDate(e.target.value)} disabled={disabled} /></div><div><Label htmlFor="inventory-sale-price">Sale price ($)</Label><Input id="inventory-sale-price" type="number" min="0" step="0.01" required value={price} onChange={e => onPrice(e.target.value)} disabled={disabled} /></div></div>
    <Button type="button" variant="outline" disabled={disabled || !date || price === ''} onClick={onApply}>Allocate sale and net GP to sale month</Button>
    <p className="text-xs text-muted-foreground">Net GP is sale price less all costs entered below. Cost months stay unchanged. Adjust GP timing below if profit is realized over later months.</p>
  </div>;
}