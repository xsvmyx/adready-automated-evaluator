const apiKey = typeof Deno !== "undefined" 
  ? Deno.env.get("OPENROUTER_API_KEY") 
  : process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("❌ OPENROUTER_API_KEY est introuvable dans l'environnement.");
  Deno.exit(1);
}


const MODEL = "google/gemini-3-flash-preview";

const textA = "Le produit ne respecte pas les règles d'affichage du logo.";
const textB = "Le logo n'est pas affiché conformément aux directives de la marque.";

const prompt = `
Compare the semantic equivalence of these two texts:
Text A: "${textA}"
Text B: "${textB}"

Respond ONLY with a single numeric float between 0.0 and 1.0 representing semantic similarity (1.0 = identical meaning, 0.0 = totally different).
`;

console.log(`🚀 Envoi du prompt au modèle léger (${MODEL})...`);

try {
  const startTime = performance.now();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost",
      "X-Title": "AdReady Evaluator"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0
    })
  });

  const endTime = performance.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  const data = await response.json();

  if (!response.ok || data.error) {
    console.error("❌ Erreur OpenRouter :", data.error || data);
  } else {
    const rawContent = data.choices[0]?.message?.content?.trim();
    
    console.log(`✅ Réponse reçue en ${duration}s !`);
    console.log("🤖 Contenu brut renvoyé :", rawContent);

    // Extraction du nombre
    const match = rawContent.match(/0(\.\d+)?|1(\.0+)?/);
    const score = match ? parseFloat(match[0]) : null;
    
    console.log("📊 Score extrait :", score);
  }
} catch (error) {
  console.error("❌ Erreur lors de l'appel :", error);
}