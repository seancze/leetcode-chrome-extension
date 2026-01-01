import { generateCode, generateTest } from "./llm.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "generateCode") {
    handleGenerateCode(request, sendResponse);
    return true; // Will respond asynchronously
  }
  if (request.action === "generateTest") {
    handleGenerateTest(request, sendResponse);
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

    const { currentCode, chatHistory, userPrompt } = request.data;

    const result = await generateCode(
      apiKey,
      userPrompt,
      currentCode,
      chatHistory,
      "gpt-5.1-codex-mini"
    );
    sendResponse({ code: result.code });
  } catch (error) {
    console.error("Error generating code:", error);
    sendResponse({ error: error.message });
  }
}

async function handleGenerateTest(request, sendResponse) {
  try {
    const { apiKey } = await getApiKey();
    if (!apiKey) {
      sendResponse({
        error: "API Key not found. Please set it in the extension options.",
      });
      return;
    }

    const { currentCode, problemDetails, currentTestCases } = request.data;

    const result = await generateTest(
      apiKey,
      currentCode,
      problemDetails,
      currentTestCases,
      "gpt-5.1-codex-mini"
    );
    sendResponse(result);
  } catch (error) {
    console.error("Error generating test:", error);
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
