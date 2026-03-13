import { z } from "zod";

export function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod Error] ${label} validation failed:`, result.error.format());
    console.error(`[Zod Error] ${label} raw data:`, data);
    throw new Error(`Data validation failed for ${label}`);
  }
  return result.data;
}
