export const TOKEN_RATE = 10;
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

export function tokensFromSteps(steps: number, rate: number = TOKEN_RATE): number {
  return Math.floor(Math.max(0, steps) / 1000) * rate;
}

export function balanceFromParts(steps: number, bonusTokens: number, spentTokens: number): number {
  return Math.max(0, tokensFromSteps(steps) + bonusTokens - spentTokens);
}
