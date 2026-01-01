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

  const { generatedOutput, usage } = await fetchOpenAIResponse(
    apiKey,
    model,
    messages
  );

  // remove markdown code blocks if present
  const cleanCode = generatedOutput
    .replace(/^```python\n/, "")
    .replace(/^```\n/, "")
    .replace(/\n```$/, "");

  return {
    code: cleanCode,
    usage: usage,
  };
}

export async function generateTest(
  apiKey,
  currentCode,
  problemDetails,
  currentTestCases,
  model
) {
  const systemPrompt = `You are an expert software tester. Your task is to evaluate the user's code and generate a new test case if necessary.

Rules:
1. Analyse the problem description, current code, and existing test cases.
2. Determine if the user's code is correct.
3. If the user's code is correct, set "isUserCorrect" to true and "testCase" to null.
4. If the user's code is incorrect, set "isUserCorrect" to false and generate a SINGLE new test case that causes the user's code to fail. Set "testCase" to this string.
5. The "testCase" string must be formatted exactly as LeetCode expects (e.g. line separated values).
6. Do not repeat existing test cases.`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Problem Title: ${problemDetails.title}\nProblem Description:\n${problemDetails.description}\n\nCurrent Code:\n\`\`\`python\n${currentCode}\n\`\`\`\n\nCurrent Test Cases:\n${currentTestCases}\n\nEvaluate and generate test case if needed.`,
    },
  ];

  const schema = {
    type: "json_schema",
    name: "test_case_evaluation",
    strict: true,
    schema: {
      type: "object",
      properties: {
        testCase: {
          type: ["string", "null"],
          description:
            "The new test case input, or null if the user's code is correct.",
        },
        isUserCorrect: {
          type: "boolean",
          description: "Whether the user's code is correct.",
        },
      },
      required: ["testCase", "isUserCorrect"],
      additionalProperties: false,
    },
  };

  const { testCase, isUserCorrect, usage } =
    await fetchOpenAIStructuredResponse(apiKey, model, messages, schema);

  return {
    testCase,
    isUserCorrect,
    usage,
  };
}

async function fetchOpenAIResponse(apiKey, model, messages) {
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

  let generatedOutput = "";
  if (data.output) {
    for (const item of data.output) {
      if (item.type === "message" && item.role === "assistant") {
        for (const contentItem of item.content) {
          if (contentItem.type === "output_text") {
            generatedOutput += contentItem.text;
          }
        }
      }
    }
  }

  if (!generatedOutput) {
    throw new Error("No generated test case found in response");
  }

  return { generatedOutput, usage: data.usage };
}

async function fetchOpenAIStructuredResponse(apiKey, model, messages, schema) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      input: messages,
      text: {
        format: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI API request failed");
  }

  const data = await response.json();

  let generatedOutput = "";
  if (data.output) {
    for (const item of data.output) {
      if (item.type === "message" && item.role === "assistant") {
        for (const contentItem of item.content) {
          if (contentItem.type === "output_text") {
            generatedOutput += contentItem.text;
          }
        }
      }
    }
  }

  if (!generatedOutput) {
    throw new Error("No structured output found in response");
  }

  return { ...JSON.parse(generatedOutput), usage: data.usage };
}
