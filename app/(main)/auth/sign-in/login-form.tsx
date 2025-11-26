// app/(main)/auth/sign-in/login-form.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormEvent, useEffect, useState } from "react";
import { Loader, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const routeByRole = (role: string) =>
    role === "admin"
      ? "/admin"
      : role === "agent"
      ? "/agent"
      : role === "manager"
      ? "/manager"
      : role === "qc"
      ? "/qc"
      : role === "am"
      ? "/am"
      : role === "am_ceo"
      ? "/am_ceo"
      : role === "data_entry"
      ? "/data_entry"
      : "/client";

  const sendToRole = (role: string) => {
    setRedirecting(true);
    router.replace(routeByRole(role.toLowerCase()));
    router.refresh();
  };

  // If already authenticated (e.g., came back from Google), redirect by role
  useEffect(() => {
    if (status !== "authenticated" || redirecting) return;
    (async () => {
      try {
        const me = await fetch("/api/auth/session", { cache: "no-store" });
        const json = await me.json();
        sendToRole(json?.user?.role || "");
      } catch {
        /* ignore */
      }
    })();
  }, [status, router, redirecting]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || redirecting) return;
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      // NextAuth credentials
      const res = await signIn("credentials", {
        redirect: false, // we'll control redirect manually
        email,
        password,
      });

      if (res?.error) {
        toast.error(res.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      toast.success("Signed in successfully!");

      const me = await fetch("/api/auth/session", { cache: "no-store" });
      const json = await me.json();
      sendToRole(json?.user?.role || "");
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const busy = loading || redirecting;

  return (
    <Card className="bg-transparent border-none">
      <CardHeader>
        <div className="flex items-center justify-center mb-3">
          <div className="p-[3px] bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-lg">
            <img
              src="/birds_of_eden.jpeg"
              alt="Boed-logo"
              className="w-56 h-56 object-cover rounded-lg shadow-lg hover:scale-105 transition-transform duration-500 ease-out"
            />
          </div>
        </div>

        <CardTitle className="text-2xl text-white flex items-center justify-center">
          Task Management
        </CardTitle>
      </CardHeader>

      <CardContent className="bg-transparent">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-white">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="username"
                className="placeholder:text-white/80 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password" className="text-white">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                  className="placeholder:text-white/80 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-white/80 hover:text-white"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className={cn(
                "relative w-full rounded-md px-4 py-2 font-semibold text-gray-700",
                "bg-white border-gray-300 hover:bg-gray-50",
                "transition-all duration-300 ease-in-out",
                "shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              onClick={() => signIn("google")} // Google OAuth
              disabled={busy}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93?2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center justify-center text-gray-300 font-medium">
              Or continue with
            </div>

            <Button
              type="submit"
              className={cn(
                "relative w-full rounded-md px-4 py-2 font-semibold text-white",
                "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
                "transition-all duration-300 ease-in-out hover:from-pink-500 hover:to-indigo-500",
                "shadow-lg hover:shadow-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={busy}
            >
              {busy ? (
                <Loader className="animate-spin w-5 h-5 mx-auto" />
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
