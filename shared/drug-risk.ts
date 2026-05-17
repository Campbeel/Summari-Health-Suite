// Curated list of medication risks during pregnancy and breastfeeding.
//
// This is NOT a complete pharmacological reference — it is a conservative starter set covering
// well-documented high-risk drugs. Each entry uses lowercased, accent-stripped tokens that match the
// medication name (commercial or generic). Once the CIMA integration lands the same function should
// match by principio activo / ATC code instead of substrings.
//
// Severities:
//   - "absolute":  do not prescribe (e.g. teratogens). Doctor must remove the medication.
//   - "relative":  prescribe only when benefits outweigh risks. Doctor can acknowledge and continue.

export type RiskSeverity = "absolute" | "relative";

export interface DrugRiskEntry {
  // Match tokens — substrings (lowercase, no accents) that identify the drug. Active ingredient,
  // common commercial names and synonyms are all valid here.
  tokens: string[];
  pregnancy?: { severity: RiskSeverity; reason: string };
  breastfeeding?: { severity: RiskSeverity; reason: string };
}

export const DRUG_RISK_LIST: DrugRiskEntry[] = [
  {
    tokens: ["isotretinoina", "isotretinoin", "roacutan"],
    pregnancy: { severity: "absolute", reason: "Teratógeno severo (categoría X)." },
    breastfeeding: { severity: "absolute", reason: "Se excreta por leche materna." },
  },
  {
    tokens: ["warfarina", "warfarin"],
    pregnancy: { severity: "absolute", reason: "Embriopatía por warfarina, hemorragia fetal." },
  },
  {
    tokens: ["metotrexato", "methotrexate"],
    pregnancy: { severity: "absolute", reason: "Abortivo y teratógeno." },
    breastfeeding: { severity: "absolute", reason: "Contraindicado en lactancia." },
  },
  {
    tokens: ["misoprostol"],
    pregnancy: { severity: "absolute", reason: "Abortivo." },
  },
  {
    tokens: ["talidomida", "thalidomide"],
    pregnancy: { severity: "absolute", reason: "Teratógeno severo." },
  },
  {
    tokens: ["enalapril", "captopril", "lisinopril", "losartan", "valsartan"],
    pregnancy: { severity: "absolute", reason: "IECA/ARA-II contraindicados, daño renal fetal." },
  },
  {
    tokens: ["ibuprofeno", "ibuprofen", "naproxeno", "naproxen", "diclofenaco", "diclofenac", "ketoprofeno", "ketoprofen"],
    pregnancy: {
      severity: "relative",
      reason: "AINEs: evitar en 3er trimestre (cierre prematuro del ductus arterioso).",
    },
  },
  {
    tokens: ["aspirina", "aspirin", "acido acetilsalicilico", "asa"],
    pregnancy: {
      severity: "relative",
      reason: "Dosis altas contraindicadas en 3er trimestre.",
    },
  },
  {
    tokens: ["tetraciclina", "tetracycline", "doxiciclina", "doxycycline", "minociclina", "minocycline"],
    pregnancy: { severity: "absolute", reason: "Decoloración dental y alteración ósea fetal." },
    breastfeeding: { severity: "relative", reason: "Pasa a leche materna." },
  },
  {
    tokens: ["ciprofloxacino", "ciprofloxacin", "levofloxacino", "levofloxacin", "moxifloxacino", "moxifloxacin"],
    pregnancy: { severity: "relative", reason: "Quinolonas: daño articular fetal documentado en animales." },
    breastfeeding: { severity: "relative", reason: "Evitar; alternativas más seguras." },
  },
  {
    tokens: ["fluconazol", "fluconazole"],
    pregnancy: { severity: "relative", reason: "Dosis altas asociadas a malformaciones." },
  },
  {
    tokens: ["litio", "lithium"],
    pregnancy: { severity: "relative", reason: "Anomalía de Ebstein. Sólo si beneficio justifica." },
    breastfeeding: { severity: "absolute", reason: "Niveles séricos infantiles peligrosos." },
  },
  {
    tokens: ["acido valproico", "valproato", "valproate", "valproic"],
    pregnancy: { severity: "absolute", reason: "Defectos del tubo neural, autismo." },
  },
  {
    tokens: ["carbamazepina", "carbamazepine"],
    pregnancy: { severity: "relative", reason: "Defectos del tubo neural; usar ácido fólico." },
  },
  {
    tokens: ["codeina", "codeine"],
    breastfeeding: { severity: "absolute", reason: "Riesgo de toxicidad opioide en metabolizadores ultrarrápidos." },
  },
  {
    tokens: ["cloranfenicol", "chloramphenicol"],
    breastfeeding: { severity: "absolute", reason: "Síndrome del bebé gris." },
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export interface PregnancyLactationConflict {
  severity: RiskSeverity;
  scope: "pregnancy" | "breastfeeding";
  reason: string;
  matchedToken: string;
}

export function findPregnancyLactationConflicts(
  medicationName: string,
  patient: { isPregnant?: boolean; isBreastfeeding?: boolean }
): PregnancyLactationConflict[] {
  if (!medicationName) return [];
  if (!patient.isPregnant && !patient.isBreastfeeding) return [];
  const med = normalize(medicationName);
  if (med.length < 3) return [];
  const conflicts: PregnancyLactationConflict[] = [];
  for (const entry of DRUG_RISK_LIST) {
    const hitToken = entry.tokens.find((t) => med.includes(normalize(t)));
    if (!hitToken) continue;
    if (patient.isPregnant && entry.pregnancy) {
      conflicts.push({
        severity: entry.pregnancy.severity,
        scope: "pregnancy",
        reason: entry.pregnancy.reason,
        matchedToken: hitToken,
      });
    }
    if (patient.isBreastfeeding && entry.breastfeeding) {
      conflicts.push({
        severity: entry.breastfeeding.severity,
        scope: "breastfeeding",
        reason: entry.breastfeeding.reason,
        matchedToken: hitToken,
      });
    }
  }
  return conflicts;
}
