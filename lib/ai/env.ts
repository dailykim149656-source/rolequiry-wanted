export function hostedAiConfig() {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const baseUrl =
    process.env.OPENAI_BASE_URL?.trim() ||
    "";
  const customGateway = Boolean(baseUrl);
  const mapModel = (value: string, fallback: string) => {
    const trimmed = value.trim();
    if (trimmed === "Luna") return "gpt-5.6-luna";
    if (trimmed === "Terra") return "gpt-5.6-terra";
    return trimmed || fallback;
  };
  return {
    extractorModel: mapModel(
      process.env.ROLEQUIRY_EXTRACTOR_MODEL?.trim() || "Luna",
      "gpt-5.6-luna",
    ),
    researchModel: mapModel(
      process.env.ROLEQUIRY_RESEARCH_MODEL?.trim() || "Luna",
      "gpt-5.6-luna",
    ),
    verifierModel: mapModel(
      process.env.ROLEQUIRY_VERIFIER_MODEL?.trim() || "Luna",
      "gpt-5.6-luna",
    ),
    escalationModel: mapModel(
      process.env.ROLEQUIRY_ESCALATION_MODEL?.trim() || "Terra",
      "gpt-5.6-terra",
    ),
    apiKey,
    baseUrl,
    enabled: Boolean(apiKey),
  };
}
