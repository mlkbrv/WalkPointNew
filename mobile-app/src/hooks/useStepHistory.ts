/**
 * Daily step totals from the server, oldest first.
 *
 * The dashboard used to chart a fixed array that shipped with the app, then
 * later fetched its own copy of `/v1/steps/history` independently of the
 * screen showing today's live count. That left two numbers for "today" on
 * screen at once — a live one from Health Connect and a stale one from
 * whenever this hook had last fetched — agreeing only by coincidence. Reading
 * from `ServerDataContext` instead means every screen shares one fetch, and
 * `useStepSync` refreshes it the moment a new sync actually lands, so the
 * week chart's "today" bar moves with the counter above it rather than
 * catching up next time the screen is reopened.
 */

import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { useServerData } from "../contexts/ServerDataContext";
import type { ApiDailySteps } from "../api/endpoints";

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
  const { stepsHistory, refreshSteps } = useServerData();

  useFocusEffect(
    useCallback(() => {
      void refreshSteps();
    }, [refreshSteps]),
  );

  const ordered = [...stepsHistory.data].sort((a, b) => a.date.localeCompare(b.date));
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
    // Only the first load should show a spinner — a background revalidation
    // must not blank out a chart the user is already looking at.
    loading: stepsHistory.loading && !stepsHistory.loaded,
  };
}
