export interface DatasetRecord {
  record_id: string;
  schema_version: string;
  rubric_version: string;
  assets: Assets;
  context: AdContext;
  metric_results: MetricResult[];
  expected: Expected;
  labeling: Labeling;
}

export interface Assets {
  brand_id: string;
  product_page_id: string;
  brief_id: string;
  video_id: string;
  video_type: string;
  source: string;
  video_ref: string;
  duration_seconds: number;
  notes: string;
}

export interface AdContext {
  campaign_objective: string;
  platform: string;
  video_length_seconds: number;
  target_audience: string;
  brief_ref: string;
  product_page_ref: string;
  required_cta: string;
  required_messages: string[];
  approved_claims: string[];
  forbidden_claims: string[];
  required_disclaimers: string[];
  reference_assets: string[];
}

export interface Evidence {
  type: string;
  text: string;
  timestamp: string;
}

export interface MetricResult {
  metric_id: string;
  agent: string;
  metric_name: string;
  result: "true" | "false" | "cannot_assess";
  severity: "none" | "low" | "medium" | "high" | "critical";
  confidence: "low" | "medium" | "high";
  evidence: Evidence[];
  explanation: string;
  suggested_correction: string;
  correction_type: string;
}

export interface Expected {
  ad_readiness_score: number;
  readiness_status: string;
  readiness_status_rationale: string;
  priority_fix_list: string[];
}

export interface Labeling {
  labeler: string;
  date: string;
  second_labeler: string;
  adjudication_notes: string;
  inter_rater_notes: string;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


export function compareExactMatch(golden: string, prediction: string): boolean {
  if (!golden || !prediction) return golden === prediction;
  return golden.trim().toLowerCase() === prediction.trim().toLowerCase();
}


export function compareNumeric(golden: number, prediction: number, tolerance: number = 0): boolean {
  return Math.abs(golden - prediction) <= tolerance;
}



export function compareMultiValueLists(golden: string[], prediction: string[]): {
  isExact: boolean;
  missing: string[];
  extra: string[];
  matchRate: number;
} {
  const normalize = (arr: string[]) => arr.map(s => s.trim().toLowerCase());
  const gNorm = normalize(golden);
  const pNorm = normalize(prediction);

  const missing = gNorm.filter(item => !pNorm.includes(item));
  const extra = pNorm.filter(item => !gNorm.includes(item));
  
  const matchRate = gNorm.length === 0 ? (pNorm.length === 0 ? 1 : 0) : (gNorm.length - missing.length) / gNorm.length;

  return {
    isExact: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    matchRate
  };
}




 
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.replace(/[^\d:]/g, '').split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return parseInt(parts[0], 10);
}

export function compareTimestamps(golden: string, prediction: string, toleranceSeconds: number = 2): boolean {

  const regex = /\d+:\d{2}/g;
  const gMatches = golden.match(regex) || [];
  const pMatches = prediction.match(regex) || [];

  if (gMatches.length !== pMatches.length) return false;

  for (let i = 0; i < gMatches.length; i++) {
    const gSec = parseTimeToSeconds(gMatches[i]);
    const pSec = parseTimeToSeconds(pMatches[i]);
    if (Math.abs(gSec - pSec) > toleranceSeconds) {
      return false;
    }
  }
  return true;
}



export async function compareSemanticSimilarity(
  goldenText: string, 
  predictionText: string
): Promise<number> {
  // Support natif Deno + Node.js
  const apiKey = typeof Deno !== "undefined" 
    ? Deno.env.get("OPENROUTER_API_KEY") 
    : process.env.OPENROUTER_API_KEY;

  if (!goldenText && !predictionText) return 1.0;
  if (!goldenText || !predictionText) return 0.0;
  if (goldenText.trim().toLowerCase() === predictionText.trim().toLowerCase()) return 1.0;

  if (!apiKey) {
    console.error("❌ OPENROUTER_API_KEY est introuvable dans l'environnement.");
    return 0.0;
  }

  const prompt = `
Compare the semantic equivalence of these two texts:
Text A: "${goldenText}"
Text B: "${predictionText}"

Respond ONLY with a single numeric float between 0.0 and 1.0 representing semantic similarity (1.0 = identical meaning, 0.0 = totally different).
  `;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "AdReady Evaluator"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // Modèle très rapide, pas cher et fiable pour la qualification
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0
      })
    });

    const data = await response.json();

    // Gestion explicite des erreurs envoyées par l'API OpenRouter
    if (!response.ok || data.error) {
      console.error("❌ Erreur OpenRouter API:", data.error?.message || response.statusText);
      return 0.0;
    }

    if (!data.choices || data.choices.length === 0) {
      console.error("❌ OpenRouter n'a renvoyé aucun choix :", data);
      return 0.0;
    }

    const content = data.choices[0].message?.content?.trim() || "";
    
    // Extraction sécurisée du nombre flottant (ex: extrait "0.85" même si la réponse est "Score: 0.85")
    const match = content.match(/0(\.\d+)?|1(\.0+)?/);
    if (match) {
      return parseFloat(match[0]);
    }

    return 0.0;
  } catch (error) {
    console.error("❌ Erreur réseau lors de l'appel à OpenRouter :", error);
    return 0.0;
  }
}



//////////////////////////////////////////////////////////////////////////////////////////////////




export interface MetricStats {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface ColumnDisagreement {
  column: string;
  disagreements: number;
}

export interface EvaluationReport {
  overallSemanticSimilarity: number;
  totalDisagreements: number;
  highestDisagreementRate: string;
  worstPerformingColumns: ColumnDisagreement[];
  overallScoreAccuracy: number; // Basé sur ad_readiness_score
  metrics: Record<string, MetricStats>;
}



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export async function evaluateDatasets(
  goldenDataset: DatasetRecord[], 
  predictionDataset: DatasetRecord[]
): Promise<EvaluationReport> {
  
  // Initialisation des compteurs globaux
  const metricStats: Record<string, MetricStats> = {};
  const columnDisagreements: Record<string, number> = {};
  
  let totalSemanticScore = 0;
  let semanticComparisonsCount = 0;
  let totalDisagreements = 0;
  
  let totalScoresEvaluated = 0;
  let exactScoresCount = 0;

  // Comparateur textuel temporaire sans LLM (1.0 si identique, 0.0 sinon)
  const compareTextFallback = (a: string, b: string): number => {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0.0;
    return compareExactMatch(a, b) ? 1.0 : 0.0;
  };

  // Fonction utilitaire pour consigner un désaccord
  const logDisagreement = (columnName: string) => {
    columnDisagreements[columnName] = (columnDisagreements[columnName] || 0) + 1;
    totalDisagreements++;
  };

  for (const golden of goldenDataset) {
    const prediction = predictionDataset.find(p => p.record_id === golden.record_id);
    
    // Si l'enregistrement n'existe pas dans la prédiction, on l'ignore
    if (!prediction) continue;

    // --- 1. Comparaison des champs globaux (Expected) ---
    // Comparaison Numérique : ad_readiness_score (avec tolérance de 2 points)
    if (!compareNumeric(golden.expected.ad_readiness_score, prediction.expected.ad_readiness_score, 2)) {
      logDisagreement('expected.ad_readiness_score');
    } else {
      exactScoresCount++;
    }
    totalScoresEvaluated++;

    // Comparaison Texte (Remplacement LLM temporaire) : readiness_status_rationale
    const rationaleSim = compareTextFallback(
      golden.expected.readiness_status_rationale, 
      prediction.expected.readiness_status_rationale
    );
    totalSemanticScore += rationaleSim;
    semanticComparisonsCount++;

    if (rationaleSim < 0.7) logDisagreement('expected.readiness_status_rationale');

    // Comparaison de Liste : priority_fix_list
    const fixListMatch = compareMultiValueLists(
      golden.expected.priority_fix_list, 
      prediction.expected.priority_fix_list
    );
    if (!fixListMatch.isExact) logDisagreement('expected.priority_fix_list');


    // --- 2. Comparaison des Métriques Individuelles ---
    for (const goldMetric of golden.metric_results) {
      const predMetric = prediction.metric_results.find(m => m.metric_id === goldMetric.metric_id);
      
      if (!predMetric) continue;

      const mId = goldMetric.metric_id;
      if (!metricStats[mId]) {
        metricStats[mId] = {
          truePositives: 0, trueNegatives: 0, falsePositives: 0, falseNegatives: 0,
          accuracy: 0, precision: 0, recall: 0, f1: 0
        };
      }

      const stats = metricStats[mId];

      // A. Matrice de confusion basée sur le champ `result` ("true" / "false")
      if (goldMetric.result === "true" && predMetric.result === "true") {
        stats.truePositives++;
      } else if (goldMetric.result === "false" && predMetric.result === "false") {
        stats.trueNegatives++;
      } else if (goldMetric.result === "false" && predMetric.result === "true") {
        stats.falsePositives++;
      } else if (goldMetric.result === "true" && predMetric.result === "false") {
        stats.falseNegatives++;
      } else if (goldMetric.result !== predMetric.result) {
        // Un désaccord n'est consigné que s'il y a une divergence réelle
        // (évite de comptabiliser un désaccord quand les deux sont "cannot_assess")
        logDisagreement(`metric.${mId}.result`);
      }

      // B. Exact Match : severity, confidence, correction_type
      if (!compareExactMatch(goldMetric.severity, predMetric.severity)) logDisagreement(`metric.${mId}.severity`);
      if (!compareExactMatch(goldMetric.confidence, predMetric.confidence)) logDisagreement(`metric.${mId}.confidence`);
      if (!compareExactMatch(goldMetric.correction_type, predMetric.correction_type)) logDisagreement(`metric.${mId}.correction_type`);

      // C. Texte libre (Remplacement LLM temporaire) : explanation & suggested_correction
      const expSim = compareTextFallback(goldMetric.explanation, predMetric.explanation);
      totalSemanticScore += expSim;
      semanticComparisonsCount++;
      if (expSim < 0.7) logDisagreement(`metric.${mId}.explanation`);

      const corrSim = compareTextFallback(goldMetric.suggested_correction, predMetric.suggested_correction);
      totalSemanticScore += corrSim;
      semanticComparisonsCount++;
      if (corrSim < 0.7) logDisagreement(`metric.${mId}.suggested_correction`);

      // D. Timestamps (Evidence)
      if (goldMetric.evidence.length > 0 && predMetric.evidence.length > 0) {
        if (!compareTimestamps(goldMetric.evidence[0].timestamp, predMetric.evidence[0].timestamp)) {
          logDisagreement(`metric.${mId}.evidence_timestamp`);
        }
      }
    }
  }

  // --- 3. Finalisation et Agrégation ---

  // Calcul des métriques pour chaque metric_id (Accuracy, Precision, Recall, F1)
  for (const key in metricStats) {
    const stats = metricStats[key];
    const total = stats.truePositives + stats.trueNegatives + stats.falsePositives + stats.falseNegatives;
    
    stats.accuracy = total > 0 ? (stats.truePositives + stats.trueNegatives) / total : 0;
    stats.precision = (stats.truePositives + stats.falsePositives) > 0 
      ? stats.truePositives / (stats.truePositives + stats.falsePositives) : 0;
    stats.recall = (stats.truePositives + stats.falseNegatives) > 0 
      ? stats.truePositives / (stats.truePositives + stats.falseNegatives) : 0;
    stats.f1 = (stats.precision + stats.recall) > 0 
      ? 2 * ((stats.precision * stats.recall) / (stats.precision + stats.recall)) : 0;
  }

  // Transformation du record de désaccords en tableau trié
  const worstColumns = Object.keys(columnDisagreements)
    .map(col => ({
      column: col,
      disagreements: columnDisagreements[col]
    }))
    .sort((a, b) => b.disagreements - a.disagreements);

  return {
    overallSemanticSimilarity: semanticComparisonsCount > 0 ? totalSemanticScore / semanticComparisonsCount : 0,
    totalDisagreements,
    highestDisagreementRate: worstColumns.length > 0 ? worstColumns[0].column : "none",
    worstPerformingColumns: worstColumns,
    overallScoreAccuracy: totalScoresEvaluated > 0 ? (exactScoresCount / totalScoresEvaluated) : 0,
    metrics: metricStats
  };
}




/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////
///////////////////////////
import { readFileSync, writeFileSync } from 'node:fs';

// 1. Lecture et parsing des fichiers JSON
const goldenDataset: DatasetRecord[] = JSON.parse(
  readFileSync('./gold.json', 'utf-8')
);

const predictionDataset: DatasetRecord[] = JSON.parse(
  readFileSync('./notgold.json', 'utf-8')
);

// 2. Exécution de l'évaluation
async function main() {
  const report = await evaluateDatasets(goldenDataset, predictionDataset);
 // console.log(JSON.stringify(report, null, 2));
  // saving report to file
  writeFileSync('./report.json', JSON.stringify(report, null, 2));  
}

main();