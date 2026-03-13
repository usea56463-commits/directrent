import { z } from 'zod';
import { visitors } from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  visitors: {
    list: {
      method: 'GET' as const,
      path: '/api/visitors' as const,
      responses: {
        200: z.array(z.custom<typeof visitors.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/visitors/:id' as const,
      responses: {
        200: z.custom<typeof visitors.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    track: {
      method: 'POST' as const,
      path: '/api/track' as const,
      input: z.object({
        jsCookiesSet: z.boolean().optional(),
        page: z.string().optional(),
        referrer: z.string().optional(),
      }).optional(),
      responses: {
        201: z.object({ 
          success: z.boolean(), 
          cookies: z.record(z.string(), z.string()).optional() 
        }),
        400: errorSchemas.validation,
      },
    },
  },
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login' as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: z.object({ message: z.string() }),
      }
    },
    check: {
      method: 'GET' as const,
      path: '/api/auth/check' as const,
      responses: {
        200: z.object({ authenticated: z.boolean() }),
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type VisitorResponse = z.infer<typeof api.visitors.get.responses[200]>;
export type VisitorsListResponse = z.infer<typeof api.visitors.list.responses[200]>;