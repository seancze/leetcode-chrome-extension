import { generateCode } from "./llm.js";

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

    const { currentCode, chatHistory, userPrompt } = request.data;

    const result = await generateCode(
      apiKey,
      userPrompt,
      currentCode,
      chatHistory
    );
    sendResponse({ code: result.code });
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
