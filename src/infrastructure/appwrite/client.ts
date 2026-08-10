import { Client, Account, Databases, Storage } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

export function getAppwriteClient() {
  const client = new Client();
  client
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  if (typeof window !== 'undefined') {
    try {
      const session = window.localStorage.getItem('appwrite_session');
      if (session) {
        try {
          client.setSession(session);
        } catch {
          // Ignore invalid session tokens
        }
      }
    } catch {
      // The httpOnly session cookie remains the source of truth if storage is unavailable.
    }
  }

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);

  return { client, account, databases, storage };
}
