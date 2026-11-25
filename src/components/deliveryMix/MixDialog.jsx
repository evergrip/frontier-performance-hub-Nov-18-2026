import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function MixDialog({ title, description, children, onSave, onClose, submit = 'Save changes', wide = false, sheet = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const save = async e => {
    e.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try { await onSave(); onClose(); } catch (err) { setError(err.message); setPending(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className={`${sheet ? 'w-[96vw] max-w-6xl p-4 sm:p-6' : wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90dvh] overflow-y-auto`}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="min-w-0 space-y-4" aria-busy={pending}>
        <fieldset disabled={pending} className="min-w-0 space-y-4">{children}</fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : submit}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}