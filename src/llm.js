const VERCEL_API_URL = "https://leetcode-chrome-extension.vercel.app";

export async function generateCode(
  apiKey,
  userPrompt,
  currentCode,
  chatHistory,
  model,
  onChunk
) {
  const { fullText, usage } = await streamResponse(
    "/api/v1/generate-code",
    {
      apiKey,
      userPrompt,
      currentCode,
      chatHistory,
      model,
    },
    onChunk
  );

  // remove markdown code blocks if present
  const cleanCode = fullText
    .replace(/^```python\n/, "")
    .replace(/^```\n/, "")
    .replace(/^\n/, "")
    .replace(/\n```$/, "");

  return { code: cleanCode, usage };
}

export async function generateTest(
  apiKey,
  currentCode,
  problemDetails,
  currentTestCases,
  model,
  onChunk
) {
  const { fullText, usage } = await streamResponse(
    "/api/v1/generate-test",
    {
      apiKey,
      currentCode,
      problemDetails,
      currentTestCases,
      model,
    },
    onChunk
  );

  try {
    const result = JSON.parse(fullText);
    return { ...result, usage };
  } catch (e) {
    // If parsing fails, return null or throw
    console.error("Failed to parse final JSON from stream", fullText);
    throw new Error("Invalid response format from server");
  }
}

async function streamResponse(endpoint, body, onChunk) {
  const response = await fetch(`${VERCEL_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "API request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep the last incomplete line

    for (const line of lines) {
      const lineTrimmed = line.trim();
      // skip empty lines
      if (!lineTrimmed) continue;
      const jsonLine = lineTrimmed.startsWith("data: ")
        ? lineTrimmed.slice(6)
        : lineTrimmed;
      // skip [DONE] lines
      // its only used to signal end of stream and is not a json message
      if (jsonLine === "[DONE]") continue;

      try {
        const chunk = JSON.parse(jsonLine);

        if (chunk.type === "text-delta") {
          fullText += chunk.delta;
          if (onChunk) onChunk({ type: "text", content: chunk.delta });
        } else if (chunk.type === "reasoning-delta") {
          if (onChunk) onChunk({ type: "reasoning", content: chunk.delta });
        } else if (chunk.type === "finish") {
          usage = chunk.messageMetadata.usage;
        }
      } catch (e) {
        console.warn("Failed to parse chunk:", line);
      }
    }
  }

  return { fullText, usage };
}
