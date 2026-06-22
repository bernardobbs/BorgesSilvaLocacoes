// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { FAMILY_OWNER_ID } from '@/lib/family';

function fmtBRL(v: number) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtD(iso: string | null) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function mesLabel(iso: string) {
  if (!iso) return "";
  const [y, mo] = iso.split("-");
  const M = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${M[parseInt(mo) - 1]}/${y}`;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7) + "-01";
    const mesInicio = mes.slice(0, 7) + "-01";

    // Buscar dados
    const [inqRes, compRes, imovRes, acordosRes] = await Promise.all([
      supabase.from("inquilinos")
        .select("id, nome_completo, cpf, valor_aluguel, valor_condominio, dia_vencimento, data_inicio, score_inquilinos(score, score_label), imoveis!inner(titulo, proprietario_id)")
        .eq('imoveis.proprietario_id', FAMILY_OWNER_ID)
        .eq("status", "ativo"),
      supabase.from("comprovantes")
        .select("inquilino_id, mes_referencia, valor, valor_multa, valor_juros, situation, data_vencimento, data_pagamento, forma_pagamento")
        .gte("mes_referencia", mesInicio)
        .lte("mes_referencia", mesInicio),
      supabase.from("imoveis")
        .select("id, titulo, status, do_center")
        .eq('proprietario_id', FAMILY_OWNER_ID),
      supabase.from("acordos")
        .select("id, valor_acordo, status, inquilinos!inner(nome_completo, imoveis!inner(proprietario_id))")
        .eq("status", "ativo")
        .eq('inquilinos.imoveis.proprietario_id', FAMILY_OWNER_ID),
    ]);

    const inquilinos = inqRes.data || [];
    const comprovantes = compRes.data || [];
    const imoveis = imovRes.data || [];

    const wb = XLSX.utils.book_new();

    // ── ABA 1: RESUMO FINANCEIRO ──
    const compMap = new Map<string, any>();
    comprovantes.forEach((c: any) => compMap.set(c.inquilino_id, c));

    let totalBase = 0, totalRecebido = 0, totalVencido = 0, totalAberto = 0;
    inquilinos.forEach((i: any) => {
      const base = (i.valor_aluguel || 0) + (i.valor_condominio || 0);
      totalBase += base;
      const c = compMap.get(i.id);
      if (!c) { totalAberto += base; return; }
      const total = (c.valor || 0) + (c.valor_multa || 0) + (c.valor_juros || 0);
      if (c.situation === "billed") totalRecebido += c.valor || 0;
      else if (c.situation === "expired") totalVencido += total;
      else totalAberto += base;
    });

    const resumo = [
      ["RELATÓRIO MENSAL — BORGES SILVA LOCAÇÕES"],
      ["Competência:", mesLabel(mesInicio)],
      ["Gerado em:", fmtD(new Date().toISOString().split("T")[0])],
      [],
      ["RESUMO FINANCEIRO"],
      ["Indicador", "Valor", "Percentual"],
      ["Total a receber", fmtBRL(totalBase), "100%"],
      ["Recebido", fmtBRL(totalRecebido), `${totalBase > 0 ? ((totalRecebido / totalBase) * 100).toFixed(1) : 0}%`],
      ["A vencer / Em aberto", fmtBRL(totalAberto), `${totalBase > 0 ? ((totalAberto / totalBase) * 100).toFixed(1) : 0}%`],
      ["Inadimplente (vencido)", fmtBRL(totalVencido), `${totalBase > 0 ? ((totalVencido / totalBase) * 100).toFixed(1) : 0}%`],
      [],
      ["OCUPAÇÃO"],
      ["Total de imóveis", imoveis.length],
      ["Alugados", imoveis.filter((i: any) => i.status === "alugado").length],
      ["Disponíveis", imoveis.filter((i: any) => i.status === "disponivel").length],
      ["Manutenção", imoveis.filter((i: any) => i.status === "manutencao").length],
      ["Taxa de ocupação", `${imoveis.length > 0 ? ((imoveis.filter((i: any) => i.status === "alugado").length / imoveis.length) * 100).toFixed(1) : 0}%`],
      [],
      ["Acordos ativos", acordosRes.data?.length || 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resumo);
    ws1["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

    // ── ABA 2: PAGAMENTOS DO MÊS ──
    const pagHeaders = ["Inquilino", "Imóvel", "Vencimento", "Aluguel Base", "Condomínio", "Multa", "Juros", "Total", "Status", "Data Pagamento", "Forma"];
    const formaMap: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", cartao: "Cartão", cheque: "Cheque" };
    const statusMap: Record<string, string> = { billed: "PAGO", expired: "VENCIDO", open: "EM ABERTO" };

    const pagRows = inquilinos.map((i: any) => {
      const im = Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis;
      const c = compMap.get(i.id);
      const [y, m] = mesInicio.split("-").map(Number);
      const venc = fmtD(`${y}-${String(m).padStart(2,"0")}-${String(i.dia_vencimento).padStart(2,"0")}`);
      return [
        i.nome_completo,
        im?.titulo || "",
        venc,
        i.valor_aluguel || 0,
        i.valor_condominio || 0,
        c?.valor_multa || 0,
        c?.valor_juros || 0,
        (c?.valor || 0) + (c?.valor_multa || 0) + (c?.valor_juros || 0) || (i.valor_aluguel + (i.valor_condominio || 0)),
        c ? statusMap[c.situation] || c.situation : "SEM REGISTRO",
        c?.data_pagamento ? fmtD(c.data_pagamento) : "",
        c?.forma_pagamento ? (formaMap[c.forma_pagamento] || c.forma_pagamento) : "",
      ];
    });

    // Totais
    pagRows.push([]);
    pagRows.push(["TOTAL", "", "", `=SUM(D2:D${pagRows.length})`, `=SUM(E2:E${pagRows.length})`, "", "", `=SUM(H2:H${pagRows.length})`, "", "", ""]);

    const ws2 = XLSX.utils.aoa_to_sheet([pagHeaders, ...pagRows]);
    ws2["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Pagamentos");

    // ── ABA 3: INADIMPLÊNCIA ──
    const inadHeaders = ["Inquilino", "CPF", "Imóvel", "Vencimento", "Valor Base", "Multa", "Juros", "Total c/ Encargos", "Dias Atraso", "Score"];
    const inadRows = inquilinos
      .filter((i: any) => {
        const c = compMap.get(i.id);
        return c?.situation === "expired";
      })
      .map((i: any) => {
        const im = Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis;
        const c = compMap.get(i.id);
        const score = Array.isArray(i.score_inquilinos) ? i.score_inquilinos[0] : i.score_inquilinos;
        const venc = new Date(c.data_vencimento);
        const dias = Math.max(0, Math.floor((new Date().getTime() - venc.getTime()) / 86400000));
        return [
          i.nome_completo,
          i.cpf || "",
          im?.titulo || "",
          fmtD(c.data_vencimento),
          c.valor || 0,
          c.valor_multa || 0,
          c.valor_juros || 0,
          (c.valor || 0) + (c.valor_multa || 0) + (c.valor_juros || 0),
          dias,
          score ? `${score.score}/5 — ${score.score_label}` : "",
        ];
      });

    const ws3 = XLSX.utils.aoa_to_sheet(inadRows.length > 0 ? [inadHeaders, ...inadRows] : [inadHeaders, ["Nenhum inadimplente neste mês"]]);
    ws3["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Inadimplência");

    // ── ABA 4: IMÓVEIS ──
    const imovHeaders = ["Imóvel", "Categoria", "Status", "Inquilino Atual", "Valor Aluguel"];
    const imovRows = imoveis.map((im: any) => {
      const inq = inquilinos.find((i: any) => {
        const iIm = Array.isArray(i.imoveis) ? i.imoveis[0] : i.imoveis;
        return iIm?.titulo === im.titulo;
      });
      return [
        im.titulo,
        im.do_center ? "Center Lila" : "Residencial",
        im.status === "alugado" ? "Alugado" : im.status === "disponivel" ? "Disponível" : "Manutenção",
        inq?.nome_completo || "—",
        inq?.valor_aluguel || 0,
      ];
    });

    const ws4 = XLSX.utils.aoa_to_sheet([imovHeaders, ...imovRows]);
    ws4["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws4, "Imóveis");

    // Gerar buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `relatorio-${mesLabel(mesInicio).replace("/", "-")}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("Relatorio error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
