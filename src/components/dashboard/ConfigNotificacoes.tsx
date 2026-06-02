// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown } from "lucide-react";

interface ConfigNotif {
  id: string; ordem: number; dias_atraso: number;
  label: string; mensagem_template: string; ativo: boolean;
}

const VARIAVEIS = [
  ["{{nome}}", "Nome do inquilino"],
  ["{{imovel}}", "Título do imóvel"],
  ["{{mes}}", "Mês de referência"],
  ["{{dias}}", "Dias em atraso"],
  ["{{valor_base}}", "Valor do aluguel"],
  ["{{multa}}", "Valor da multa"],
  ["{{juros}}", "Valor dos juros"],
  ["{{valor_total}}", "Total com encargos"],
  ["{{vencimento}}", "Data de vencimento"],
];

const COR_LABELS = ["","text-yellow-700","text-orange-700","text-red-700","text-red-900","text-red-950"];

export default function ConfigNotificacoes() {
  const [configs, setConfigs] = useState<ConfigNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string|null>(null);
  const [editData, setEditData] = useState<Partial<ConfigNotif>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newData, setNewData] = useState({ dias_atraso: "", label: "", mensagem_template: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    const res = await fetch("/api/notificacoes/config");
    const { data } = await res.json();
    setConfigs(data || []);
    setLoading(false);
  }

  async function salvar(action: string, payload: any) {
    setSalvando(true);
    try {
      const res = await fetch("/api/notificacoes/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(action === "create" ? "Estágio criado!" : action === "delete" ? "Estágio removido!" : "Salvo!");
      carregar();
      setEditId(null); setShowAdd(false);
      setNewData({ dias_atraso: "", label: "", mensagem_template: "" });
    } catch (e: any) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  const insertVar = (v: string, field: "mensagem_template", isNew: boolean) => {
    if (isNew) setNewData(p => ({ ...p, [field]: (p[field]||"") + v }));
    else setEditData(p => ({ ...p, [field]: (p[field]||"") + v }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Estágios de notificação
            </CardTitle>
            <CardDescription>Configure os dias e mensagens de cada estágio de cobrança (2 a 5 estágios)</CardDescription>
          </div>
          {configs.length < 5 && (
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Formulário novo estágio */}
        {showAdd && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Novo estágio</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dias de atraso</Label>
                <Input type="number" min="1" value={newData.dias_atraso}
                  onChange={e => setNewData(p=>({...p,dias_atraso:e.target.value}))} placeholder="Ex: 15" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do estágio</Label>
                <Input value={newData.label}
                  onChange={e => setNewData(p=>({...p,label:e.target.value}))} placeholder="Ex: Cobrança formal" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={newData.mensagem_template}
                onChange={e => setNewData(p=>({...p,mensagem_template:e.target.value}))}
                className="min-h-[100px] font-mono text-xs" placeholder="Use as variáveis abaixo..." />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {VARIAVEIS.map(([v,l]) => (
                  <button key={v} onClick={() => insertVar(v,"mensagem_template",true)}
                    title={l}
                    className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancelar</Button>
              <Button size="sm" disabled={salvando || !newData.dias_atraso || !newData.label || !newData.mensagem_template}
                onClick={() => salvar("create", {
                  ordem: Math.max(...configs.map(c=>c.ordem), 0) + 1,
                  dias_atraso: parseInt(newData.dias_atraso),
                  label: newData.label,
                  mensagem_template: newData.mensagem_template,
                })}>
                {salvando ? "Salvando..." : "Criar estágio"}
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>}

        {configs.map((cfg, idx) => (
          <div key={cfg.id} className="border rounded-lg overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 p-3 bg-muted/20">
              <div className={`text-sm font-semibold min-w-[48px] ${COR_LABELS[idx+1] || COR_LABELS[3]}`}>
                D+{cfg.dias_atraso}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">{cfg.label}</span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {cfg.ativo ? "ativo" : "inativo"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {editId !== cfg.id && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => { setEditId(cfg.id); setEditData({...cfg}); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {configs.filter(c=>c.ativo).length > 2 && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                        onClick={() => salvar("delete", { id: cfg.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
                {editId === cfg.id && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-green-700"
                      disabled={salvando}
                      onClick={() => salvar("update", {
                        id: cfg.id,
                        dias_atraso: editData.dias_atraso,
                        label: editData.label,
                        mensagem_template: editData.mensagem_template,
                        ativo: editData.ativo,
                      })}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => setEditId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Edição */}
            {editId === cfg.id && (
              <div className="p-3 border-t space-y-3 bg-background">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias de atraso</Label>
                    <Input type="number" min="1" value={editData.dias_atraso}
                      onChange={e => setEditData(p=>({...p,dias_atraso:parseInt(e.target.value)}))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do estágio</Label>
                    <Input value={editData.label}
                      onChange={e => setEditData(p=>({...p,label:e.target.value}))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem (suporta *negrito* do WhatsApp)</Label>
                  <Textarea value={editData.mensagem_template}
                    onChange={e => setEditData(p=>({...p,mensagem_template:e.target.value}))}
                    className="min-h-[120px] font-mono text-xs" />
                  <div className="flex flex-wrap gap-1.5">
                    {VARIAVEIS.map(([v,l]) => (
                      <button key={v} onClick={() => insertVar(v,"mensagem_template",false)}
                        title={l}
                        className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id={`ativo-${cfg.id}`} checked={editData.ativo}
                    onChange={e => setEditData(p=>({...p,ativo:e.target.checked}))} />
                  <Label htmlFor={`ativo-${cfg.id}`} className="text-xs font-normal cursor-pointer">Estágio ativo</Label>
                </div>
              </div>
            )}

            {/* Preview mensagem (quando não editando) */}
            {editId !== cfg.id && (
              <div className="px-3 pb-3 pt-1">
                <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed line-clamp-3">
                  {cfg.mensagem_template.substring(0,180)}{cfg.mensagem_template.length>180?"...":""}
                </pre>
              </div>
            )}
          </div>
        ))}

        <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Regras de progressão ativas</p>
          <ul className="space-y-0.5 list-none">
            <li>✓ Estágio N só aparece após estágio N-1 ser enviado</li>
            <li>✓ Notificações pausam automaticamente quando há acordo ativo</li>
            <li>✓ Contagem reinicia por parcela após pagamento parcial</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
