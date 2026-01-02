import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { apiKey, userPrompt, currentCode, chatHistory, model } =
      await req.json();

    if (!model) {
      return new Response(JSON.stringify({ error: "Model is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const openai = createOpenAI({ apiKey });

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

    const result = streamText({
      model: openai(model),
      messages: messages,
      providerOptions: {
        openai: {
          reasoningEffort: "low",
        },
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return { usage: part.totalUsage };
        }
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
