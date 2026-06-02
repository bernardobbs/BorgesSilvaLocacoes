// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake, CheckCircle2, Clock, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Parcela {
  id: string; numero: number; valor: number;
  data_vencimento: string; situation: string;
  data_pagamento: string | null; forma_pagamento: string | null;
}
interface Acordo {
  id: string; valor_acordo: number; num_parcelas: number;
  status: string; observacoes: string | null;
  inquilinos: any;
  parcelas_acordo: Parcela[];
}

interface Props {
  acordos: Acordo[];
  onPagamento: () => void;
}

function fmtBRL(v: number) { return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtData(iso: string | null) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function AcordosEmAndamento({ acordos, onPagamento }: Props) {
  const [expandido, setExpandido] = useState<string|null>(acordos[0]?.id || null);
  const [pagando, setPagando] = useState<string|null>(null);
  const [forma, setForma] = useState("pix");
  const [dataPag, setDataPag] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const parcProxima = useCallback((acordo: Acordo) => {
    return acordo.parcelas_acordo
      .filter(p => p.situation !== "billed")
      .sort((a,b) => a.numero - b.numero)[0] || null;
  }, []);

  const parcPagas = useCallback((acordo: Acordo) =>
    acordo.parcelas_acordo.filter(p => p.situation === "billed").length, []);

  async function pagarParcela(parcelaId: string, acordoId: string) {
    try {
      setLoading(true);
      const res = await fetch("/api/acordos/pagar-parcela", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcela_id: parcelaId, data_pagamento: dataPag, forma_pagamento: forma }),
      });
      if (!res.ok) throw new Error("Erro ao registrar");
      toast.success("Parcela do acordo registrada!");
      setPagando(null);
      onPagamento();
    } catch { toast.error("Erro ao registrar pagamento"); }
    finally { setLoading(false); }
  }

  if (acordos.length === 0) return null;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Handshake className="h-4 w-4 text-blue-500" />
          Acordos em andamento
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {acordos.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {acordos.map(acordo => {
          const inq = Array.isArray(acordo.inquilinos) ? acordo.inquilinos[0] : acordo.inquilinos;
          const im = Array.isArray(inq?.imoveis) ? inq.imoveis[0] : inq?.imoveis;
          const proxima = parcProxima(acordo);
          const pagas = parcPagas(acordo);
          const isExpanded = expandido === acordo.id;

          return (
            <div key={acordo.id} className="rounded-lg border border-blue-200 bg-white overflow-hidden">
              {/* Header do acordo */}
              <div className="flex items-center justify-between p-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{inq?.nome_completo}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {pagas}/{acordo.num_parcelas} pagas
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{im?.titulo}</p>
                  {proxima && (
                    <p className="text-xs text-blue-700 mt-0.5 font-medium">
                      Próxima: Parcela {proxima.numero} — {fmtBRL(proxima.valor)} · vence {fmtData(proxima.data_vencimento)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {proxima && pagando !== proxima.id && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setPagando(proxima.id)}>
                      Pagar parcela {proxima.numero}
                    </Button>
                  )}
                  <button onClick={() => setExpandido(isExpanded ? null : acordo.id)}
                    className="text-muted-foreground hover:text-foreground p-1">
                    {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                  </button>
                </div>
              </div>

              {/* Form de pagamento */}
              {proxima && pagando === proxima.id && (
                <div className="border-t border-blue-100 bg-blue-50 p-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data</label>
                    <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Forma</label>
                    <Select value={forma} onValueChange={setForma}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => pagarParcela(proxima.id, acordo.id)} disabled={loading}>
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : "Confirmar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPagando(null)} disabled={loading}>✕</Button>
                  </div>
                </div>
              )}

              {/* Detalhes expandidos */}
              {isExpanded && (
                <div className="border-t border-blue-100 p-3 space-y-1.5">
                  {acordo.parcelas_acordo
                    .sort((a,b) => a.numero - b.numero)
                    .map(p => {
                      const Icon = p.situation === "billed" ? CheckCircle2
                        : p.situation === "expired" ? AlertCircle : Clock;
                      const cls = p.situation === "billed" ? "text-green-600"
                        : p.situation === "expired" ? "text-red-600" : "text-blue-600";
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-blue-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 ${cls}`} />
                            <span className="font-medium">Parcela {p.numero}</span>
                            <span className="text-muted-foreground">{fmtData(p.data_vencimento)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">{fmtBRL(p.valor)}</span>
                            {p.situation === "billed" && (
                              <span className="text-green-600">pago {fmtData(p.data_pagamento)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {acordo.observacoes && (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-blue-100">
                      📝 {acordo.observacoes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-center text-muted-foreground">
          Parcelas de aluguel cobertas pelo acordo aparecem marcadas como "Em acordo" na lista abaixo.
        </p>
      </CardContent>
    </Card>
  );
}
