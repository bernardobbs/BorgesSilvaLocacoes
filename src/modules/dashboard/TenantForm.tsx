// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MaskedInput } from "@/components/dashboard/MaskedInput";
import { CurrencyInput } from "@/components/dashboard/CurrencyInput";
import { useFormFormatting } from "@/lib/hooks/useFormFormatting";
import { ArrowLeft, Upload, X, User, Calendar, FileText, Building2, Loader2, Shield } from "lucide-react";

interface TenantFormData {
  name: string; cpf: string; rg: string; phone: string; email: string;
  rentDay: string; startDate: Date | undefined; endDate: Date | undefined;
  rentValue: string; observations: string;
  multaPercentual: string; jurosPercentual: string; correcaoMonetaria: string;
  garantia: string; numeroContrato: string;
}

const initial: TenantFormData = {
  name: "", cpf: "", rg: "", phone: "", email: "",
  rentDay: "10", startDate: undefined, endDate: undefined,
  rentValue: "", observations: "",
  multaPercentual: "10", jurosPercentual: "1", correcaoMonetaria: "igpm",
  garantia: "nenhuma", numeroContrato: "",
};

interface PropertyData { id: string; titulo: string; endereco_rua: string; endereco_numero: string; valor_aluguel: number; }

export default function TenantForm() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const { formatarCPF, formatarTelefone, parseMoeda } = useFormFormatting();
  const isEditMode = pathname?.includes("/editar");
  const isRegistrationMode = pathname?.includes("/inquilino") && !isEditMode;

  const [formData, setFormData] = useState<TenantFormData>(initial);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [tenantId] = useState<string | null>(isEditMode ? id : null);
  const [propertyId, setPropertyId] = useState<string | null>(isRegistrationMode ? id : null);
  const [contractPhotos, setContractPhotos] = useState<File[]>([]);
  const [contractPreviews, setContractPreviews] = useState<string[]>([]);
  const [existingContractPhotos, setExistingContractPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isEditMode && id) loadTenantData(id);
    else if (isRegistrationMode && id) loadPropertyDetails(id);
  }, [id, isEditMode, isRegistrationMode]);

  const set = (field: keyof TenantFormData, value: any) =>
    setFormData(p => ({ ...p, [field]: value }));

  const loadTenantData = async (tid: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("inquilinos")
        .select("*, imoveis(id, titulo, endereco_rua, endereco_numero, valor_aluguel)")
        .eq("id", tid).single();
      if (error) throw error;
      if (data) {
        setFormData({
          name: data.nome_completo, cpf: formatarCPF(data.cpf || ""),
          rg: data.rg || "", phone: formatarTelefone(data.telefone),
          email: data.email || "", rentDay: data.dia_vencimento.toString(),
          startDate: data.data_inicio ? new Date(data.data_inicio) : undefined,
          endDate: data.data_fim ? new Date(data.data_fim) : undefined,
          rentValue: data.valor_aluguel.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          observations: data.observacoes || "",
          multaPercentual: data.multa_percentual?.toString() || "10",
          jurosPercentual: data.juros_percentual?.toString() || "1",
          correcaoMonetaria: data.correcao_monetaria || "igpm",
          garantia: data.garantia || "nenhuma",
          numeroContrato: data.numero_contrato || "",
        });
        setExistingContractPhotos(data.fotos_contrato || []);
        setPropertyId(data.imovel_id);
        if (data.imoveis) setProperty(Array.isArray(data.imoveis) ? data.imoveis[0] : data.imoveis);
      }
    } catch { toast.error("Erro ao carregar dados"); }
    finally { setIsLoading(false); }
  };

  const loadPropertyDetails = async (pid: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("imoveis").select("id, titulo, endereco_rua, endereco_numero, valor_aluguel")
        .eq("id", pid).single();
      if (error) throw error;
      if (data) {
        setProperty(data);
        setFormData(p => ({ ...p, rentValue: data.valor_aluguel.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) }));
      }
    } catch { toast.error("Erro ao carregar imóvel"); }
    finally { setIsLoading(false); }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setContractPhotos(p => [...p, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onloadend = () => setContractPreviews(p => [...p, reader.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeNewPhoto = (i: number) => {
    setContractPhotos(p => p.filter((_, j) => j !== i));
    setContractPreviews(p => p.filter((_, j) => j !== i));
  };

  const removeExistingPhoto = (url: string) =>
    setExistingContractPhotos(p => p.filter(u => u !== url));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!formData.phone.trim()) { toast.error("Telefone obrigatório"); return; }
    if (!formData.startDate) { toast.error("Data de início obrigatória"); return; }
    if (!formData.rentValue) { toast.error("Valor do aluguel obrigatório"); return; }

    try {
      setIsSubmitting(true);
      const { data: { session }, error: se } = await supabase.auth.getSession();
      if (se || !session) { toast.error("Sessão expirada. Faça login novamente."); return; }

      const rentAmount = parseMoeda(formData.rentValue);
      const tenantData: any = {
        nome_completo: formData.name.trim(),
        cpf: formData.cpf.replace(/\D/g, ""),
        rg: formData.rg,
        telefone: formData.phone.replace(/\D/g, ""),
        email: formData.email || null,
        dia_vencimento: parseInt(formData.rentDay),
        data_inicio: formData.startDate ? new Date(formData.startDate.getTime() - formData.startDate.getTimezoneOffset() * 60000).toISOString().split("T")[0] : null,
        data_fim: formData.endDate ? new Date(formData.endDate.getTime() - formData.endDate.getTimezoneOffset() * 60000).toISOString().split("T")[0] : null,
        valor_aluguel: rentAmount,
        observacoes: formData.observations || null,
        multa_percentual: parseFloat(formData.multaPercentual) || 10,
        juros_percentual: parseFloat(formData.jurosPercentual) || 1,
        correcao_monetaria: formData.correcaoMonetaria,
        garantia: formData.garantia,
        numero_contrato: formData.numeroContrato || null,
        status: "ativo",
        fotos_contrato: [] as string[],
      };

      // Upload fotos de contrato
      const uploadedUrls: string[] = [];
      if (user && propertyId) {
        for (const photo of contractPhotos) {
          const ext = photo.name.split(".").pop();
          const fileName = `${user.id}/${propertyId}/contracts/${Date.now()}-${Math.random()}.${ext}`;
          const { error: ue } = await supabase.storage.from("imoveis-fotos").upload(fileName, photo);
          if (ue) throw ue;
          const { data: { publicUrl } } = supabase.storage.from("imoveis-fotos").getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }
      tenantData.fotos_contrato = [...existingContractPhotos, ...uploadedUrls];

      if (isEditMode && tenantId) {
        const { error } = await supabase.from("inquilinos").update(tenantData).eq("id", tenantId);
        if (error) throw error;
        toast.success("Inquilino atualizado com sucesso!");
      } else {
        const { error: te } = await supabase.from("inquilinos").insert({ ...tenantData, imovel_id: propertyId }).select().single();
        if (te) throw te;
        await supabase.from("imoveis").update({ status: "alugado" }).eq("id", propertyId);
        toast.success("Inquilino cadastrado com sucesso!");
      }

      router.push("/dashboard/inquilinos");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar", { description: err?.message || "Verifique os dados e tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/dashboard/inquilinos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />Voltar
        </Link>
        <h1 className="text-2xl font-semibold">{isEditMode ? "Editar inquilino" : "Novo inquilino"}</h1>
        {property && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {property.titulo} — {property.endereco_rua}, {property.endereco_numero}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Dados pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" />Dados do inquilino</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={formData.name} onChange={e => set("name", e.target.value)} placeholder="Nome do inquilino" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <MaskedInput mask="cpf" value={formData.cpf} onValueChange={v => set("cpf", v)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-1.5">
                <Label>RG</Label>
                <Input value={formData.rg} onChange={e => set("rg", e.target.value)} placeholder="00.000.000-0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <MaskedInput mask="phone" value={formData.phone} onValueChange={v => set("phone", v)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={formData.email} onChange={e => set("email", e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados da locação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" />Dados da locação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valor do aluguel *</Label>
                <CurrencyInput value={formData.rentValue} onValueChange={v => set("rentValue", v)} placeholder="R$ 0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Dia do vencimento *</Label>
                <Select value={formData.rentDay} onValueChange={v => set("rentDay", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,5,10,15,20,25,30].map(d => (
                      <SelectItem key={d} value={d.toString()}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de início *</Label>
                <DatePicker date={formData.startDate} onDateChange={d => set("startDate", d)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de término <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <DatePicker date={formData.endDate} onDateChange={d => set("endDate", d)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encargos por atraso */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Encargos por atraso</CardTitle>
            <CardDescription>Valores aplicados automaticamente nos recibos em atraso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Multa por atraso *</Label>
                <div className="relative">
                  <Input value={formData.multaPercentual} onChange={e => set("multaPercentual", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="10" className="pr-7" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Sobre o valor do aluguel</p>
              </div>
              <div className="space-y-1.5">
                <Label>Juros por atraso *</Label>
                <div className="relative">
                  <Input value={formData.jurosPercentual} onChange={e => set("jurosPercentual", e.target.value.replace(/[^0-9.]/g, ""))} placeholder="1" className="pr-14" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">%/mês</span>
                </div>
                <p className="text-xs text-muted-foreground">Pro rata die</p>
              </div>
              <div className="space-y-1.5">
                <Label>Correção monetária</Label>
                <Select value={formData.correcaoMonetaria} onValueChange={v => set("correcaoMonetaria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="igpm">IGP-M</SelectItem>
                    <SelectItem value="ipca">IPCA</SelectItem>
                    <SelectItem value="inpc">INPC</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Garantia locatícia */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Garantia locatícia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de garantia</Label>
              <Select value={formData.garantia} onValueChange={v => set("garantia", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Sem garantia</SelectItem>
                  <SelectItem value="caucao">Caução (depósito caução)</SelectItem>
                  <SelectItem value="pagamento_adiantado">Pagamento adiantado</SelectItem>
                  <SelectItem value="fiador">Fiador</SelectItem>
                  <SelectItem value="seguro_fianca">Seguro fiança</SelectItem>
                  <SelectItem value="titulo_capitalizacao">Título de capitalização</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Contrato e observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Número do contrato <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input value={formData.numeroContrato} onChange={e => set("numeroContrato", e.target.value)} placeholder="Ex: CT-2025-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={formData.observations} onChange={e => set("observations", e.target.value)} placeholder="Observações sobre o inquilino ou a locação..." className="min-h-[80px]" />
            </div>

            {/* Fotos do contrato */}
            <div className="space-y-2">
              <Label>Fotos do contrato assinado <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  <span>Clique para anexar · JPG, PNG ou PDF · máx. 10MB</span>
                </div>
                <input type="file" multiple accept="image/*,.pdf" onChange={handlePhotoChange} className="hidden" />
              </label>
              {(existingContractPhotos.length > 0 || contractPreviews.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingContractPhotos.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                      <button type="button" onClick={() => removeExistingPhoto(url)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                  {contractPreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="h-16 w-16 object-cover rounded border" />
                      <button type="button" onClick={() => removeNewPhoto(i)} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/inquilinos">
            <Button type="button" variant="outline">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : isEditMode ? "Salvar alterações" : "Cadastrar inquilino"}
          </Button>
        </div>
      </form>
    </div>
  );
}
