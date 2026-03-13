import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useTrackVisitor } from "@/hooks/use-visitors";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Cookie, Fingerprint, Radar, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { mutate: trackVisitor, isPending } = useTrackVisitor();
  const { toast } = useToast();
  const [cookiesSet, setCookiesSet] = useState(false);
  const [cookieCount, setCookieCount] = useState(0);

  useEffect(() => {
    // Simulate setting JS cookies
    document.cookie = `js_cookie=true; path=/; max-age=3600`;
    document.cookie = `screen_resolution=${window.screen.width}x${window.screen.height}; path=/`;
    document.cookie = `timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}; path=/`;
    document.cookie = `browser_language=${navigator.language}; path=/`;
    
    const count = document.cookie.split(';').filter(c => c.trim().length > 0).length;
    setCookieCount(count);
    setCookiesSet(true);

    trackVisitor(
      { 
        jsCookiesSet: true,
        page: window.location.pathname,
        referrer: document.referrer || 'Direct'
      },
      {
        onSuccess: () => {
          toast({
            title: "Data captured",
            description: "Your visit has been recorded in the database.",
          });
        }
      }
    );
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-4 bg-sky-500/10 rounded-2xl mb-6 shadow-[0_0_40px_-10px_rgba(56,189,248,0.3)]">
              <Radar className="w-12 h-12 text-sky-400 animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
              SeeFiles Tracker
            </h1>
            <p className="text-slate-400 text-lg">
              Demonstration of browser fingerprinting and analytics tracking.
            </p>
          </div>

          <Card className="glass-card p-6 md:p-8 rounded-2xl relative overflow-hidden">
            {/* Background embellishment */}
            <div className="absolute top-0 right-0 p-32 bg-sky-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-6 mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-6 h-6 text-emerald-400" />
                <h2 className="text-xl font-semibold text-slate-100">Status: Active</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {isPending ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </>
                  )}
                </span>
                <span className="text-sm text-slate-400">
                  {isPending ? "Capturing..." : "Data Captured"}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <Cookie className="w-5 h-5 text-amber-400" />
                  <h3 className="font-medium text-slate-200">Cookies Set on Your Browser</h3>
                </div>
                
                <ul className="space-y-2 font-mono text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="text-sky-400">js_cookie:</span> true
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-sky-400">screen_resolution:</span> {window.screen.width}x{window.screen.height}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-sky-400">timezone:</span> {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-sky-400">browser_language:</span> {navigator.language}
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-6 h-6 text-emerald-400" />
                  <span className="font-medium text-slate-200">Total Cookies Discovered</span>
                </div>
                <span className="text-2xl font-bold text-emerald-400">{cookieCount}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/admin" className="flex-1">
                <Button className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold shadow-lg shadow-sky-500/25">
                  <Server className="w-4 h-4 mr-2" />
                  View Live Dashboard
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="flex-1 h-12 border-slate-700 hover:bg-slate-800"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
