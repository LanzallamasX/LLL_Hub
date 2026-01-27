// lib/vacations/settings.ts
export type CountMode = "business_days" | "calendar_days";

export const DEFAULT_VACATION_SETTINGS = {
  countMode: "business_days" as CountMode, // LLL Hub
  carryover: {
    enabled: true,
    maxCycles: 3, // acumula hasta 3 ciclos
  },
};
