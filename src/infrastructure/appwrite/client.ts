import { Client, Account, Databases, Storage } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

export function getAppwriteClient() {
  const client = new Client();
  client
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);

  return { client, account, databases, storage };
}
