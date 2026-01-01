class LeetCodeProvider {
  constructor(options) {
    this.providerId = options.id || "leetcode-custom";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const { currentCode, chatHistory } = context.vars;
    const userPrompt = prompt;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: "OPENAI_API_KEY not set" };
    }

    try {
      // Dynamic import for ESM module
      const { generateCode } = await import("../../src/llm.js");

      const result = await generateCode(
        apiKey,
        userPrompt,
        currentCode,
        chatHistory,
        this.config.model
      );

      return {
        output: result.code,
        tokenUsage: {
          total: result.usage.total_tokens,
          prompt: result.usage.prompt_tokens,
          completion: result.usage.completion_tokens,
        },
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = LeetCodeProvider;
