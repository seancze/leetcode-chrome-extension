// This script runs in the page context (MAIN world) to access the Monaco editor instance.

window.addEventListener("message", (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  if (event.data.type === "LEETCODE_EXTENSION_GET_CODE") {
    const code = getCode();
    window.postMessage(
      { type: "LEETCODE_EXTENSION_CODE_RESPONSE", code: code },
      "*"
    );
  }

  if (event.data.type === "LEETCODE_EXTENSION_SET_CODE") {
    const success = setCode(event.data.code);
    window.postMessage(
      { type: "LEETCODE_EXTENSION_SET_CODE_RESPONSE", success: success },
      "*"
    );
  }

  if (event.data.type === "LEETCODE_EXTENSION_GET_TEST_CASES") {
    getInjectedTestCases().then((testCases) => {
      window.postMessage(
        {
          type: "LEETCODE_EXTENSION_TEST_CASES_RESPONSE",
          testCases: testCases,
        },
        "*"
      );
    });
  }

  if (event.data.type === "LEETCODE_EXTENSION_APPEND_TEST_CASE") {
    appendInjectedTestCase(event.data.testCase).then((success) => {
      window.postMessage(
        {
          type: "LEETCODE_EXTENSION_APPEND_TEST_CASE_RESPONSE",
          success: success,
        },
        "*"
      );
    });
  }
});

function getCode() {
  try {
    const monaco = (window as any).monaco;
    if (monaco && monaco.editor) {
      // Try to get from focused/active editor first
      const editors = monaco.editor.getEditors();
      if (editors.length > 0) {
        return editors[0].getValue();
      }
      // Fallback to models
      const models = monaco.editor.getModels();
      if (models.length > 0) {
        return models[models.length - 1].getValue();
      }
    }

    // Fallback for CodeMirror 6 (used in LeetCode mobile site)
    const cm6Content = document.querySelector(".cm-content") as HTMLElement;
    if (cm6Content) {
      return cm6Content.innerText;
    }
  } catch (e) {
    console.error("LeetCode Extension: Error getting code", e);
  }
  return "";
}

function setCode(newCode: string) {
  try {
    const monaco = (window as any).monaco;
    if (monaco && monaco.editor) {
      const editors = monaco.editor.getEditors();
      if (editors.length > 0) {
        const editor = editors[0];
        const model = editor.getModel();
        const fullRange = model.getFullModelRange();

        // Use executeEdits to preserve undo stack
        editor.executeEdits("leetcode-extension", [
          {
            range: fullRange,
            text: newCode,
            forceMoveMarkers: true,
          },
        ]);
        // Push an undo stop to ensure this edit is a separate undoable action
        editor.pushUndoStop();

        return true;
      }

      const models = monaco.editor.getModels();
      if (models.length > 0) {
        const model = models[models.length - 1];
        // Use pushEditOperations to preserve undo stack
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: newCode,
            },
          ],
          () => null
        );
        return true;
      }
    }

    // Fallback for CodeMirror 6 (used in LeetCode mobile site)
    const cm6Content = document.querySelector(".cm-content") as HTMLElement;
    if (cm6Content) {
      try {
        cm6Content.focus();

        // Explicitly select all content using Range API
        const range = document.createRange();
        range.selectNodeContents(cm6Content);

        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }

        // Try paste event (execCommand is deprecated)
        let success = false;
        try {
          const dataTransfer = new DataTransfer();
          dataTransfer.setData("text/plain", newCode);
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer,
          });
          cm6Content.dispatchEvent(pasteEvent);
          success = true;
        } catch (e) {
          console.warn("Paste dispatch failed", e);
        }

        if (success) return true;
      } catch (e) {
        console.warn("CM6 insert failed, trying fallback", e);
      }
    }

    console.error("LeetCode Extension: Monaco editor or CodeMirror not found.");
  } catch (e) {
    console.error("LeetCode Extension: Error setting code", e);
  }
  return false;
}

async function ensureTestCaseTab() {
  const testCaseTab = document.getElementById("testcase_tab");
  if (testCaseTab) {
    // if the test case tab is not open
    // dispatch a click event to open it
    const tabButton = testCaseTab.closest(".flexlayout__tab_button");
    if (tabButton) {
      tabButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      tabButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      tabButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function getInjectedTestCases() {
  try {
    await ensureTestCaseTab();
    const testCaseEditor = getTestCaseEditor();

    return testCaseEditor ? testCaseEditor.innerText : "";
  } catch (e) {
    console.error("LeetCode Extension: Error getting test cases", e);
  }
  return "";
}

async function appendInjectedTestCase(newTestCase: string) {
  console.log("LeetCode Extension: appendTestCase called with", newTestCase);
  try {
    await ensureTestCaseTab();
    const testCaseEditor = getTestCaseEditor();

    if (!testCaseEditor) return false;

    testCaseEditor.focus();

    const currentContent = testCaseEditor.innerText;
    const newContent = currentContent
      ? currentContent + "\n" + newTestCase
      : newTestCase;

    // Select all
    const range = document.createRange();
    range.selectNodeContents(testCaseEditor);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // Paste
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", newContent);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });
    testCaseEditor.dispatchEvent(pasteEvent);
    console.log("LeetCode Extension: Appended test case to CodeMirror editor");
    return true;
  } catch (e) {
    console.error("LeetCode Extension: Error appending test case", e);
  }
  return false;
}

// test case editor is always found in CodeMirror 6
function getTestCaseEditor(): HTMLElement | null {
  const cmContents = document.querySelectorAll(".cm-content");
  console.log(
    `LeetCode Extension: Number of CodeMirror editors: ${cmContents.length})`
  );
  // NOTE: logic for getting test case editor was found empirically and may break when LeetCode updates their site
  if (cmContents.length == 1) {
    return cmContents[0] as HTMLElement;
  } else if (cmContents.length == 2) {
    return cmContents[1] as HTMLElement;
  }
  return null;
}
