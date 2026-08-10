import { Client, Account, Databases, Users } from 'node-appwrite';

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://sgp.cloud.appwrite.io/v1';
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';
const apiKey = process.env.APPWRITE_API_KEY || '';

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
