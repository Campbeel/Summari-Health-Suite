import { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

interface BrandLogoProps {
  variant?: "logotype" | "isotipo";
  className?: string;
}

export function BrandLogo({ variant = "logotype", className = "" }: BrandLogoProps) {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemDark);

  if (variant === "isotipo") {
    const src = isDark
      ? "/SUMMARI_ISOTIPO_2.svg"
      : "/SUMMARI_ISOTIPO_2_1.svg";
    return <img src={src} alt="Summari" className={className} data-testid="img-brand-isotipo" />;
  }

  const src = isDark
    ? "/SUMMARI_LOGOTIPO_COLOR_1.svg"
    : "/SUMMARI_LOGOTIPO_COLOR_2.svg";
  return <img src={src} alt="Summari" className={className} data-testid="img-brand-logotype" />;
}
