// convert.ts

const ID_MAPPING: Record<string, string> = {
  "GOLD-LIQ-01": "LIQ-IV-01",
  "GOLD-CC-01": "CC-01",
  "COPPER-KEW-01": "KEWPIE-01",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index].trim() : "";
    });
    rows.push(row);
  }

  return rows;
}

// Fonction utilitaire pour découper proprement les lignes CSV avec gestion des guillemets
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, "").trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.replace(/^"|"$/g, "").trim());
  return result;
}

// Helper pour découper les listes (gère les séparateurs par virgule ou point-virgule si présents)
function parseListField(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
}

async function main() {
  const adsText = await Deno.readTextFile("labeling_ads.csv");
  const metricsText = await Deno.readTextFile("labeling_metrics.csv");

  const ads = parseCSV(adsText);
  const metrics = parseCSV(metricsText);

  const goldenDatasetRecords = ads.map(ad => {
    const recordId = ad.record_id;
    const correspondingMetricId = ID_MAPPING[recordId] || recordId;

    const adMetrics = metrics.filter(m => m.ad_id === correspondingMetricId);

    const formattedMetrics = adMetrics.map(m => ({
      metric_id: m.metric_id,
      agent: "claims_accuracy",
      metric_name: m.metric_id.replace(/_/g, " ").toUpperCase(),
      result: (m.result || "").toLowerCase(),
      severity: m.severity || "none",
      confidence: m.confidence || "medium",
      evidence: m.evidence_text ? [{ type: m.evidence_type || "visual", text: m.evidence_text, timestamp: m.evidence_timestamp || "" }] : [],
      explanation: m.explanation || "",
      suggested_correction: m.suggested_correction || "",
      correction_type: m.correction_type || "cannot_suggest"
    }));

    return {
      record_id: recordId,
      schema_version: "0.1",
      rubric_version: "0.1",
      assets: {
        brand_id: ad.brand_id,
        product_page_id: ad.product_page_id,
        brief_id: ad.brief_id,
        video_id: ad.video_id,
        video_type: ad.video_type,
        source: ad.source,
        video_ref: ad.video_ref,
        duration_seconds: Number(ad.duration_seconds) || 0,
        notes: ad.notes,
      },
      context: {
        campaign_objective: ad.campaign_objective,
        platform: ad.platform,
        video_length_seconds: Number(ad.video_length_seconds) || 0,
        target_audience: ad.target_audience,
        brief_ref: ad.brief_ref,
        product_page_ref: ad.product_page_ref,
        required_cta: ad.required_cta,
        required_messages: parseListField(ad.required_messages),
        approved_claims: parseListField(ad.approved_claims),
        forbidden_claims: parseListField(ad.forbidden_claims),
        required_disclaimers: parseListField(ad.required_disclaimers),
        reference_assets: parseListField(ad.reference_assets)
      },
      metric_results: formattedMetrics,
      expected: {
        ad_readiness_score: Number(ad.ad_readiness_score) || 0,
        readiness_status: ad["readiness-status"] || "Cannot Assess",
        readiness_status_rationale: ad.readiness_status_rationale || "",
        priority_fix_list: []
      },
      labeling: {
        labeler: ad.labeler,
        date: ad.date,
        second_labeler: ad.second_labeler,
        adjudication_notes: ad.adjudication_notes,
        inter_rater_notes: ad.inter_rater_notes
      }
    };
  });

  await Deno.writeTextFile("golden_dataset.json", JSON.stringify(goldenDatasetRecords, null, 2));
  console.log("Conversion terminée ! Fichier 'golden_dataset.json' mis à jour avec les listes.");
}

main();