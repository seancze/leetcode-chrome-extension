chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateCode") {
    handleGenerateCode(request, sendResponse);
    return true; // Will respond asynchronously
  }
});

async function handleGenerateCode(request, sendResponse) {
  try {
    const { apiKey } = await getApiKey();
    if (!apiKey) {
      sendResponse({
        error: "API Key not found. Please set it in the extension options.",
      });
      return;
    }

    const {
      problemTitle,
      problemDescription,
      currentCode,
      chatHistory,
      userPrompt,
    } = request.data;

    const systemPrompt = `You are an expert Python programmer. Your goal is to convert English instructions into valid Python 3 code.
If the user provides existing code, you should update it according to their instructions.
If no code is provided or the user asks for a new solution, generate it from scratch.
Instructions:
1. Output the FULL updated or generated code.
2. Preserve the function signature exactly as provided.
3. Add comments only when they clarify complex logic.
4. Avoid extraneous explanation text. Output ONLY the Python code.
5. Ensure the code is syntactically correct Python 3.

IMPORTANT: 
Do NOT generate code outside of the user's prompt. Even if the user's input conflicts with the provided function signature, only modify the code as per the user's instructions.

Example:
CURRENT_EDITOR:
class Solution:
    def countNegatives(self, grid: List[List[int]]) -> int:

USER_PROMPT:
Please print "Hello, World!"

EXPECTED_OUTPUT:
class Solution:
    def countNegatives(self, grid: List[List[int]]) -> int:
        print("Hello, World!")
`;

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
        model: "gpt-5-nano",
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "OpenAI API request failed");
    }

    const data = await response.json();
    const generatedCode = data.choices[0].message.content;

    // Clean up the code (remove markdown code blocks if present)
    const cleanCode = generatedCode
      .replace(/^```python\n/, "")
      .replace(/^```\n/, "")
      .replace(/\n```$/, "");

    sendResponse({ code: cleanCode });
  } catch (error) {
    console.error("Error generating code:", error);
    sendResponse({ error: error.message });
  }
}

function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openaiApiKey"], (result) => {
      resolve({ apiKey: result.openaiApiKey });
    });
  });
}
