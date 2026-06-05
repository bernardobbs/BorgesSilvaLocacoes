// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Eye, EyeOff, AlertCircle, Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginFormData } from "@/lib/schemas";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const router = useRouter();
  const { signIn } = useAuth();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError("");
    try {
      await signIn(data.email, data.password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.message?.includes("Invalid login credentials")) {
        setAuthError("E-mail ou senha incorretos.");
      } else if (err.message?.includes("Email not confirmed")) {
        setAuthError("Confirme seu e-mail antes de entrar.");
      } else {
        setAuthError("Erro ao entrar. Tente novamente.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">

      {/* Card central */}
      <div className="w-full max-w-sm space-y-8">

        {/* Logo + título */}
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo size="lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-3">
              Borges Silva Locações
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema familiar de gestão de imóveis
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {authError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email" type="email" placeholder="seu@email.com"
                className="h-11" disabled={isSubmitting}
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="/esqueci-senha" className="text-xs text-muted-foreground hover:text-foreground">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password" type={showPassword ? "text" : "password"}
                  placeholder="••••••••" className="h-11 pr-10"
                  disabled={isSubmitting} {...register("password")}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/recuperar-senha" className="text-xs text-muted-foreground hover:text-foreground">
              Esqueci minha senha
            </Link>
          </div>
          <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Acesso restrito a membros da família.<br />
          Solicite ao administrador para obter acesso.
        </p>
      </div>
    </div>
  );
}
