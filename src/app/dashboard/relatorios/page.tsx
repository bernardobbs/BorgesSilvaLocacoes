"use client";
import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function RelatoriosPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [baixando, setBaixando] = useState(false);

  const anos = Array.from({ length: 3 }, (_, i) => hoje.getFullYear() - i);

  async function baixarExcel() {
    setBaixando(true);
    try {
      const mesStr = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      const res = await fetch(`/api/relatorio?mes=${mesStr}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erro ao gerar relatório");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${MESES[mes]}-${ano}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório baixado!", {
        description: `${MESES[mes]}/${ano} — 4 abas: Resumo, Pagamentos, Inadimplência, Imóveis`,
      });
    } catch (e: any) {
      toast.error("Erro ao gerar relatório", { description: e.message });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <DashboardHeader
        title="Relatórios"
        subtitle="Exportar dados do sistema em planilha Excel"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Relatório mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Seletor de período */}
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ano</label>
              <select value={ano} onChange={e => setAno(Number(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* O que está incluído */}
          <div className="bg-muted/40 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conteúdo do relatório</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { aba: "Resumo", desc: "Financeiro, ocupação e acordos" },
                { aba: "Pagamentos", desc: "Todos os inquilinos do mês" },
                { aba: "Inadimplência", desc: "Vencidos com encargos e score" },
                { aba: "Imóveis", desc: "Status e ocupação por imóvel" },
              ].map(({ aba, desc }) => (
                <div key={aba} className="flex items-start gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium mt-0.5 shrink-0">{aba}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={baixarExcel} disabled={baixando} className="w-full gap-2">
            {baixando
              ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando planilha...</>
              : <><Download className="h-4 w-4" />Baixar Excel — {MESES[mes]}/{ano}</>}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Arquivo .xlsx compatível com Excel, Google Sheets e LibreOffice
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
