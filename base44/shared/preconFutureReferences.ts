// Reserved data contracts only: no records, connectors, downloads or external writes.
export type PreconProjectAnchor = { saleId: string; leadId?: string; clientId: string; projectId?: string; buildertrendProjectId?: string; driveFolderId?: string };
export type PreconExternalReference = {
  saleId: string; taskId?: string; evidenceVersion?: string; sourceAccountId?: string;
  reference:
    | { kind: 'gmail'; threadId: string; messageId?: string }
    | { kind: 'drive'; fileId: string; folderId?: string; revisionId?: string }
    | { kind: 'buildertrend'; projectId: string }
    | { kind: 'estimate_export'; estimateId: string; exportVersion: string; driveFileId?: string }
    | { kind: 'rfq'; rfqId: string; quotationId?: string; quotationRevision?: string };
};
export type PreconExternalEvent = { provider: string; accountId: string; externalEventId: string; kind: string; occurredAt: string; receivedAt: string; saleId?: string; match: 'unmatched' | 'human_confirmed' | 'verified'; reference?: PreconExternalReference };