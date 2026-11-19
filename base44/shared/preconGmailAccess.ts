import { GmailPilotError, sdkStatus } from './preconGmailReader.ts';

export async function authorizeGmailPilot(base44) {
  const user = await base44.auth.me().catch(e => sdkStatus(e) === 401 ? null : Promise.reject(e));
  if (!user?.id) throw new GmailPilotError('Sign in to open the Gmail pilot.',401);
  if (user.role === 'admin') return user;
  if (user.role !== 'user' || !['pipeline_precon','pipeline'].some(key => user.permissions?.includes(key))) throw new GmailPilotError('You do not have access to the Gmail pilot.',403);
  const { items } = await base44.asServiceRole.entities.PreconGmailProjectMember.filter({user_id:user.id}, {limit:1});
  if (!items.length) throw new GmailPilotError('An admin must enroll you on a project team for the Gmail pilot.',403);
  return user;
}

export const isShareViewer = (userId, share) => share.actor_id === userId || share.recipient_ids.includes(userId);