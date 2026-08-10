import {
  Client,
  Account,
  Databases,
  Storage,
  Users,
  Teams,
} from 'node-appwrite';
import { APPWRITE_CONFIG } from './config';

export function getAppwriteAdminClient() {
  const client = new Client();
  client
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setKey(APPWRITE_CONFIG.apiKey);

  const account = new Account(client);
  const databases = new Databases(client);
  const storage = new Storage(client);
  const users = new Users(client);
  const teams = new Teams(client);

  return { client, account, databases, storage, users, teams };
}
