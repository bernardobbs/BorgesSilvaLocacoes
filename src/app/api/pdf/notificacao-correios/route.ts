// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";

function fmtBRL(v:number){return(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function fmtD(iso:string){if(!iso)return"--";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}
function dataExtenso(d:Date){const M=["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return`${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`;}

export async function POST(req: NextRequest) {
  try {
    const { inquilino_id } = await req.json();
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

    const { data: inq } = await supabase.from("inquilinos")
      .select("*, imoveis(titulo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep)")
      .eq("id", inquilino_id).single();
    if (!inq) return NextResponse.json({ error: "Inquilino nao encontrado" }, { status: 404 });

    const { data: comps } = await supabase.from("comprovantes")
      .select("mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento")
      .eq("inquilino_id", inquilino_id).eq("situation", "expired").order("mes_referencia");

    const { data: cfg } = await supabase.from("config_sistema").select("chave, valor")
      .in("chave", ["locador_nome","locador_cpf_cnpj","locador_endereco","locador_telefone","procurador_ativo","procurador_nome","procurador_cpf"]);
    const cfgMap: Record<string,string> = {};
    (cfg||[]).forEach((r:any)=>{ cfgMap[r.chave]=r.valor||""; });

    const im = Array.isArray(inq.imoveis) ? inq.imoveis[0] : inq.imoveis as any;
    const totalDevido = (comps||[]).reduce((s:number,c:any)=>s+(c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0),0);
    const temProc = cfgMap.procurador_ativo==="true" && cfgMap.procurador_nome;
    const locadorNome = cfgMap.locador_nome || "Borges Silva Locacoes";
    const hoje = new Date();

    const doc = new jsPDF({ unit:"mm", format:"a4" });
    const L=20, R=190, W=R-L;
    const linha = (yy:number) => { doc.setDrawColor(200,200,200); doc.line(L,yy,R,yy); };

    // CABECALHO
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(30,30,30);
    doc.text("NOTIFICACAO EXTRAJUDICIAL", 105, 22, {align:"center"});
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100,100,100);
    doc.text("Via postal com Aviso de Recebimento (AR) - Lei 8.245/91", 105, 28, {align:"center"});
    linha(31); linha(32);

    // BLOCO DESTINATARIO (janela do envelope)
    doc.setFillColor(245,245,245); doc.rect(L,35,W,30,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(120,120,120);
    doc.text("DESTINATARIO (janela envelope)", L+3, 40);
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text(inq.nome_completo.toUpperCase(), L+3, 47);
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    const endInq = im ? `${im.endereco_rua||""}, ${im.endereco_numero||""}${im.endereco_bairro ? ` - ${im.endereco_bairro}` : ""}` : "Endereco nao informado";
    const cidInq = im ? `${im.endereco_cidade||"Parnaiba"} - ${im.endereco_estado||"PI"}${im.endereco_cep ? ` - CEP: ${im.endereco_cep}` : ""}` : "";
    doc.text(endInq, L+3, 53);
    if (cidInq) doc.text(cidInq, L+3, 58);
    doc.text(`CPF: ${inq.cpf||"nao informado"}`, L+3, 63);

    // REMETENTE
    doc.setFillColor(30,30,80); doc.rect(L,68,W,14,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(200,200,255);
    doc.text("REMETENTE", L+3, 73);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(255,255,255);
    doc.text(`${locadorNome}${cfgMap.locador_cpf_cnpj ? ` - CPF: ${cfgMap.locador_cpf_cnpj}` : ""}`, L+3, 78);
    doc.text(`${cfgMap.locador_endereco||"Parnaiba - PI"}${cfgMap.locador_telefone ? ` - Tel: ${cfgMap.locador_telefone}` : ""}`, L+3, 82);

    // CORPO
    let y = 95;
    doc.setTextColor(30,30,30); doc.setFont("helvetica","normal"); doc.setFontSize(10);

    const par = (text:string, ind=0) => {
      const lines = doc.splitTextToSize(text, W-ind);
      doc.text(lines, L+ind, y);
      y += lines.length * 5.5;
    };

    doc.setFont("helvetica","bold");
    doc.text(`Parnaiba - PI, ${dataExtenso(hoje)}.`, L, y); y+=10;
    doc.setFont("helvetica","normal");
    par(`Ao Sr(a). ${inq.nome_completo}, CPF ${inq.cpf||"--"}, locatario(a) do imovel ${im?.titulo||""}, localizado na ${endInq}, ${cidInq}.`);
    y+=4;
    par(`Por meio desta NOTIFICACAO EXTRAJUDICIAL, notificamos V.Sa. que constam em aberto as seguintes parcelas de aluguel:`);
    y+=4;

    // TABELA DEBITOS
    doc.setFillColor(240,240,240); doc.rect(L,y-4,W,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text("Referencia", L+2, y);
    doc.text("Vencimento", L+45, y);
    doc.text("Base", L+90, y);
    doc.text("Encargos", L+125, y);
    doc.text("Total", L+162, y);
    y+=5; linha(y); y+=3;
    doc.setFont("helvetica","normal");
    (comps||[]).forEach((c:any)=>{
      const [cy,cm]=c.mes_referencia.split("-");
      const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const t=(c.valor||0)+(c.valor_multa||0)+(c.valor_juros||0);
      doc.text(`${M[parseInt(cm)-1]}/${cy}`,L+2,y);
      doc.text(fmtD(c.data_vencimento),L+45,y);
      doc.text(fmtBRL(c.valor||0),L+90,y);
      doc.text(fmtBRL((c.valor_multa||0)+(c.valor_juros||0)),L+125,y);
      doc.text(fmtBRL(t),L+162,y);
      y+=6;
    });
    linha(y); y+=5;
    doc.setFont("helvetica","bold");
    doc.text(`TOTAL: ${fmtBRL(totalDevido)}`, R, y, {align:"right"}); y+=10;
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    par(`Fica V.Sa. NOTIFICADO(A) a quitar o debito acima no prazo de 30 (trinta) dias corridos a contar do recebimento desta notificacao, sob pena de:`);
    y+=2;
    par(`a) Ajuizamento de Acao de Cobranca (art. 62, I, Lei 8.245/91);`, 5);
    par(`b) Inscricao em orgaos de protecao ao credito (SPC/Serasa);`, 5);
    par(`c) Cobranca de honorarios advocaticios e custas processuais.`, 5);
    y+=6;
    par(`Para regularizacao, entre em contato com o locador dentro do prazo acima.`);
    y+=10;

    // ASSINATURA
    doc.line(50,y+12,160,y+12); y+=16;
    doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text(locadorNome, 105, y, {align:"center"});
    if (cfgMap.locador_cpf_cnpj){
      doc.setFont("helvetica","normal"); doc.setFontSize(8);
      doc.text(`CPF: ${cfgMap.locador_cpf_cnpj}`, 105, y+4, {align:"center"}); y+=4;
    }
    if (temProc){
      y+=5; doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(80,80,80);
      doc.text(`Representado(a) por: ${cfgMap.procurador_nome}${cfgMap.procurador_cpf?` - CPF: ${cfgMap.procurador_cpf}`:""}`, 105, y, {align:"center"}); y+=4;
      doc.text("Procuracao particular", 105, y, {align:"center"});
    }
    y+=5; doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100,100,100);
    doc.text("Locador(a) / Representante Legal", 105, y, {align:"center"});
    y+=14;

    // CAMPO AR RECORTAVEL
    linha(y); y+=5;
    doc.setFontSize(8); doc.setTextColor(80,80,80);
    doc.text("RECORTE AQUI  -  AVISO DE RECEBIMENTO (AR) - GUARDAR PARA FINS DE PROVA", 105, y, {align:"center"}); y+=5;
    doc.setFillColor(252,252,248); doc.rect(L,y,W,26,"FD");
    doc.setFontSize(9); doc.setTextColor(40,40,40);
    doc.text(`Confirmo o recebimento da notificacao extrajudicial referente a:`, L+3, y+6);
    doc.setFont("helvetica","bold");
    doc.text(`Imovel: ${im?.titulo||""}  |  Devedor: ${inq.nome_completo}`, L+3, y+12);
    doc.setFont("helvetica","normal");
    doc.text(`Valor total notificado: ${fmtBRL(totalDevido)}`, L+3, y+17);
    doc.text("Assinatura: _______________________________    Data: ____/____/________", L+3, y+23);

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const safeName = inq.nome_completo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"-");
    const fileName = `${session.user.id}/notificacoes/correios-${Date.now()}-${safeName}.pdf`;
    await supabase.storage.from("imoveis-fotos").upload(fileName, pdfBuffer, {contentType:"application/pdf"});
    const { data: urlData } = supabase.storage.from("imoveis-fotos").getPublicUrl(fileName);

    return NextResponse.json({ success: true, pdfUrl: urlData.publicUrl });
  } catch(err:any){
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
