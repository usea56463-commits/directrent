import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setLocation("/admin");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    try {
      await login({ username, password });
      toast({
        title: "Access Granted",
        description: "Welcome to the administration dashboard.",
      });
      setLocation("/admin");
    } catch (err: any) {
      toast({
        title: "Access Denied",
        description: err.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/20 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10"
      >
        <Card className="glass-card p-8 border-slate-700/60 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-slate-800 p-4 rounded-2xl mb-4 border border-slate-700 shadow-inner">
              <ShieldAlert className="w-10 h-10 text-sky-400" />
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-100 tracking-tight">Admin Gateway</h1>
            <p className="text-slate-400 mt-2">Secure access required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Username</Label>
              <Input 
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-900/50 border-slate-700 h-12 text-slate-200 placeholder:text-slate-500 focus-visible:ring-sky-500/50 focus-visible:border-sky-500"
                placeholder="Enter admin username"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <Input 
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900/50 border-slate-700 h-12 text-slate-200 placeholder:text-slate-500 focus-visible:ring-sky-500/50 focus-visible:border-sky-500"
                placeholder="••••••••"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-lg shadow-lg shadow-sky-500/25 transition-all active:scale-[0.98]"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : "Authenticate"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
