import { hostedAiConfig } from "@/lib/ai/env";

type ChatJsonInput = {
  readonly model: string;
  readonly system: string;
  readonly user: string;
};

export async function chatJson<T>(input: ChatJsonInput): Promise<T | null> {
  const config = hostedAiConfig();
  if (!config.enabled) return null;
  const url = `${config.baseUrl.replace(/\/$/, "") || "https://api.openai.com/v1"}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
