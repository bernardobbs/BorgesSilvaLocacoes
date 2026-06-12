"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Loader2, User } from "lucide-react";
import { toast } from "sonner";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function RelatoriosPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [baixando, setBaixando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState<string|null>(null);
  const [inquilinos, setInquilinos] = useState<any[]>([]);
  const [carregouInq, setCarregouInq] = useState(false);

  const anos = Array.from({ length: 3 }, (_, i) => hoje.getFullYear() - i);

  async function baixarExcel() {
    setBaixando(true);
    try {
      const mesStr = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      const res = await fetch(`/api/relatorio?mes=${mesStr}`);
      if (!res.ok) { const j=await res.json(); throw new Error(j.error||"Erro"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `relatorio-${MESES[mes]}-${ano}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório baixado!", { description: `${MESES[mes]}/${ano} — 4 abas` });
    } catch (e: any) { toast.error("Erro ao gerar relatório", { description: e.message }); }
    finally { setBaixando(false); }
  }

  async function carregarInquilinos() {
    if (carregouInq) return;
    const supabase = createClient();
    const { data } = await supabase.from("inquilinos")
      .select("id, nome_completo, imoveis(titulo)")
      .eq("status","ativo").order("nome_completo");
    setInquilinos(data||[]);
    setCarregouInq(true);
  }

  async function gerarRelatorioInquilino(id: string) {
    setGerandoPdf(id);
    try {
      const res = await fetch("/api/pdf/relatorio-inquilino", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ inquilino_id: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error||"Erro ao gerar PDF");
      window.open(json.pdfUrl, "_blank");
      toast.success("Relatório gerado!");
    } catch (e: any) { toast.error("Erro", { description: e.message }); }
    finally { setGerandoPdf(null); }
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <DashboardHeader title="Relatórios" subtitle="Exportar dados em Excel ou PDF" />

      {/* Relatório mensal Excel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Relatório mensal — Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <select value={mes} onChange={e=>setMes(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {MESES.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Ano</label>
              <select value={ano} onChange={e=>setAno(Number(e.target.value))}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                {anos.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-muted/40 rounded-lg p-4 grid grid-cols-2 gap-2 text-sm">
            {[{aba:"Resumo",desc:"Financeiro, ocupação e acordos"},{aba:"Pagamentos",desc:"Todos os inquilinos do mês"},{aba:"Inadimplência",desc:"Vencidos com encargos e score"},{aba:"Imóveis",desc:"Status e ocupação por imóvel"}]
              .map(({aba,desc})=>(
              <div key={aba} className="flex items-start gap-2">
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium mt-0.5 shrink-0">{aba}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
          <Button onClick={baixarExcel} disabled={baixando} className="w-full gap-2">
            {baixando ? <><Loader2 className="h-4 w-4 animate-spin"/>Gerando...</> : <><Download className="h-4 w-4"/>Baixar Excel — {MESES[mes]}/{ano}</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Compatível com Excel, Google Sheets e LibreOffice</p>
        </CardContent>
      </Card>

      {/* Relatório por inquilino PDF */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Relatório por inquilino — PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Relatório completo com dados pessoais, histórico financeiro, acordos, cobranças e score de pontualidade.
          </p>
          {!carregouInq ? (
            <Button variant="outline" className="w-full gap-2" onClick={carregarInquilinos}>
              <User className="h-4 w-4"/>Selecionar inquilino
            </Button>
          ) : (
            <div className="divide-y rounded-lg border overflow-hidden">
              {inquilinos.map((inq:any) => {
                const im = Array.isArray(inq.imoveis)?inq.imoveis[0]:inq.imoveis;
                return (
                  <div key={inq.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{inq.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">{im?.titulo}</p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 shrink-0"
                      disabled={gerandoPdf===inq.id}
                      onClick={()=>gerarRelatorioInquilino(inq.id)}>
                      {gerandoPdf===inq.id
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin"/>Gerando...</>
                        : <><FileText className="h-3.5 w-3.5"/>PDF</>}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
