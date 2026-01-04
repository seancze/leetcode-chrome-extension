# LeetCode On The Go Chrome Extension

This Chrome extension allows you to solve LeetCode problems by writing solutions in English. It uses OpenAI's GPT models to convert your natural language instructions into Python 3 code and inserts it directly into the LeetCode editor.

## Features

- **Natural Language to Code**: Describe your logic in English, get Python code.
- **Context Aware**: Uses the problem title, description, and your current code context.
- **Chat History**: Maintains a conversation history per problem so you can refine your solution iteratively.
- **Mobile Friendly**: Floating UI designed for touch interactions.

## Installation

1.  Clone or download this repository.
2.  Build the repository: `npm run build`
3.  Open Chrome and navigate to `chrome://extensions/`.
4.  Enable **Developer mode** in the top right corner.
5.  Click **Load unpacked**.
6.  Select the `dist/src/` folder

## Usage

1.  Navigate to any LeetCode problem page (e.g., `https://leetcode.com/problems/two-sum/`).
2.  A floating panel "English to Code" will appear in the bottom right.
3.  Type your solution logic in the text area.
    - Example: "Create a hash map to store the complement of each number. Iterate through the array, check if complement exists, if so return indices."
4.  Click **Code**.
5.  The extension will generate the Python code and replace the content in the LeetCode editor.
6.  You can continue the conversation to fix bugs or optimize the solution.

## Development

- `src/manifest.json`: Extension configuration.
- `src/background.js`: Handles asynchronous requests.
- `src/llm.js`: Handles OpenAI API requests.
- `src/content.js`: Injects UI and interacts with the page.
- `src/injected.js`: Interacts with the Monaco editor.
- `src/options.html`: Settings page.

## Running tests

### Code generation

```bash
npx promptfoo@0.119.14 eval -c promptfoo/code/promptfooconfig.yaml --no-cache
```

### Test generation

```bash
npx promptfoo@0.119.14 eval -c promptfoo/test/promptfooconfig.yaml --no-cache
```

### View logs

Add a `--verbose` flag. For example,

```bash
npx promptfoo@0.119.14 eval -c promptfoo/code/promptfooconfig.yaml --no-cache --verbose
```

### View results in browser

```bash
npx promptfoo@0.119.14 view
```
