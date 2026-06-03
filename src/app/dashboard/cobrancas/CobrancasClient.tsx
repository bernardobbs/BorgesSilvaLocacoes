// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Search, Bell } from "lucide-react";

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtDataHora(iso: string) {
  const [date, time] = iso.split("T");
  const [y,m,d] = date.split("-");
  return `${d}/${m}/${y} ${time?.slice(0,5)||""}`;
}
function mesLabel(iso: string) {
  if (!iso) return "—";
  const [y,mo] = iso.split("-");
  const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[parseInt(mo)-1]}/${y}`;
}

const ESTAGIO_COLOR: Record<number,string> = {
  1: "bg-yellow-100 text-yellow-800 border-yellow-200",
  2: "bg-orange-100 text-orange-800 border-orange-200",
  3: "bg-red-100 text-red-800 border-red-200",
};

export default function CobrancasClient({ cobrancas }: { cobrancas: any[] }) {
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("todos");

  const filtradas = useMemo(() => {
    return cobrancas.filter(c => {
      const inq = Array.isArray(c.inquilinos) ? c.inquilinos[0] : c.inquilinos;
      const cfg = Array.isArray(c.config_notificacoes) ? c.config_notificacoes[0] : c.config_notificacoes;
      const nome = inq?.nome_completo?.toLowerCase() || "";
      const label = cfg?.label?.toLowerCase() || "";
      const matchBusca = !busca || nome.includes(busca.toLowerCase()) || label.includes(busca.toLowerCase());
      const matchEstagio = filtroEstagio === "todos" || String(c.estagio) === filtroEstagio;
      return matchBusca && matchEstagio;
    });
  }, [cobrancas, busca, filtroEstagio]);

  // Sumário
  const totalEnviados = cobrancas.length;
  const estSet = new Set(cobrancas.map(c => c.estagio));
  const estagios = [...estSet].sort();

  return (
    <div className="space-y-6 p-6">
      <DashboardHeader
        title="Registro de cobranças"
        subtitle={`${totalEnviados} notificações enviadas via WhatsApp`}
      />

      {/* Sumário por estágio */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(e => {
          const n = cobrancas.filter(c => c.estagio === e).length;
          const cfg = cobrancas.find(c => {
            const cc = Array.isArray(c.config_notificacoes) ? c.config_notificacoes[0] : c.config_notificacoes;
            return c.estagio === e && cc?.label;
          });
          const label = cfg
            ? (Array.isArray(cfg.config_notificacoes) ? cfg.config_notificacoes[0] : cfg.config_notificacoes)?.label
            : `Estágio ${e}`;
          return (
            <div key={e} className={`rounded-lg border p-3 ${ESTAGIO_COLOR[e]||ESTAGIO_COLOR[3]}`}>
              <p className="text-xs font-medium">{label || `Estágio ${e}`}</p>
              <p className="text-2xl font-semibold mt-1">{n}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por inquilino..." className="pl-9" />
        </div>
        <Select value={filtroEstagio} onValueChange={setFiltroEstagio}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estágios</SelectItem>
            <SelectItem value="1">Estágio 1</SelectItem>
            <SelectItem value="2">Estágio 2</SelectItem>
            <SelectItem value="3">Estágio 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtradas.map((c: any) => {
                const inq = Array.isArray(c.inquilinos) ? c.inquilinos[0] : c.inquilinos;
                const im = Array.isArray(inq?.imoveis) ? inq.imoveis[0] : inq?.imoveis;
                const cfg = Array.isArray(c.config_notificacoes) ? c.config_notificacoes[0] : c.config_notificacoes;
                const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
                const cor = ESTAGIO_COLOR[c.estagio] || ESTAGIO_COLOR[3];
                return (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Estágio */}
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border shrink-0 ${cor}`}>
                      {cfg?.label || `D+${cfg?.dias_atraso || c.dias_atraso}`}
                    </span>

                    {/* Inquilino */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/inquilinos/${inq?.id}`}
                        className="font-medium text-sm hover:text-primary hover:underline">
                        {inq?.nome_completo || "—"}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        {im?.titulo} · ref. {mesLabel(c.mes_referencia)}
                        {prof?.nome_completo && ` · por ${prof.nome_completo}`}
                      </p>
                    </div>

                    {/* Atraso */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-red-600">{fmtBRL(c.valor_total)}</p>
                      <p className="text-xs text-muted-foreground">D+{c.dias_atraso}</p>
                    </div>

                    {/* Data */}
                    <div className="text-right shrink-0 hidden md:block">
                      <p className="text-xs text-muted-foreground">{fmtDataHora(c.enviado_em)}</p>
                    </div>

                    {/* WA */}
                    <MessageCircle className="h-4 w-4 text-[#25D366] shrink-0" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
