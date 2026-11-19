import { Button } from '@/components/ui/button';

const actions = {
  'Evidence received':['submit','Engineer: submit this version for review'],
  'Submitted for independent review':['review','Coordinator: record evidence reviewed'],
  'Evidence reviewed':['accept','Coordinator: accept evidence'],
  'Evidence accepted':['approve','Coordinator: approve technical work'],
};
export default function PreconCommunicationDocuments({ run, act, pending }) {
  const doc = run.documents.at(-1);
  const next = actions[doc?.status];
  return <section className="space-y-3 border-t pt-4 text-sm">
    <h4 className="font-semibold">Stage 23 · Communication and documents</h4>
    <p>Engineering / Permit Set: <strong>{run.task.status}</strong> · Stage 24: <strong>{run.task.downstream}</strong></p>
    {!doc ? <p>No evidence received.</p> : <>
      <p>Linked existing folder: {doc.folder} (fictional Drive)</p>
      <ul className="space-y-1">{run.documents.map(item => <li key={item.version}>{item.name} · {item.current ? 'Current' : 'Superseded'} · {item.status} · from {item.messageId}</li>)}</ul>
      <Button size="sm" variant="outline" disabled={pending || !!run.failure} onClick={() => act('preview')}>Open sample document</Button>
      {!run.failure && run.previewed === doc.version && <div className="border bg-background p-3"><strong>Sample preview: {doc.name}</strong><p>{doc.version === 2 ? 'Revision 2: signed structural issue with beam schedule.' : 'Revision 1: initial structural issue.'}</p><p>Drive reference: {doc.id} · version {doc.version}</p></div>}
      {next && <Button size="sm" className="h-auto whitespace-normal text-left" disabled={pending || !!run.failure || (next[0] === 'submit' && run.previewed !== doc.version)} onClick={() => act(next[0])}>{next[1]}</Button>}
    </>}
  </section>;
}