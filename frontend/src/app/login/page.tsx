"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/painel");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      {/* Brand backdrop: blue diagonal with orange glow */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #2575bd 0%, #1c5a93 55%, #0a0a0a 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: "#ed6b27" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: "#ed6b27" }}
      />

      {/* Logo top-right */}
      <div className="absolute right-6 top-6 z-20">
        <Image
          src="/logo.png"
          alt="Novalog"
          width={160}
          height={48}
          className="h-10 w-auto object-contain drop-shadow-md"
          priority
        />
      </div>

      <Card className="relative z-10 w-full max-w-md border-0 shadow-2xl">
        <CardContent className="p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-4 ring-orange-500/20">
              <Image
                src="/icon.png"
                alt="Novalog"
                width={72}
                height={72}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-black">
              Novalog <span className="text-blue-600">RH</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="h-11 w-full bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-slate-400">
            <span className="h-px w-8 bg-slate-200" />
            Novalog Logística
            <span className="h-px w-8 bg-slate-200" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
