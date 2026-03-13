import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  ip: text("ip"),
  port: integer("port"),
  location: text("location"),
  device: text("device"),
  browser: text("browser"),
  browserVersion: text("browser_version"),
  os: text("os"),
  language: text("language"),
  page: text("page"),
  referrer: text("referrer"),
  visitTime: timestamp("visit_time").defaultNow(),
  allCookies: jsonb("all_cookies"),
  allHeaders: jsonb("all_headers")
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({ id: true, visitTime: true });

export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;