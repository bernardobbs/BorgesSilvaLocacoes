// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    if (error) setErro(error.message);
    else setEnviado(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Digite seu e-mail e enviaremos um link para criar uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enviado ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-medium">E-mail enviado!</p>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para criar uma nova senha.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">Voltar ao login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com" className="pl-9" required />
                </div>
              </div>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground justify-center">
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
