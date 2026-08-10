import { Client, Account, Databases } from 'appwrite';

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://sgp.cloud.appwrite.io/v1';
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '6a79822b003adde92f63';

export const client = new Client().setEndpoint(endpoint).setProject(projectId);

export const account = new Account(client);
export const databases = new Databases(client);
