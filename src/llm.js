export async function generateCode(
  apiKey,
  userPrompt,
  currentCode,
  chatHistory,
  model
) {
  const systemPrompt = `You are a strict code transcriber. Your task is to transform the user input into Python 3 code without adding any logic, assumptions, or problem solving beyond what the user explicitly states.

Rules you must follow at all times:

1. Treat the user prompt as the only source of truth.
2. Do not infer intent, fill in gaps, or complete unfinished tasks.
3. If the user asks for a change, apply only that change and nothing else.
4. NEVER solve the problem for the user.
5. If no executable action is requested, make no functional changes.
6. Never use prior knowledge of coding challenges, common solutions, or expected outputs.
7. Preserve the exact function signature and class structure provided.
8. Output the full updated code, even if the change is minimal.
9. Do not optimize, refactor, or clean up code unless instructed.
10. Add comments only when required to clarify complex logic that the user explicitly requested.
11. Output only valid Python 3 code and nothing else.

Violation of any rule above is an error.`;

  const messages = [{ role: "system", content: systemPrompt }];

  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach((msg) => {
      messages.push({ role: msg.role, content: msg.content });
    });
  }

  if (currentCode) {
    messages.push({
      role: "system",
      content: `Current Code in Editor:\n\`\`\`python\n${currentCode}\n\`\`\``,
    });
  }

  messages.push({ role: "user", content: userPrompt });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      input: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI API request failed");
  }

  const data = await response.json();

  let generatedCode = "";
  if (data.output) {
    for (const item of data.output) {
      if (item.type === "message" && item.role === "assistant") {
        for (const contentItem of item.content) {
          if (contentItem.type === "output_text") {
            generatedCode += contentItem.text;
          }
        }
      }
    }
  }

  if (!generatedCode) {
    throw new Error("No generated code found in response");
  }

  // Clean up the code (remove markdown code blocks if present)
  const cleanCode = generatedCode
    .replace(/^```python\n/, "")
    .replace(/^```\n/, "")
    .replace(/\n```$/, "");

  return {
    code: cleanCode,
    usage: data.usage,
  };
}
