// Based on Lugo — Copyright (c) 2024 Renilson Medeiros — MIT License
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: { box: "h-7 w-7 rounded-md",  text: "text-base", svg: 16 },
    md: { box: "h-9 w-9 rounded-lg",  text: "text-lg",   svg: 20 },
    lg: { box: "h-12 w-12 rounded-lg", text: "text-xl",  svg: 26 },
  };
  const s = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn(
        "flex items-center justify-center shadow-sm flex-shrink-0 bg-[#0B6B72]",
        s.box
      )}>
        {/* Ícone: arcos do Center Lila */}
        <svg width={s.svg} height={s.svg} viewBox="0 0 36 30" fill="none" aria-hidden="true">
          <rect x="0"    y="11"   width="36"  height="2.5" rx="1.2" fill="white" fillOpacity="0.9"/>
          <rect x="3"    y="9"    width="2.5" height="4"   rx="1"   fill="white" fillOpacity="0.9"/>
          <rect x="30.5" y="9"    width="2.5" height="4"   rx="1"   fill="white" fillOpacity="0.9"/>
          <rect x="3"    y="13.5" width="2.5" height="13"  rx="1"   fill="white" fillOpacity="0.9"/>
          <rect x="30.5" y="13.5" width="2.5" height="13"  rx="1"   fill="white" fillOpacity="0.9"/>
          <rect x="3"    y="25"   width="30"  height="2"   rx="1"   fill="white" fillOpacity="0.7"/>
          <path d="M7 26.5 C7 20 12 17 12 17 C12 17 17 20 17 26.5"  stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          <path d="M17 26.5 C17 20 22 17 22 17 C22 17 27 20 27 26.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
      {!iconOnly && (
        <span className={cn("font-semibold tracking-tight text-foreground leading-tight", s.text)}>
          Borges Silva<br className="hidden sm:block"/>
          <span className="text-[0.75em] font-medium text-muted-foreground">Locações</span>
        </span>
      )}
    </div>
  );
}
