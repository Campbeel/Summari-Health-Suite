import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Loader2, AlertTriangle, Pill } from "lucide-react";

interface CatalogResult {
  id: string;
  name: string;
  activeIngredient: string | null;
  labHolder: string | null;
}

interface CatalogResponse {
  results: CatalogResult[];
  source: "cima";
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  "data-testid"?: string;
}

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

/**
 * Medication name input with autocomplete against the CIMA (AEMPS) catalog.
 *
 * If the user types something and never picks a suggestion (i.e. the typed name doesn't match
 * anything in the catalog), an explicit warning is rendered below — per the UX finding's
 * proposal: "Si el medicamento no se encuentra en la base de datos, mostrar advertencia explícita
 * de que el médico debe verificar manualmente las contraindicaciones del paciente."
 */
export function MedicationNameAutocomplete({ value, onChange, placeholder, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchedFromCatalog, setMatchedFromCatalog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(trimmed)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("catalog error");
        const data = (await res.json()) as CatalogResponse;
        if (cancelled) return;
        setResults(data.results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const handleSelect = (r: CatalogResult) => {
    onChange(r.name);
    setQuery(r.name);
    setMatchedFromCatalog(true);
    setOpen(false);
    inputRef.current?.blur();
  };

  // The catalog match is "confirmed" only when the user clicked a suggestion AND the name in the
  // input still equals the picked one. If they keep typing afterwards the warning re-appears.
  const showCatalogWarning =
    query.trim().length >= MIN_QUERY && !loading && (!matchedFromCatalog || query.trim().toLowerCase() !== value.trim().toLowerCase());

  return (
    <div className="space-y-1.5">
      <Popover open={open && (loading || results.length > 0)} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={query}
            placeholder={placeholder || "Nombre del medicamento"}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatchedFromCatalog(false);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            data-testid={rest["data-testid"]}
            className="mt-1"
            autoComplete="off"
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[var(--radix-popover-trigger-width)] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {loading && (
            <div className="px-2 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando en CIMA…
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto" data-testid="catalog-suggestions">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-2 py-2 rounded-sm hover:bg-accent text-sm flex items-start gap-2"
                    data-testid={`catalog-suggestion-${r.id}`}
                  >
                    <Pill className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      {r.activeIngredient && (
                        <p className="text-xs text-muted-foreground truncate">{r.activeIngredient}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {showCatalogWarning && (
        <div
          className="flex items-start gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400"
          data-testid="warning-not-in-catalog"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Este medicamento no se encontró en el catálogo. Verifica manualmente nombre, dosis y
            contraindicaciones para el paciente.
          </span>
        </div>
      )}
    </div>
  );
}
