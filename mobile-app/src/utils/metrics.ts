/**
 * Display-only conversions from a step count.
 *
 * These are approximations for the dashboard — distance, calories and active
 * minutes shown next to today's steps. They deliberately do not include any
 * coin maths: `tokensFromSteps` and `balanceFromParts` used to live here and
 * were a second, wrong implementation of the economy. The real rule (nothing
 * below the threshold, a flat reward at it, then a rate per extra thousand) is
 * configurable per deployment and lives on the server. Ask it, do not compute it:
 * `GET /v1/steps/rules` describes it and `GET /v1/wallet` is the balance.
 */

export const STEP_TO_KM = 0.00075;
export const STEP_TO_KCAL = 0.04;
export const STEP_TO_MIN = 0.0045;

export function distanceFromSteps(steps: number): number {
  return Number((Math.max(0, steps) * STEP_TO_KM).toFixed(2));
}

export function caloriesFromSteps(steps: number): number {
  return Math.floor(Math.max(0, steps) * STEP_TO_KCAL);
}

export function minutesFromSteps(steps: number): number {
  return Math.floor(Math.max(0, steps) * STEP_TO_MIN);
}
