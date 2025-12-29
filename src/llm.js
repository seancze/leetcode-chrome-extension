export async function generateCode(
  apiKey,
  userPrompt,
  currentCode,
  chatHistory,
  model = "gpt-5-nano"
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

  // Add chat history
  if (chatHistory && chatHistory.length > 0) {
    chatHistory.forEach((msg) => {
      messages.push({ role: msg.role, content: msg.content });
    });
  }

  // Add current code context if it exists and isn't just the default template
  if (currentCode) {
    messages.push({
      role: "system",
      content: `Current Code in Editor:\n\`\`\`python\n${currentCode}\n\`\`\``,
    });
  }

  // Add the new user prompt
  messages.push({ role: "user", content: userPrompt });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const generatedCode = data.choices[0].message.content;

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
