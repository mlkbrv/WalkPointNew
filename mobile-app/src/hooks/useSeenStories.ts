import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@stride/seen_stories_v1";

export function useSeenStories() {
  const [seenIds, setSeenIds] = useState<string[]>([]);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setSeenIds(JSON.parse(raw));
    } catch {
      setSeenIds([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const markSeen = useCallback(async (id: string) => {
    setSeenIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return { seenIds, markSeen, reload };
}
