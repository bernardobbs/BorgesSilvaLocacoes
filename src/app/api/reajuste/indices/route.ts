// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { NextRequest, NextResponse } from "next/server";

const SERIES: Record<string, number> = {
  ipca: 433,
  igpm: 189,
  inpc: 188,
};

async function buscarAcumulado12Meses(serie: number): Promise<number | null> {
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${fmtDate(inicio)}&dataFinal=${fmtDate(hoje)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const dados: Array<{ data: string; valor: string }> = await res.json();
    if (!dados || dados.length === 0) return null;
    const acumulado = dados.reduce((acc, d) => {
      const v = parseFloat(d.valor.replace(",", "."));
      return acc * (1 + v / 100);
    }, 1);
    return parseFloat(((acumulado - 1) * 100).toFixed(4));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const indice = searchParams.get("indice") || "igpm";
  const serie = SERIES[indice];
  if (!serie) return NextResponse.json({ error: "Índice inválido" }, { status: 400 });
  const percentual = await buscarAcumulado12Meses(serie);
  if (percentual === null) {
    return NextResponse.json({ error: "Não foi possível buscar o índice.", percentual: null }, { status: 503 });
  }
  return NextResponse.json({
    indice, percentual,
    referencia: `Acumulado 12 meses — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    fonte: "Banco Central do Brasil",
  });
}
