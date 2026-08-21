/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createSupabaseClient } from '@/lib/supabase/client';

/** @deprecated Use `@/lib/supabase/client` directly. */
export function getAppwriteClient() {
  const supabase = createSupabaseClient();

  const subscribe = (channels: string[], callback: (event: any) => void) => {
    const realtime = supabase.channel(`legacy-${crypto.randomUUID()}`);
    for (const channel of channels) {
      const table = channel.match(/\.collections\.([^.]+)\.documents/)?.[1];
      if (!table) continue;
      realtime.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) =>
          callback({
            payload: payload.new || payload.old,
            events: [`${table}.${payload.eventType.toLowerCase()}`],
          })
      );
    }
    realtime.subscribe();
    return () => {
      void supabase.removeChannel(realtime);
    };
  };

  const databases = {
    async listDocuments(_databaseId: string, table: string) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      const documents = (data || []).map((row: Record<string, any>) => ({
        ...row,
        $id: row.id,
        unreadCount: row.unread_count,
      }));
      return { documents, total: documents.length };
    },
  };

  const account = {
    ...supabase.auth,
    deleteSessions: () => supabase.auth.signOut({ scope: 'global' }),
  };

  return {
    client: { subscribe },
    account,
    databases,
    storage: supabase.storage,
  };
}
