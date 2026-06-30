import { useState } from 'react';
import { motion } from 'motion/react';
import { Hourglass, Chrome } from 'lucide-react';
import { UserProfile } from '../types';
import { signInWithGoogle, isFirebaseConfigured } from '../lib/firebase';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);

    // Validate configuration before attempting login
    if (!isFirebaseConfigured()) {
      setAuthError("Google Sign-In is temporarily unavailable.");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        const isAnonymous = result.user.isAnonymous;
        
        // Check if we have existing stats in localStorage to preserve
        let savedStats = { productivityScore: 0, streak: 0, completedCount: 0, totalHoursWorked: 0 };
        try {
          const saved = localStorage.getItem('deadlineai_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            savedStats = {
              productivityScore: parsed.productivityScore || 0,
              streak: parsed.streak || 0,
              completedCount: parsed.completedCount || 0,
              totalHoursWorked: parsed.totalHoursWorked || 0
            };
          }
        } catch (e) {
          console.error(e);
        }

        const profile: UserProfile = {
          name: isAnonymous ? "Productive Guest (Preview)" : (result.user.displayName || "Google User"),
          email: isAnonymous ? "guest@deadlineai.com" : (result.user.email || ""),
          picture: isAnonymous 
            ? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&fit=crop" 
            : (result.user.photoURL || undefined),
          ...savedStats
        };
        
        onLoginSuccess(profile);
      } else {
        throw new Error("Google Sign-In is temporarily unavailable.");
      }
    } catch (err: any) {
      console.error("Login attempt failed:", err);
      
      let friendlyMessage = "Something went wrong. Please try again.";
      if (err?.message?.includes("connect") || err?.message?.includes("network") || err?.message?.includes("Unable to connect")) {
        friendlyMessage = "Unable to connect. Check your internet connection.";
      } else if (err?.message?.includes("cancelled")) {
        friendlyMessage = "Sign in was cancelled.";
      } else if (err?.message?.includes("permission") || err?.message?.includes("permission-denied")) {
        friendlyMessage = "You don't have permission to access this data.";
      } else if (err?.message?.includes("unavailable") || err?.message?.includes("unconfigured") || err?.message?.includes("temporarily unavailable") || err?.message?.includes("restricted")) {
        friendlyMessage = "Google Sign-In is temporarily unavailable.";
      }
      setAuthError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-page" className="min-h-screen relative flex items-center justify-center bg-slate-950 px-6 overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center">
          {/* Brand Logo */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-xl shadow-indigo-500/25">
              <Hourglass className="w-10 h-10 animate-pulse" />
            </div>
            <h1 className="font-sans font-bold text-3xl tracking-wide text-white mt-2">
              DeadlineAI
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              AI-powered smart task planner that helps you organize, prioritize, and complete your work efficiently.
            </p>
          </div>

          <div className="mt-8 space-y-4 w-full">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer focus:outline-none font-sans"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Chrome className="w-5 h-5 text-indigo-600" />
                  Continue with Google
                </>
              )}
            </button>

            {authError && (
              <div className="space-y-3 w-full">
                <div className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 p-3 rounded-xl text-center leading-normal">
                  {authError}
                </div>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow focus:outline-none cursor-pointer text-center"
                >
                  Retry Google Sign-In
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
