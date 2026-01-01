# LeetCode English to Code Chrome Extension

This Chrome extension allows you to solve LeetCode problems by writing solutions in English. It uses OpenAI's GPT models to convert your natural language instructions into Python 3 code and inserts it directly into the LeetCode editor.

## Features

- **Natural Language to Code**: Describe your logic in English, get Python code.
- **Context Aware**: Uses the problem title, description, and your current code context.
- **Chat History**: Maintains a conversation history per problem so you can refine your solution iteratively.
- **Mobile Friendly**: Floating UI designed for touch interactions.
- **Secure**: Your OpenAI API key is stored locally in your browser.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the folder containing this project (`leetcode-chrome-plugin`).

## Setup

1.  Click the extension icon in the Chrome toolbar (or pin it first).
2.  Click "Extension Options" (or right-click the icon and select Options).
3.  Enter your OpenAI API Key (starts with `sk-...`).
4.  Click **Save Key**.

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
- `src/background.js`: Handles OpenAI API requests.
- `src/content.js`: Injects UI and interacts with the page.
- `src/injected.js`: Interacts with the Monaco editor.
- `src/options.html`: Settings page.

## Running tests

### Run all tests

```bash
npx promptfoo@latest eval -c promptfoo/promptfooconfig.yaml --no-cache
```

### View logs

```bash
npx promptfoo@latest eval -c promptfoo/promptfooconfig.yaml --no-cache --verbose
```

### View results in browser

```bash
npx promptfoo@latest view
```
