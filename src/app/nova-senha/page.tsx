// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmar) { setErro("As senhas não coincidem."); return; }
    if (senha.length < 6) { setErro("A senha deve ter no mínimo 6 caracteres."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setErro(error.message);
    else { setSucesso(true); setTimeout(() => router.push("/dashboard"), 2000); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nova senha</CardTitle>
          <CardDescription>Escolha uma senha segura para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          {sucesso ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-medium">Senha alterada com sucesso!</p>
              <p className="text-sm text-muted-foreground">Redirecionando para o dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <div className="relative">
                  <Input type={mostrar ? "text" : "password"} value={senha}
                    onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required />
                  <button type="button" onClick={() => setMostrar(!mostrar)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input type={mostrar ? "text" : "password"} value={confirmar}
                  onChange={e => setConfirmar(e.target.value)} placeholder="Repita a senha" required />
              </div>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
