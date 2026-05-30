"use client";

// src/modules/dashboard/Settings.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, CreditCard, Bell, Loader2, AlertCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { validarTelefone } from "@/lib/validators";
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MaskedInput } from "@/components/dashboard/MaskedInput";
import { useFormFormatting } from "@/lib/hooks/useFormFormatting";

interface SettingsProps {
  initialProfile?: any;
}

export default function Settings({ initialProfile }: SettingsProps) {
  const { user, profile: contextProfile } = useAuth();
  const profile = contextProfile || initialProfile;
  const { formatarTelefone, formatarCPF } = useFormFormatting();
  const [userData, setUserData] = useState({
    nome_completo: "",
    email: "",
    telefone: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setUserData({
        nome_completo: profile.nome_completo || "",
        email: profile.email || "",
        telefone: profile.telefone ? formatarTelefone(profile.telefone) : ""
      });
      setIsLoading(false);
    } else if (user && !initialProfile) {
      // Se não tiver profile mas tiver user, ainda está carregando
      setIsLoading(true);
    } else if (!user && !initialProfile) {
      setIsLoading(false);
      setError("Usuário não autenticado");
    }
  }, [profile, user, initialProfile, formatarTelefone]);

  const handleSave = async () => {
    if (!user || !profile) {
      toast.error("Você precisa estar logado");
      return;
    }

    // Validações
    if (!userData.nome_completo.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }

    if (userData.telefone && !validarTelefone(userData.telefone)) {
      toast.error("Telefone inválido");
      return;
    }

    setIsSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          nome_completo: userData.nome_completo.trim(),
          telefone: userData.telefone.replace(/\D/g, '') || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("Configurações salvas com sucesso!");
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      toast.error(err.message || 'Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir conta');
      }

      toast.success("Conta excluída com sucesso");
      // Forçar logout no frontend para limpar estado
      window.location.href = '/login';
    } catch (err: any) {
      console.error('Erro ao excluir conta:', err);
      toast.error(err.message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-tertiary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="py-12">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">Erro ao carregar dados</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-tertiary" aria-hidden="true" />
              Dados pessoais
            </CardTitle>
            <CardDescription>
              Informações da sua conta de proprietário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  value={userData.nome_completo}
                  onChange={(e) => setUserData({ ...userData, nome_completo: e.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={userData.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="O email não pode ser alterado"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex cursor-pointer items-center">
                        <Info className="h-3.5 w-3.5 text-tertiary" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" className="w-60 mb-2 bg-popover shadow-md rounded-lg p-3 text-xs leading-relaxed">
                      <p>
                        Use seu número de contato principal para
                        que os interessados possam falar com você diretamente.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <MaskedInput
                  id="phone"
                  mask="phone"
                  value={userData.telefone}
                  onValueChange={(val) => setUserData({ ...userData, telefone: val })}
                  placeholder="(11) 99999-9999"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={profile?.cpf ? formatarCPF(profile.cpf) : ""}
                  disabled
                  className="bg-muted cursor-not-allowed"
                  title="O CPF não pode ser alterado"
                />
                <p className="text-xs text-muted-foreground">O CPF não pode ser alterado</p>
              </div>
            </div>
            <Button
              onClick={handleSave}
              className="bg-tertiary hover:bg-tertiary/90"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar alterações'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <CreditCard className="h-5 w-5 text-tertiary" aria-hidden="true" />
              Informações da conta
            </CardTitle>
            <CardDescription>
              Detalhes da sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Tipo de conta</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.role === 'admin' ? 'Administrador' : 'Proprietário'}
                  </p>
                </div>
                <Badge variant={profile?.role === 'admin' ? 'default' : 'outline'}>
                  {profile?.role === 'admin' ? 'Admin' : 'Proprietário'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Membro desde</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                      : 'Data não disponível'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Bell className="h-5 w-5 text-tertiary" aria-hidden="true" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure como deseja receber alertas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lembrete de pagamento</p>
                  <p className="text-sm text-muted-foreground">Receba alertas quando o dia do pagamento se aproximar</p>
                </div>
                <Badge variant="outline" className="bg-muted">Em breve</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos contatos</p>
                  <p className="text-sm text-muted-foreground">Seja notificado quando alguém visualizar seu imóvel</p>
                </div>
                <Badge variant="outline" className="bg-muted">Em breve</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/90">
          <CardHeader>
            <CardTitle className="font-display text-red-500">Zona de perigo</CardTitle>
            <CardDescription>
              Ações irreversíveis para sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              A exclusão da sua conta apagará permanentemente todos os seus dados, incluindo imóveis, inquilinos e histórico.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="bg-red-500 hover:bg-red-400">
                  Excluir minha conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita. Isso excluirá permanentemente sua conta
                    e removerá todos os seus dados de nossos servidores.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-500 hover:bg-red-600 focus:ring-red-600"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      'Sim, excluir minha conta'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// =====================================================
// GERENCIAMENTO DE MEMBROS DA FAMÍLIA
// =====================================================
export function MembrosSection() {
  const { user } = useAuth();
  const [membros, setMembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoRole, setNovoRole] = useState("operador");
  const [salvando, setSalvando] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { carregarMembros(); }, []);

  async function carregarMembros() {
    try {
      setLoading(true);
      const { data } = await supabase.from("profiles").select("id, nome_completo, email, role").order("nome_completo");
      setMembros(data || []);
    } finally { setLoading(false); }
  }

  async function convidarMembro() {
    if (!novoEmail || !novoNome || !novaSenha) { toast.error("Preencha todos os campos"); return; }
    try {
      setSalvando(true);
      const res = await fetch("/api/membros/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: novoEmail, nome_completo: novoNome, password: novaSenha, role: novoRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar membro");
      toast.success("Membro adicionado!", { description: `${novoNome} já pode fazer login.` });
      setNovoEmail(""); setNovoNome(""); setNovaSenha(""); setNovoRole("operador");
      setShowForm(false);
      carregarMembros();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setSalvando(false); }
  }

  async function alterarRole(id: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", id);
    toast.success("Perfil atualizado");
    carregarMembros();
  }

  async function removerMembro(id: string) {
    if (id === user?.id) { toast.error("Você não pode remover sua própria conta"); return; }
    const res = await fetch("/api/membros/remover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    if (res.ok) { toast.success("Membro removido"); carregarMembros(); }
    else toast.error("Erro ao remover membro");
  }

  const roleLabel = (r: string) => r === "admin" ? "Administrador" : "Operador";
  const roleBadge = (r: string) => r === "admin"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" /> Membros da família
            </CardTitle>
            <CardDescription>Gerencie quem tem acesso ao sistema</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "+ Adicionar membro"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Formulário novo membro */}
        {showForm && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Novo membro</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome completo</Label>
                <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome do membro" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha inicial</Label>
                <Input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Perfil de acesso</Label>
                <select value={novoRole} onChange={e => setNovoRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="operador">Operador — acesso ao dia a dia</option>
                  <option value="admin">Administrador — acesso total</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={convidarMembro} disabled={salvando}>
                {salvando ? "Criando..." : "Criar acesso"}
              </Button>
            </div>
          </div>
        )}

        {/* Lista de membros */}
        {loading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="divide-y">
            {membros.map(m => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {m.nome_completo?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.nome_completo}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={e => alterarRole(m.id, e.target.value)}
                    disabled={m.id === user?.id}
                    className={`text-xs px-2 py-1 rounded border font-medium ${roleBadge(m.role)} disabled:opacity-50 disabled:cursor-default bg-transparent`}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {m.id !== user?.id && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                      onClick={() => removerMembro(m.id)}>
                      Remover
                    </Button>
                  )}
                  {m.id === user?.id && (
                    <span className="text-xs text-muted-foreground px-2">você</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
