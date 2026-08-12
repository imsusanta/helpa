import { Client, Account, Databases, Storage } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

export function getAppwriteClient() {
  const client = new Client();
  client
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  // Session secrets are intentionally not supplied to browser SDK code. All
  // authenticated data access goes through server routes using HttpOnly cookies.

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);

  return { client, account, databases, storage };
}
