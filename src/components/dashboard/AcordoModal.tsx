// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Handshake, Calendar, DollarSign } from "lucide-react";

interface Comprovante {
  id: string; mes_referencia: string; valor: number;
  valor_multa: number; valor_juros: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inquilinoId: string;
  imovelId: string;
  nomeInquilino: string;
  imovelTitulo: string;
  comprovantesVencidos: Comprovante[];
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function mesLabel(iso: string) {
  const [y, m] = iso.split("-");
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${M[parseInt(m)-1]}/${y}`;
}

export default function AcordoModal({ open, onClose, onSuccess, inquilinoId, imovelId, nomeInquilino, imovelTitulo, comprovantesVencidos }: Props) {
  const totalOriginal = comprovantesVencidos.reduce((s, c) => s + (c.valor||0) + (c.valor_multa||0) + (c.valor_juros||0), 0);

  const [desconto, setDesconto] = useState("0");
  const [numParcelas, setNumParcelas] = useState("2");
  const [primeiraParcela, setPrimeiraParcela] = useState(() => {
    const d = new Date(); d.setDate(10);
    if (d < new Date()) d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const descontoVal = parseFloat(desconto) || 0;
  const valorAcordo = Math.max(0, totalOriginal - descontoVal);
  const n = parseInt(numParcelas) || 1;
  const valorParcela = valorAcordo / n;

  const previewParcelas = useMemo(() => {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(primeiraParcela + "T12:00:00");
      d.setMonth(d.getMonth() + i);
      const isLast = i === n - 1;
      const val = isLast ? parseFloat((valorAcordo - valorParcela * (n - 1)).toFixed(2)) : valorParcela;
      return { numero: i + 1, vencimento: d.toLocaleDateString("pt-BR"), valor: val };
    });
  }, [n, primeiraParcela, valorAcordo, valorParcela]);

  async function confirmar() {
    if (!primeiraParcela) { toast.error("Informe a data da primeira parcela"); return; }
    try {
      setSalvando(true);
      const res = await fetch("/api/acordos/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquilino_id: inquilinoId,
          imovel_id: imovelId,
          valor_original: totalOriginal,
          valor_acordo: valorAcordo,
          desconto: descontoVal,
          num_parcelas: n,
          valor_parcela: parseFloat(valorParcela.toFixed(2)),
          primeira_parcela: primeiraParcela,
          meses_cobertos: comprovantesVencidos.map(c => c.mes_referencia),
          observacoes: obs || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Acordo registrado!", { description: `${n} parcelas de ${fmtBRL(valorParcela)}` });
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao registrar acordo", { description: e.message });
    } finally { setSalvando(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-blue-500" />
            Registrar acordo
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {nomeInquilino} · {imovelTitulo}
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Dívida original */}
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Dívida original</p>
            {comprovantesVencidos.map(c => (
              <div key={c.id} className="flex justify-between text-sm">
                <span className="text-red-700">{mesLabel(c.mes_referencia)}</span>
                <span className="font-medium text-red-800">{fmtBRL((c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0))}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t border-red-300 pt-1 mt-1">
              <span className="text-red-800">Total</span>
              <span className="text-red-900">{fmtBRL(totalOriginal)}</span>
            </div>
          </div>

          {/* Condições do acordo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Desconto concedido</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input value={desconto} onChange={e => setDesconto(e.target.value.replace(/[^0-9.,]/g,""))}
                  className="pl-8" placeholder="0,00" />
              </div>
              <p className="text-xs text-muted-foreground">Valor negociado: <strong>{fmtBRL(valorAcordo)}</strong></p>
            </div>
            <div className="space-y-1.5">
              <Label>Número de parcelas</Label>
              <Select value={numParcelas} onValueChange={setNumParcelas}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,6,12].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} {n===1?"parcela":"parcelas"} de {fmtBRL(valorAcordo/n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Data da 1ª parcela</Label>
              <input type="date" value={primeiraParcela} onChange={e => setPrimeiraParcela(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Preview das parcelas */}
          <div className="rounded-lg border bg-blue-50 border-blue-200 overflow-hidden">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide px-3 py-2 border-b border-blue-200">
              Plano de pagamento
            </p>
            <table className="w-full text-sm">
              <tbody>
                {previewParcelas.map(p => (
                  <tr key={p.numero} className="border-b border-blue-100 last:border-0">
                    <td className="px-3 py-2 text-blue-700 font-medium">Parcela {p.numero}</td>
                    <td className="px-3 py-2 text-blue-600">{p.vencimento}</td>
                    <td className="px-3 py-2 text-blue-800 font-semibold text-right">{fmtBRL(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <Label>Observações do acordo</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: inquilino vai pagar todo dia 10, ficou acordado verbalmente em 02/06..." className="min-h-[60px]" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={confirmar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Registrando...</> : "Confirmar acordo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
