function safeEmailText(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll('script,style,head,svg,iframe,object,template,noscript')) node.remove();
  for (const node of template.content.querySelectorAll('br,p,div,tr,li,blockquote,h1,h2,h3,section')) node.append(document.createTextNode('\n'));
  return template.content.textContent;
}
export function gmailDate(value) { return value ? new Date(value).toLocaleString() : 'Date unavailable'; }
export default function PreconGmailMessage({ message, children }) {
  return <article className="min-w-0 space-y-2 border bg-background p-3 text-sm">
    <h4 className="break-words font-semibold">{message.subject}</h4>
    <div className="break-words text-muted-foreground"><p>From: {message.from}</p><p>To: {message.to}</p>{message.cc && <p>Cc: {message.cc}</p>}<p>{gmailDate(message.date)}</p></div>
    {message.body.length ? message.body.map(({type,text},index) => <p key={index} className="whitespace-pre-wrap break-words">{type === 'text/html' ? safeEmailText(text) : text}</p>) : <p>No readable message body.</p>}
    {message.attachments.length > 0 && <p className="break-words">Attachments: {message.attachments.map(a=>a.name).join(', ')}</p>}
    {children}
  </article>;
}