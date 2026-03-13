import { useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useVisitor } from "@/hooks/use-visitors";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Terminal } from "lucide-react";

export default function RawData() {
  const [, params] = useRoute("/raw/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: visitor, isLoading } = useVisitor(id);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

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
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-100 flex items-center gap-2">
              <Terminal className="w-6 h-6 text-sky-400" />
              Raw JSON Data
            </h1>
            <p className="text-sm text-slate-400">Visitor Record #{id}</p>
          </div>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs font-mono text-slate-500 ml-2">visitor-{id}.json</span>
          </div>
          <div className="p-4 md:p-6 bg-[#090e17] overflow-x-auto">
            {visitor ? (
              <pre className="font-mono text-sm text-sky-300/90 whitespace-pre-wrap">
                {JSON.stringify(visitor, null, 2)}
              </pre>
            ) : (
              <p className="text-rose-400 font-mono text-sm">Error: Visitor {id} not found.</p>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
