/**
 * Daily step totals from the server, oldest first.
 *
 * The dashboard used to chart a fixed array that shipped with the app. This
 * reads the same `daily_steps` rows the economy pays on, so the bars and the
 * wallet cannot tell different stories about the same week.
 */

import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { stepsApi, type ApiDailySteps } from "../api/endpoints";

export interface WeekComparison {
  /** Last seven days, oldest first, one entry per day the server reported. */
  days: ApiDailySteps[];
  thisWeek: number;
  previousWeek: number;
  /** Percentage change against the previous seven days, or null when there is nothing to compare. */
  changePercent: number | null;
  loading: boolean;
}

const DAY_MS = 86_400_000;

export function useStepHistory(): WeekComparison {
  const [history, setHistory] = useState<ApiDailySteps[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          // Fourteen days: seven to show, seven to compare against.
          const page = await stepsApi.history(14);
          if (!cancelled) setHistory(page.days);
        } catch {
          // The dashboard degrades to empty bars rather than an error banner —
          // the ring above it is the screen's real content.
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return useMemo(() => {
    const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const cutoff = new Date(Date.now() - 7 * DAY_MS).toISOString().slice(0, 10);

    const recent = ordered.filter((day) => day.date > cutoff);
    const older = ordered.filter((day) => day.date <= cutoff);

    const total = (rows: ApiDailySteps[]) => rows.reduce((sum, row) => sum + row.steps, 0);
    const thisWeek = total(recent);
    const previousWeek = total(older);

    return {
      days: recent,
      thisWeek,
      previousWeek,
      // Dividing by zero would report an infinite improvement on a first week.
      changePercent:
        previousWeek > 0 ? Math.round(((thisWeek - previousWeek) / previousWeek) * 100) : null,
      loading,
    };
  }, [history, loading]);
}
