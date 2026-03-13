import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out successfully" });
      setLocation("/login");
    } catch (err) {
      toast({ title: "Failed to logout", variant: "destructive" });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="bg-sky-500/10 p-2 rounded-lg group-hover:bg-sky-500/20 transition-colors">
            <Activity className="w-5 h-5 text-sky-400" />
          </div>
          <span className="font-display font-bold text-lg text-slate-100 tracking-wide">
            SeeFiles <span className="text-sky-400">Tracker</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                <Shield className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/admin">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Dashboard
                </Button>
              </Link>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleLogout}
                className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
