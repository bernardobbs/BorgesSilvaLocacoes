// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
"use client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star } from "lucide-react";

interface ScoreBadgeProps {
  score: number | null;
  scoreLabel?: string;
  totalParcelas?: number;
  pagas?: number;
  vencidas?: number;
  totalNotificacoes?: number;
  totalAcordos?: number;
  pontos?: number;
  size?: "sm" | "md";
}

const SCORE_CONFIG = {
  1: { stars: 1, label: "Inadimplente crítico",  color: "text-red-500",    bg: "bg-red-50 border-red-200" },
  2: { stars: 2, label: "Pagador com pendências",color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  3: { stars: 3, label: "Pagador regular",       color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200" },
  4: { stars: 4, label: "Bom",        color: "text-blue-500",   bg: "bg-blue-50 border-blue-200" },
  5: { stars: 5, label: "Excelente",  color: "text-green-500",  bg: "bg-green-50 border-green-200" },
};

export function ScoreBadge({ score, scoreLabel, totalParcelas, pagas, vencidas, totalNotificacoes, totalAcordos, pontos, size = "sm" }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-muted-foreground italic">sem histórico</span>
    );
  }

  const cfg = SCORE_CONFIG[score as keyof typeof SCORE_CONFIG] || SCORE_CONFIG[3];
  const starSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium cursor-default ${cfg.bg}`}>
            <div className={`flex gap-0.5 ${cfg.color}`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`${starSize} ${i < cfg.stars ? "fill-current" : "opacity-20"}`} />
              ))}
            </div>
            <span className={cfg.color}>{cfg.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs space-y-1 max-w-[220px]">
          <p className="font-medium">{scoreLabel || cfg.label}</p>
          {pontos !== undefined && <p className="text-muted-foreground">Pontuação: {pontos}/100</p>}
          {totalParcelas !== undefined && <p>Meses no histórico: {totalParcelas}</p>}
          {pagas !== undefined && pagas > 0 && <p className="text-green-600">✓ Pagos em dia: {pagas}</p>}
          {vencidas !== undefined && vencidas > 0 && <p className="text-red-600">✗ Vencidos: {vencidas}</p>}
          {totalNotificacoes !== undefined && totalNotificacoes > 0 && <p className="text-orange-500">📩 Cobranças: {totalNotificacoes}</p>}
          {totalAcordos !== undefined && totalAcordos > 0 && <p className="text-blue-500">🤝 Acordos: {totalAcordos}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
