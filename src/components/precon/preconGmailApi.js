import { base44 } from '@/api/base44Client';
export const GMAIL_CONNECTOR = '6afefd8bd586a64d6638c478';
export const gmailStatus = e => e?.status ?? e?.response?.status;
export const gmailError = (e, fallback) => e.data?.error || e.response?.data?.error || fallback;
export async function inboxRequest(action, data = {}) {
  return (await base44.functions.invoke('preconGmailInbox',{action,...data})).data;
}
export async function shareRequest(action, data = {}) {
  return (await base44.functions.invoke('preconGmailSharing',{action,...data})).data;
}