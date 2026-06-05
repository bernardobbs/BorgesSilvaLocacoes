"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, CheckCircle } from "lucide-react";
import { toast } from "sonner";

function fmtBRL(v: number) { return (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (novoValor: number) => void;
  inquilinoId: string;
  nomeInquilino: string;
  valorAtual: number;
  indiceAtual?: string;
}

export default function ReajusteModal({ open, onClose, onSuccess, inquilinoId, nomeInquilino, valorAtual, indiceAtual = "igpm" }: Props) {
  const [indice, setIndice] = useState(indiceAtual);
  const [percentual, setPercentual] = useState<number | null>(null);
  const [percentualCustom, setPercentualCustom] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fonte, setFonte] = useState("");

  const pct = indice === "fixo"
    ? parseFloat(percentualCustom.replace(",",".")) || 0
    : percentual || 0;
  const novoValor = Math.round(valorAtual * (1 + pct / 100) * 100) / 100;
  const aumento = novoValor - valorAtual;

  useEffect(() => {
    if (open && indice !== "fixo") buscarIndice();
  }, [open, indice]);

  async function buscarIndice() {
    setCarregando(true); setPercentual(null);
    try {
      const res = await fetch(`/api/reajuste/indices?indice=${indice}`);
      const json = await res.json();
      if (json.percentual !== null) {
        setPercentual(json.percentual);
        setFonte(json.referencia || "");
      } else {
        toast.error("Não foi possível buscar o índice", { description: "API do Banco Central indisponível" });
      }
    } catch { toast.error("Erro ao buscar índice"); }
    finally { setCarregando(false); }
  }

  async function aplicar() {
    if (pct <= 0) { toast.error("Percentual inválido"); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/reajuste/aplicar", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ inquilino_id: inquilinoId, valor_novo: novoValor, percentual: pct, indice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Reajuste aplicado!", {
        description: `${nomeInquilino}: ${fmtBRL(valorAtual)} → ${fmtBRL(novoValor)} (+${pct.toFixed(2)}%)`,
      });
      onSuccess(novoValor);
      onClose();
    } catch (e:any) { toast.error("Erro ao aplicar reajuste", { description: e.message }); }
    finally { setSalvando(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Reajuste anual de aluguel
          </CardTitle>
          <p className="text-sm text-muted-foreground">{nomeInquilino}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seletor de índice */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Índice de reajuste</label>
            <Select value={indice} onValueChange={setIndice}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="igpm">IGP-M (FGV) — mais usado em locações</SelectItem>
                <SelectItem value="ipca">IPCA (IBGE) — inflação oficial</SelectItem>
                <SelectItem value="inpc">INPC (IBGE)</SelectItem>
                <SelectItem value="fixo">Percentual fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Percentual */}
          {indice === "fixo" ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Percentual (%)</label>
              <input type="number" min="0" max="100" step="0.01"
                value={percentualCustom} onChange={e => setPercentualCustom(e.target.value)}
                placeholder="Ex: 5,00" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          ) : (
            <div className={`rounded-lg p-3 text-center ${carregando ? "bg-muted" : percentual !== null ? "bg-blue-50 border border-blue-200" : "bg-muted"}`}>
              {carregando ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Buscando no Banco Central...
                </div>
              ) : percentual !== null ? (
                <>
                  <p className="text-3xl font-bold text-blue-700">+{percentual.toFixed(2)}%</p>
                  <p className="text-xs text-blue-600 mt-1">{fonte}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Fonte: Banco Central do Brasil</p>
                </>
              ) : (
                <button onClick={buscarIndice} className="text-sm text-primary underline">Tentar novamente</button>
              )}
            </div>
          )}

          {/* Preview do novo valor */}
          {pct > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor atual</span>
                <span className="font-medium">{fmtBRL(valorAtual)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reajuste ({pct.toFixed(2)}%)</span>
                <span className="font-medium text-blue-600">+{fmtBRL(aumento)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold">Novo valor</span>
                <span className="font-bold text-green-700 text-base">{fmtBRL(novoValor)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={aplicar} disabled={salvando || pct <= 0 || carregando}
              className="gap-2">
              {salvando ? <><Loader2 className="h-4 w-4 animate-spin" />Aplicando...</>
                : <><CheckCircle className="h-4 w-4" />Aplicar reajuste</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
