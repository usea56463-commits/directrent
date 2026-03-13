import { db } from "./db";
import { visitors, type InsertVisitor, type Visitor } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getVisitors(): Promise<Visitor[]>;
  getVisitor(id: number): Promise<Visitor | undefined>;
  createVisitor(visitor: InsertVisitor): Promise<Visitor>;
}

export class DatabaseStorage implements IStorage {
  async getVisitors(): Promise<Visitor[]> {
    return await db.select().from(visitors).orderBy(desc(visitors.id)).limit(50);
  }

  async getVisitor(id: number): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id));
    return visitor;
  }

  async createVisitor(insertVisitor: InsertVisitor): Promise<Visitor> {
    const [visitor] = await db.insert(visitors).values(insertVisitor).returning();
    return visitor;
  }
}

export const storage = new DatabaseStorage();