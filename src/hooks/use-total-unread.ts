'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/db/client';

export function useTotalUnread(): number {
  const [total, setTotal] = useState(0);
  const countsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, unread_count');
        if (error || cancelled) return;
        const map = new Map<string, number>();
        let sum = 0;
        for (const row of data || []) {
          const n = Number(row.unread_count || 0);
          map.set(row.id, n);
          if (n > 0) sum += 1;
        }
        countsRef.current = map;
        setTotal(sum);
      } catch {
        if (!cancelled) setTotal(0);
      }
    };

    void load();
    const channel = supabase
      .channel('inbox-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          const map = countsRef.current;
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (oldRow.id) map.delete(oldRow.id);
          } else {
            const row = payload.new as { id?: string; unread_count?: number };
            if (row.id) map.set(row.id, Number(row.unread_count || 0));
          }
          let sum = 0;
          for (const n of map.values()) if (n > 0) sum += 1;
          setTotal(sum);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return total;
}
