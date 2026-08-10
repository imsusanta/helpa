'use client';

import { useEffect, useRef, useState } from 'react';
import { getAppwriteClient } from '@/infrastructure/appwrite/client';
import { APPWRITE_CONFIG } from '@/infrastructure/appwrite/config';

export function useTotalUnread(): number {
  const [total, setTotal] = useState(0);
  const countsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const loadAndSubscribe = async () => {
      try {
        const { client, databases } = getAppwriteClient();
        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.conversations
        );

        if (cancelled) return;

        const map = new Map<string, number>();
        let sum = 0;
        for (const doc of res.documents) {
          const n = (doc as any).unreadCount || (doc as any).unread_count || 0;
          map.set(doc.$id, n);
          if (n > 0) sum += 1;
        }
        countsRef.current = map;
        setTotal(sum);

        const convChannel = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.conversations}.documents`;
        unsubscribe = client.subscribe([convChannel], (response) => {
          const payload = response.payload as any;
          const map = countsRef.current;

          if (response.events.some((e) => e.endsWith('.delete'))) {
            if (payload.$id) map.delete(payload.$id);
          } else {
            map.set(
              payload.$id,
              payload.unreadCount || payload.unread_count || 0
            );
          }

          let sum = 0;
          for (const n of map.values()) if (n > 0) sum += 1;
          setTotal(sum);
        });
      } catch {
        if (!cancelled) setTotal(0);
      }
    };

    loadAndSubscribe();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return total;
}
