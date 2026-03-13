import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { UAParser } from "ua-parser-js";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Helper to parse cookies from headers
const parseCookies = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const parts = c.trim().split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup simple session auth
  app.use(session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    resave: false,
    saveUninitialized: false,
    secret: "dev-tracking-key-2024"
  }));

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      // Hardcoded credentials from Python app
      if (input.username === 'admin' && input.password === 'admin123') {
        req.session.authenticated = true;
        res.json({ success: true });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.post(api.auth.logout.path, async (req, res) => {
    req.session.authenticated = false;
    res.json({ success: true });
  });

  app.get(api.auth.check.path, async (req, res) => {
    res.json({ authenticated: req.session.authenticated === true });
  });

  // Auth middleware for protected routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.authenticated) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
  };

  app.get(api.visitors.list.path, requireAuth, async (req, res) => {
    const v = await storage.getVisitors();
    res.json(v);
  });

  app.get(api.visitors.get.path, requireAuth, async (req, res) => {
    const v = await storage.getVisitor(Number(req.params.id));
    if (!v) {
      return res.status(404).json({ message: 'Visitor not found' });
    }
    res.json(v);
  });

  app.post(api.visitors.track.path, async (req, res) => {
    try {
      const input = req.body && Object.keys(req.body).length > 0 ? api.visitors.track.input?.parse(req.body) : {};
      
      let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      if (Array.isArray(ip)) ip = ip[0];
      if (ip.includes(',')) ip = ip.split(',')[0].trim();
      
      const port = req.socket.remotePort || 0;
      
      let location = "Unknown";
      try {
        if (ip && ip !== '::1' && ip !== '127.0.0.1') {
          const r = await fetch(`http://ip-api.com/json/${ip}`);
          const data: any = await r.json();
          if (data.status === 'success') {
            location = `${data.country} - ${data.city}`;
          }
        }
      } catch (e) {
        // ignore
      }

      const uaString = req.headers['user-agent'] || '';
      const parser = new UAParser(uaString);
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();
      
      let deviceType = 'Desktop';
      if (device.type === 'mobile') deviceType = 'Mobile';
      else if (device.type === 'tablet') deviceType = 'Tablet';
      
      const cookies = parseCookies(req.headers.cookie as string);

      await storage.createVisitor({
        ip,
        port,
        location,
        device: deviceType,
        browser: browser.name || 'Unknown',
        browserVersion: browser.version || 'Unknown',
        os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
        language: req.headers['accept-language'] || 'Unknown',
        page: input?.page || req.headers['referer'] || req.path,
        referrer: input?.referrer || req.headers['referer'] || 'Direct',
        allCookies: cookies,
        allHeaders: req.headers,
      });

      res.status(201).json({ success: true });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  return httpServer;
}

// Ensure session typing
declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}