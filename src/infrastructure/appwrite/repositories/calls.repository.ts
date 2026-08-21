import { Query } from 'node-appwrite';
import { getAppwriteAdminClient } from '../server';
import { APPWRITE_CONFIG } from '../config';

import {
  isValidCallStateTransition,
  CallState,
} from '@/lib/voice/call-state-machine';

export interface CallDocument {
  $id: string;
  accountId: string;
  contactId?: string;
  patientPhone?: string;
  direction?: 'inbound' | 'outbound';
  status?: string;
  provider: string;
  externalCallId?: string;
  callSid?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  failureCode?: string;
  failureMessageSanitized?: string;
  createdAt: string;
}

export class CallsRepository {
  private get db() {
    return getAppwriteAdminClient().databases;
  }

  async getCall(
    accountId: string,
    callId: string
  ): Promise<CallDocument | null> {
    try {
      const doc = await this.db.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.calls,
        callId
      );
      if ((doc as unknown as { accountId: string }).accountId !== accountId)
        return null;
      return doc as unknown as CallDocument;
    } catch {
      return null;
    }
  }

  async findCallByExternalId(
    accountId: string,
    externalCallId: string
  ): Promise<CallDocument | null> {
    try {
      const res = await this.db.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.calls,
        [
          Query.equal('accountId', accountId),
          Query.equal('externalCallId', externalCallId),
          Query.limit(1),
        ]
      );
      if (res.documents.length === 0) return null;
      return res.documents[0] as unknown as CallDocument;
    } catch {
      return null;
    }
  }

  async listCalls(accountId: string): Promise<CallDocument[]> {
    const res = await this.db.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      [Query.equal('accountId', accountId), Query.limit(100)]
    );
    return res.documents as unknown as CallDocument[];
  }

  async createCall(
    accountId: string,
    data: Omit<CallDocument, '$id' | 'accountId' | 'createdAt'>
  ): Promise<CallDocument> {
    const doc = await this.db.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      'unique()',
      {
        accountId,
        ...data,
        createdAt: new Date().toISOString(),
      }
    );
    return doc as unknown as CallDocument;
  }

  async updateCallStatus(
    accountId: string,
    callId: string,
    status: string,
    extra?: Record<string, unknown>
  ): Promise<CallDocument> {
    const doc = await this.db.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.calls,
      callId,
      { status, ...extra }
    );
    return doc as unknown as CallDocument;
  }

  async updateCallStatusWithValidation(
    accountId: string,
    callId: string,
    newStatus: CallState,
    extra?: Record<string, unknown>
  ): Promise<CallDocument | null> {
    const current = await this.getCall(accountId, callId);
    if (!current) return null;

    if (
      !isValidCallStateTransition(
        current.status as CallState | undefined,
        newStatus
      )
    ) {
      console.warn(
        `[CallsRepository] Prevented invalid transition from ${current.status} to ${newStatus} for call ${callId}`
      );
      return current;
    }

    return this.updateCallStatus(accountId, callId, newStatus, extra);
  }

  async markCallFailed(
    accountId: string,
    callId: string,
    reason: string
  ): Promise<CallDocument> {
    const sanitized = reason.slice(0, 120);
    return this.updateCallStatus(accountId, callId, 'failed', {
      failureCode: 'PROVIDER_INITIATION_FAILED',
      failureMessageSanitized: sanitized,
    });
  }
}

export const callsRepository = new CallsRepository();
