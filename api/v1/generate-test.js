import OpenAI from "openai";

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
    const { apiKey, currentCode, problemDetails, currentTestCases, model } =
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

    const openai = new OpenAI({ apiKey });

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

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      response_format: schema,
    });

    const generatedOutput = completion.choices[0].message.content;
    const usage = completion.usage;
    const result = JSON.parse(generatedOutput);

    return new Response(
      JSON.stringify({
        testCase: result.testCase,
        isUserCorrect: result.isUserCorrect,
        usage,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
