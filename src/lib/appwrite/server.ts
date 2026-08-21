import { Client, Account, Databases, Users } from 'node-appwrite';

import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

const endpoint = APPWRITE_CONFIG.endpoint;
const projectId = APPWRITE_CONFIG.projectId;
const apiKey = process.env.APPWRITE_API_KEY || APPWRITE_CONFIG.apiKey;

export function createAdminClient() {
  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    get account() {
      return new Account(adminClient);
    },
    get databases() {
      return new Databases(adminClient);
    },
    get users() {
      return new Users(adminClient);
    },
  };
}

export function createSessionClient(sessionSecret: string) {
  const sessionClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setSession(sessionSecret);

  return {
    get account() {
      return new Account(sessionClient);
    },
    get databases() {
      return new Databases(sessionClient);
    },
  };
}
