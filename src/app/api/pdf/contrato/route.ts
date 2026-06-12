// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";

function fmtBRL(v:number){return(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function fmtD(iso:string|null){if(!iso)return"___/___/______";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;}
function extenso(n:number):string{const u=["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];const d=["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];if(n<20)return u[n];if(n<100)return d[Math.floor(n/10)]+(n%10?` e ${u[n%10]}`:"");return"";}
function dataExtenso(d:Date){const M=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return`${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`;}
function nomeMes(n:number){const M=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];return M[n];}

export async function POST(req: NextRequest) {
  try {
    const { inquilino_id } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: inq } = await supabase.from("inquilinos").select(`
      *, imoveis(titulo, tipo, endereco_rua, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
        locador_nome, locador_cpf_cnpj, locador_telefone, do_center, numero_unidade)
    `).eq("id", inquilino_id).single();
    if (!inq) return NextResponse.json({ error: "Inquilino não encontrado" }, { status: 404 });

    const { data: cfg } = await supabase.from("config_sistema").select("chave, valor")
      .in("chave", ["locador_nome","locador_cpf_cnpj","locador_endereco","locador_telefone","locador_email","procurador_ativo","procurador_nome","procurador_cpf"]);
    const cfgMap: Record<string,string> = {};
    (cfg||[]).forEach((r:any)=>{ cfgMap[r.chave]=r.valor||""; });

    const im = Array.isArray(inq.imoveis) ? inq.imoveis[0] : inq.imoveis as any;
    const locadorNome = im?.locador_nome || cfgMap.locador_nome || "Locador";
    const locadorDoc  = im?.locador_cpf_cnpj || cfgMap.locador_cpf_cnpj || "";
    const locadorEnd  = cfgMap.locador_endereco || "Parnaíba – PI";
    const locadorTel  = im?.locador_telefone || cfgMap.locador_telefone || "";
    const temProc     = cfgMap.procurador_ativo === "true" && cfgMap.procurador_nome;
    const procNome    = cfgMap.procurador_nome || "";
    const procCPF     = cfgMap.procurador_cpf  || "";
    const hoje        = new Date();
    const imovelEnd   = im ? `${im.endereco_rua||""}, ${im.endereco_numero||""}${im.endereco_complemento?`, ${im.endereco_complemento}`:""}${im.endereco_bairro?`, ${im.endereco_bairro}`:""}` : "";
    const imovelCid   = im ? `${im.endereco_cidade||"Parnaíba"} – ${im.endereco_estado||"PI"}${im.endereco_cep?`, CEP ${im.endereco_cep}`:""}` : "";
    const valorMensal = (inq.valor_aluguel || 0) + (inq.valor_condominio || 0);
    const valorExtenso = `${fmtBRL(valorMensal)} (${extenso(Math.floor(valorMensal))} reais${valorMensal % 1 > 0 ? ` e ${Math.round((valorMensal%1)*100)} centavos` : ""})`;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const L = 20, R = 190, W = R - L;
    let y = 0;

    const checkPage = (need = 12) => {
      if (y + need > 275) { doc.addPage(); y = 20; }
    };

    const linha = () => { doc.setDrawColor(200); doc.line(L, y, R, y); y += 2; };

    const titulo = (t: string) => {
      checkPage(14);
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(30,30,80);
      doc.text(t.toUpperCase(), L, y); y += 6; linha();
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
    };

    const par = (text: string, indent = 0, bold = false) => {
      checkPage();
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, W - indent);
      doc.text(lines, L + indent, y);
      y += lines.length * 5.2;
    };

    const campo = (label: string, val: string) => {
      checkPage();
      doc.setFont("helvetica","bold"); doc.setFontSize(9);
      doc.text(label, L, y);
      doc.setFont("helvetica","normal");
      doc.text(val, L + 45, y);
      y += 5.5;
    };

    // ── CABEÇALHO ──
    y = 20;
    doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.setTextColor(30,30,80);
    doc.text("CONTRATO DE LOCAÇÃO DE IMÓVEL", 105, y, {align:"center"}); y += 7;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(100);
    const tipoContrato = im?.tipo === "residencial" ? "RESIDENCIAL" : "COMERCIAL/NÃO RESIDENCIAL";
    doc.text(`${tipoContrato} — Lei nº 8.245, de 18 de outubro de 1991`, 105, y, {align:"center"}); y += 5;
    doc.setFillColor(30,30,80); doc.rect(L, y, W, 0.5, "F"); y += 6;

    // ── QUALIFICAÇÃO DAS PARTES ──
    titulo("CLÁUSULA 1ª — DAS PARTES");
    par(`LOCADOR(A): ${locadorNome}${locadorDoc ? `, CPF/CNPJ: ${locadorDoc}` : ""}, residente em ${locadorEnd}${locadorTel ? `, telefone: ${locadorTel}` : ""}.`); y += 2;
    if (temProc) {
      par(`Representado(a) por: ${procNome}${procCPF ? `, CPF: ${procCPF}` : ""}, na qualidade de procurador(a) por procuração particular.`); y += 2;
    }
    par(`LOCATÁRIO(A): ${inq.nome_completo}${inq.cpf ? `, CPF: ${inq.cpf}` : ""}${inq.rg ? `, RG: ${inq.rg}` : ""}${inq.telefone ? `, telefone: ${inq.telefone}` : ""}${inq.email ? `, e-mail: ${inq.email}` : ""}.`); y += 4;

    // ── OBJETO ──
    titulo("CLÁUSULA 2ª — DO OBJETO");
    par(`O(A) LOCADOR(A) cede em locação ao(à) LOCATÁRIO(A) o imóvel ${im?.tipo || ""}${im?.do_center ? ` denominado "${im.titulo}"` : ` situado à ${imovelEnd}`}, ${imovelCid}, conforme descrição e características constantes da matrícula do imóvel.`); y += 4;

    // ── PRAZO ──
    titulo("CLÁUSULA 3ª — DO PRAZO");
    const dataInicio = inq.data_inicio || hoje.toISOString().split("T")[0];
    const dataFim = inq.data_fim;
    par(`A locação tem prazo ${dataFim ? `determinado de ${fmtD(dataInicio)} a ${fmtD(dataFim)}` : `indeterminado, com início em ${fmtD(dataInicio)}`}, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias, nos termos do art. 46 e seguintes da Lei nº 8.245/91.`); y += 4;

    // ── VALOR ──
    titulo("CLÁUSULA 4ª — DO ALUGUEL E CONDIÇÕES DE PAGAMENTO");
    par(`O aluguel mensal é de ${fmtBRL(inq.valor_aluguel || 0)}${inq.valor_condominio ? `, acrescido de condomínio no valor de ${fmtBRL(inq.valor_condominio)}, totalizando ${valorExtenso}` : ` (${valorExtenso})`}, a ser pago até o dia ${inq.dia_vencimento} (${extenso(inq.dia_vencimento) || inq.dia_vencimento}) de cada mês.`); y += 2;
    par(`O pagamento deverá ser efetuado ao(à) LOCADOR(A) ou seu representante legal, mediante ${["pix","transferência bancária","depósito bancário"].join(", ")} ou outro meio acordado entre as partes.`); y += 2;
    par(`§ 1º — O atraso no pagamento sujeitará o(a) LOCATÁRIO(A) a multa de ${inq.multa_percentual || 10}% (${extenso(inq.multa_percentual || 10)} por cento) sobre o valor do débito, acrescida de juros moratórios de ${inq.juros_percentual || 1}% (${extenso(inq.juros_percentual || 1)} por cento) ao mês, conforme art. 23, inciso I, da Lei nº 8.245/91.`); y += 2;
    par(`§ 2º — O aluguel será reajustado anualmente pelo índice ${inq.indice_reajuste === "ipca" ? "IPCA/IBGE" : inq.indice_reajuste === "inpc" ? "INPC/IBGE" : "IGP-M/FGV"} ou por outro índice que vier a substituí-lo, nos termos da legislação vigente.`); y += 4;

    // ── GARANTIA ──
    titulo("CLÁUSULA 5ª — DA GARANTIA LOCATÍCIA");
    const garantiaTextos: Record<string,string> = {
      fiador: `Para garantia das obrigações assumidas neste contrato, o(a) LOCATÁRIO(A) apresenta como fiador(a): ${inq.fiador_nome || "__________________"}, CPF: ${inq.fiador_cpf || "__________________"}, residente em ${inq.fiador_endereco || "__________________"}, nos termos do art. 37, inciso II, da Lei nº 8.245/91.`,
      caucao: `Para garantia das obrigações assumidas neste contrato, o(a) LOCATÁRIO(A) deposita caução equivalente a ${inq.caucao_meses || 3} (${extenso(inq.caucao_meses || 3)}) aluguéis, no valor de ${fmtBRL((inq.valor_aluguel||0)*(inq.caucao_meses||3))}, nos termos do art. 37, inciso I, da Lei nº 8.245/91.`,
      seguro: `Para garantia das obrigações assumidas neste contrato, o(a) LOCATÁRIO(A) contrata seguro fiança junto à seguradora ${inq.seguro_nome || "__________________"}, apólice nº ${inq.seguro_apolice || "__________________"}, nos termos do art. 37, inciso III, da Lei nº 8.245/91.`,
      adiantado: `Para garantia das obrigações assumidas neste contrato, aplica-se a modalidade de pagamento antecipado (aluguel mês a mês adiantado), nos termos do art. 37, inciso IV, da Lei nº 8.245/91.`,
      titulo: `Para garantia das obrigações assumidas neste contrato, o(a) LOCATÁRIO(A) cede títulos de capitalização no valor de ${fmtBRL(valorMensal * (inq.titulo_meses || 3))}, nos termos do art. 37, inciso IV, da Lei nº 8.245/91.`,
      nenhuma: `As partes acordam que a presente locação será realizada sem garantia locatícia, nos termos da Lei nº 8.245/91.`,
    };
    par(garantiaTextos[inq.garantia || "nenhuma"] || garantiaTextos["nenhuma"]); y += 4;

    // ── OBRIGAÇÕES DO LOCATÁRIO ──
    titulo("CLÁUSULA 6ª — DAS OBRIGAÇÕES DO LOCATÁRIO");
    const obrigacoes = [
      "Pagar pontualmente o aluguel e encargos, nos termos desta avença (art. 23, I, da Lei nº 8.245/91);",
      "Usar o imóvel para o fim a que se destina, zelando por sua conservação (art. 23, II e IV);",
      "Restituir o imóvel no estado em que o recebeu, salvo desgaste natural (art. 23, III);",
      "Não sublocar, ceder ou emprestar o imóvel sem consentimento expresso do(a) LOCADOR(A) (art. 13);",
      "Comunicar ao(à) LOCADOR(A) qualquer dano ou defeito no imóvel (art. 23, IV);",
      "Realizar os pequenos reparos decorrentes do uso normal do imóvel (art. 23, X).",
    ];
    obrigacoes.forEach((o, i) => { par(`${i+1}. ${o}`, 3); });
    y += 2;

    // ── OBRIGAÇÕES DO LOCADOR ──
    titulo("CLÁUSULA 7ª — DAS OBRIGAÇÕES DO LOCADOR");
    const obrigLocador = [
      "Entregar o imóvel em condições de uso e habitabilidade (art. 22, I, da Lei nº 8.245/91);",
      "Garantir o uso pacífico do imóvel pelo locatário durante a locação (art. 22, II);",
      "Responder pelos vícios ou defeitos anteriores à locação (art. 22, IV);",
      "Fornecer recibo discriminado das importâncias recebidas (art. 22, VI).",
    ];
    obrigLocador.forEach((o, i) => { par(`${i+1}. ${o}`, 3); });
    y += 2;

    // ── RESCISÃO ──
    titulo("CLÁUSULA 8ª — DA RESCISÃO");
    par(`O descumprimento de qualquer cláusula deste contrato ensejará sua rescisão, podendo o(a) LOCADOR(A) ajuizar ação de despejo por infração contratual e/ou cobrança dos valores devidos, conforme arts. 9º e 62 da Lei nº 8.245/91.`); y += 2;
    par(`A rescisão antecipada pelo(a) LOCATÁRIO(A), antes do término do prazo contratual, sujeitará ao pagamento de multa compensatória de ${inq.multa_percentual || 10}% (${extenso(inq.multa_percentual || 10)} por cento) sobre o valor do aluguel restante, calculada proporcionalmente ao período faltante.`); y += 4;

    // ── DISPOSIÇÕES GERAIS ──
    titulo("CLÁUSULA 9ª — DAS DISPOSIÇÕES GERAIS");
    par(`As alterações deste contrato somente terão validade se formalizadas por escrito e assinadas por ambas as partes.`); y += 2;
    par(`As partes elegem o foro da comarca de Parnaíba – PI para dirimir quaisquer questões oriundas deste contrato, renunciando a qualquer outro, por mais privilegiado que seja.`); y += 2;
    par(`Aplica-se ao presente contrato a Lei nº 8.245/91 e demais normas legais pertinentes.`); y += 4;

    // ── LOCAL E DATA ──
    checkPage(30);
    par(`Parnaíba – PI, ${dataExtenso(hoje)}.`); y += 10;

    // ── ASSINATURAS ──
    titulo("ASSINATURAS");
    y += 2;

    // Locador
    doc.line(L, y+12, L+75, y+12);
    doc.setFont("helvetica","bold"); doc.setFontSize(9);
    doc.text(locadorNome, L, y+17);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100);
    if (locadorDoc) doc.text(`CPF/CNPJ: ${locadorDoc}`, L, y+22);
    doc.text("LOCADOR(A)", L, y+27);

    // Locatário
    doc.line(R-75, y+12, R, y+12);
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,30);
    doc.text(inq.nome_completo, R-75, y+17);
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100);
    if (inq.cpf) doc.text(`CPF: ${inq.cpf}`, R-75, y+22);
    doc.text("LOCATÁRIO(A)", R-75, y+27);
    y += 35;

    // Procurador
    if (temProc) {
      doc.line(L+40, y+12, L+140, y+12);
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(30,30,30);
      doc.text(procNome, L+40, y+17, {align:"center"});
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100);
      if (procCPF) doc.text(`CPF: ${procCPF}`, L+90, y+22, {align:"center"});
      doc.text("REPRESENTANTE / PROCURADOR(A)", L+90, y+27, {align:"center"});
      y += 35;
    }

    // Testemunhas
    checkPage(30);
    y += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(100);
    doc.text("TESTEMUNHAS:", L, y); y += 8;
    doc.line(L, y+12, L+75, y+12); doc.line(R-75, y+12, R, y+12);
    doc.text("1ª Testemunha — Nome e CPF", L, y+17); doc.text("2ª Testemunha — Nome e CPF", R-75, y+17);

    // Upload
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const safeName = inq.nome_completo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"-").toLowerCase();
    const fileName = `${user.id}/contratos/${Date.now()}-${safeName}.pdf`;
    await supabase.storage.from("documentos").upload(fileName, pdfBuffer, { contentType: "application/pdf" });
    const { data: urlData } = await supabase.storage.from("documentos").createSignedUrl(fileName, 60*60*24*7);

    // Salvar URL no inquilino
    await supabase.from("inquilinos").update({
      contrato_pdf_url: urlData?.signedUrl,
      contrato_gerado_em: new Date().toISOString(),
    }).eq("id", inquilino_id);

    return NextResponse.json({ success: true, pdfUrl: urlData?.signedUrl });
  } catch (err: any) {
    console.error("Contrato error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
