import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { GMAIL_CONNECTOR, inboxRequest, gmailError, gmailStatus } from '@/components/precon/preconGmailApi';

export default function usePreconGmailInbox() {
  const [auth,setAuth] = useState(null), [page,setPage] = useState(null), [thread,setThread] = useState(null);
  const [pending,setPending] = useState(false), [error,setError] = useState(''), [canConnect,setCanConnect] = useState(false);
  const timer = useRef(), lock = useRef(false);
  const run = useCallback(async (fn, fallback) => {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try { await fn(); }
    catch (e) { const missing = gmailStatus(e) === 412; if (missing) {setPage(null);setThread(null);setCanConnect(true);} setError(gmailError(e,fallback)); }
    finally { lock.current = false; setPending(false); }
  },[]);
  const load = useCallback((query = '',cursor = '') => run(async()=>{
    const data = await inboxRequest('inbox',{query,cursor});
    setPage(previous => cursor ? {...data,query,messages:[...(previous?.messages || []),...data.messages]} : {...data,query});
    setCanConnect(false); setThread(null);
  }, 'Could not load your inbox.'),[run]);
  useEffect(()=>{
    let active = true;
    base44.auth.isAuthenticated().then(ok=>{ if (active) {setAuth(ok);if(ok) load();} }).catch(()=>{if(active) setAuth(false);});
    return ()=>{active=false;clearInterval(timer.current);};
  },[load]);
  function connect(onReturn, onError = setError) {
    if (lock.current) {onError('Wait for Gmail to finish loading, then try reconnecting.');return;}
    const popup = window.open('about:blank','_blank');
    if (!popup) {onError('Allow pop-ups to reconnect Gmail, then try again.');return;}
    popup.opener = null;
    void run(async()=>{
      try { popup.location.href = await base44.connectors.connectAppUser(GMAIL_CONNECTOR); }
      catch {popup.close();onError('Could not open Google consent. Try reconnecting again.');return;}
      clearInterval(timer.current);
      const deadline = Date.now() + 5 * 60 * 1000;
      timer.current = setInterval(()=>{
        if (!popup.closed && Date.now() < deadline) return;
        clearInterval(timer.current);
        if (!popup.closed) {onError('Google consent did not finish. Close the consent window and try again.');return;}
        load();
        onReturn?.();
      },700);
    },'Could not open Gmail consent.');
  }
  const open = id => run(async()=>{setThread(null);setThread(await inboxRequest('thread',{threadId:id}));},'Could not open this thread.');
  const disconnect = () => run(async()=>{await base44.connectors.disconnectAppUser(GMAIL_CONNECTOR);setThread(null);setPage(null);setCanConnect(true);},'Could not disconnect Gmail.');
  return {auth,page,thread,closeThread:()=>setThread(null),pending,error,canConnect,load,connect,open,disconnect};
}