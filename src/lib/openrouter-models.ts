export type OpenRouterModel = { id: string; name: string };

type OpenRouterRecord = {
  id?: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
};

export async function getFreeOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/models/user?output_modalities=text&endpoints=%2Fapi%2Fv1%2Fchat%2Fcompletions",
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://projecthulksar.vercel.app",
        "X-Title": "Project Hulksar"
      },
      signal: AbortSignal.timeout(10_000)
    }
  );
  if (!response.ok) throw new Error(`OpenRouter model list returned HTTP ${response.status}.`);
  const payload = await response.json() as { data?: OpenRouterRecord[] };
  return (payload.data ?? [])
    .filter((model) =>
      Boolean(model.id) &&
      Number(model.pricing?.prompt) === 0 &&
      Number(model.pricing?.completion) === 0
    )
    .map((model) => ({ id: model.id!, name: model.name || model.id! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function assertFreeOpenRouterModel(apiKey: string, modelId: string): Promise<void> {
  const models = await getFreeOpenRouterModels(apiKey);
  if (!models.some((model) => model.id === modelId)) {
    throw new Error("That OpenRouter model is not available as a free model for this API key. Choose a free model from the list.");
  }
}
