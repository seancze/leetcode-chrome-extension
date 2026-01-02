class TestGeneratorProvider {
  constructor(options) {
    this.providerId = options.id || "test-generator";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const { currentCode, problemDetails, currentTestCases } = context.vars;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { error: "OPENAI_API_KEY not set" };
    }

    try {
      // Dynamic import for ESM module
      const { generateTest } = await import("../../src/llm.js");

      // problemDetails comes as a string from the yaml vars, so we parse it
      const parsedProblemDetails =
        typeof problemDetails === "string"
          ? JSON.parse(problemDetails)
          : problemDetails;

      const result = await generateTest(
        apiKey,
        currentCode,
        parsedProblemDetails,
        currentTestCases || "",
        this.config.model
      );

      return {
        output: JSON.stringify(
          {
            isUserCorrect: result.isUserCorrect,
            testCase: result.testCase,
          },
          null,
          2
        ),
        tokenUsage: {
          total: result.usage.totalTokens,
          prompt: result.usage.inputTokens,
          completion: result.usage.outputTokens,
        },
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = TestGeneratorProvider;
