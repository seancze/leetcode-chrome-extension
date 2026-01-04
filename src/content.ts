const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
(document.head || document.documentElement).appendChild(script);

interface ChatMessage {
  role: string;
  content: string;
  reasoning?: string;
}

let currentProblemSlug = "";
let chatHistory: ChatMessage[] = [];
let isPanelCollapsed = false;

// Initialize
function init() {
  // Check if we are on a problem page
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  const panel = document.getElementById("leetcode-english-to-code-panel");

  if (match) {
    const newSlug = match[1];
    if (newSlug !== currentProblemSlug) {
      currentProblemSlug = newSlug;
      loadHistory();
      if (!panel) {
        createUI();
      } else {
        panel.style.display = "flex";
        renderHistory();
      }
    } else if (panel && panel.style.display === "none") {
      // If we are on the same problem but panel was hidden (e.g. back navigation)
      panel.style.display = "flex";
    }
  } else {
    // Not on a problem page, hide the panel
    if (panel) {
      panel.style.display = "none";
    }
  }
}

// Run init on load and URL changes
init();
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    init();
  }
}).observe(document, { subtree: true, childList: true });

function createUI() {
  const panel = document.createElement("div");
  panel.id = "leetcode-english-to-code-panel";
  panel.innerHTML = `
    <div class="letc-header" id="letc-header">
      <span class="letc-title">English to Code</span>
      <div class="letc-controls">
        <button class="letc-icon-btn" id="letc-minimize">−</button>
      </div>
    </div>
    <div class="letc-content">
      <div class="letc-history" id="letc-history"></div>
      <div class="letc-input-area">
        <textarea class="letc-input" id="letc-input" placeholder="Describe your solution logic..."></textarea>
        <div class="letc-actions">
          <button class="letc-btn letc-btn-secondary" id="letc-clear">Clear</button>
          <button class="letc-btn letc-btn-primary" id="letc-generate-test">Test</button>
          <button class="letc-btn letc-btn-primary" id="letc-generate" style="margin-left: 5px;">Code</button>
        </div>
        <div class="letc-status" id="letc-status"></div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Event Listeners
  const minimizeBtn = document.getElementById("letc-minimize");
  if (minimizeBtn) minimizeBtn.addEventListener("click", toggleCollapse);

  const generateBtn = document.getElementById("letc-generate");
  if (generateBtn) generateBtn.addEventListener("click", handleGenerate);

  const generateTestBtn = document.getElementById("letc-generate-test");
  if (generateTestBtn)
    generateTestBtn.addEventListener("click", handleGenerateTest);

  const clearBtn = document.getElementById("letc-clear");
  if (clearBtn) clearBtn.addEventListener("click", clearHistory);

  // auto resize textarea as user types
  const inputArea = document.getElementById(
    "letc-input"
  ) as HTMLTextAreaElement;
  if (inputArea) {
    inputArea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  }

  // Drag functionality
  const header = document.getElementById("letc-header");
  let isDragging = false;
  let currentX: number;
  let currentY: number;
  let initialX: number;
  let initialY: number;
  let xOffset = 0;
  let yOffset = 0;

  if (header) {
    header.addEventListener("mousedown", dragStart);
  }
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e: MouseEvent) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (
      e.target === header ||
      (e.target as HTMLElement).parentNode === header
    ) {
      isDragging = true;
    }
  }

  function dragEnd(e: MouseEvent) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e: MouseEvent) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, panel);
    }
  }

  function setTranslate(xPos: number, yPos: number, el: HTMLElement) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}

function toggleCollapse() {
  const panel = document.getElementById("leetcode-english-to-code-panel");
  const btn = document.getElementById("letc-minimize");
  isPanelCollapsed = !isPanelCollapsed;

  if (panel && btn) {
    if (isPanelCollapsed) {
      panel.classList.add("collapsed");
      btn.textContent = "+";
    } else {
      panel.classList.remove("collapsed");
      btn.textContent = "−";
    }
  }
}

async function handleGenerate() {
  const input = document.getElementById("letc-input") as HTMLTextAreaElement;
  const status = document.getElementById("letc-status");
  const generateBtn = document.getElementById(
    "letc-generate"
  ) as HTMLButtonElement;

  if (!input || !status || !generateBtn) return;

  const userPrompt = input.value.trim();
  if (!userPrompt) return;

  // UI Loading State
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  status.textContent = "";
  status.className = "letc-status";

  const startTime = performance.now();

  try {
    // Get Current Code
    const currentCode = await getCurrentCode();

    // Update Chat History with User Prompt
    chatHistory.push({ role: "user", content: userPrompt });

    // Add placeholder for Assistant Response
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      reasoning: "",
    };
    chatHistory.push(assistantMsg);
    renderHistory();

    // Connect to Background Script
    const port = chrome.runtime.connect({ name: "generateCode" });

    // Send Request
    port.postMessage({
      currentCode: currentCode,
      chatHistory: chatHistory.slice(0, -2), // Exclude current user prompt and placeholder
      userPrompt: userPrompt,
    });

    let accumulatedCode = "";
    let accumulatedReasoning = "";

    port.onMessage.addListener(async (msg) => {
      if (msg.error) {
        status.textContent = msg.error;
        status.className = "letc-status error";
        generateBtn.disabled = false;
        generateBtn.textContent = "Code";
        return;
      }

      if (msg.type === "chunk") {
        const { type, content } = msg.data;
        if (type === "text") {
          accumulatedCode += content;
          assistantMsg.content = accumulatedCode;
        } else if (type === "reasoning") {
          accumulatedReasoning += content;
          assistantMsg.reasoning = accumulatedReasoning;
        }
        // Update UI efficiently
        updateLastMessage(assistantMsg);
      } else if (msg.type === "complete") {
        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        saveHistory();

        // Inject Code
        try {
          await setCurrentCode(msg.code);
          status.textContent = `Code generated in ${timeTaken}s and inserted!`;
          status.style.color = "green";
        } catch (insertError) {
          console.warn("Auto-insertion failed:", insertError);
          status.innerHTML = `Code generated in ${timeTaken}s but failed to insert.`;
          status.style.color = "orange";
          status.className = "letc-status";

          const copyBtn = document.createElement("button");
          copyBtn.className = "letc-btn letc-btn-primary letc-btn-xs";
          copyBtn.textContent = "Copy Code";
          copyBtn.style.marginLeft = "10px";
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(msg.code).then(() => {
              copyBtn.textContent = "Copied!";
              setTimeout(() => (copyBtn.textContent = "Copy Code"), 2000);
            });
          };
          status.appendChild(copyBtn);
        }

        // Clear Input
        input.value = "";
        input.style.height = "40px";
        generateBtn.disabled = false;
        generateBtn.textContent = "Code";
      }
    });
  } catch (error: any) {
    status.textContent = error.message;
    status.className = "letc-status error";
    generateBtn.disabled = false;
    generateBtn.textContent = "Code";
  }
}

function updateLastMessage(msg: ChatMessage) {
  const container = document.getElementById("letc-history");
  if (!container) return;

  const lastMsgDiv = container.lastElementChild;
  if (lastMsgDiv && lastMsgDiv.classList.contains("assistant")) {
    // Re-render the content of the last message
    lastMsgDiv.innerHTML = "";

    if (msg.reasoning) {
      const reasoningDiv = document.createElement("div");
      reasoningDiv.className = "letc-reasoning";
      reasoningDiv.style.fontSize = "0.8em";
      reasoningDiv.style.color = "#888";
      reasoningDiv.style.marginBottom = "5px";
      reasoningDiv.style.fontStyle = "italic";
      reasoningDiv.textContent = "Thinking: " + msg.reasoning;
      lastMsgDiv.appendChild(reasoningDiv);
    }

    const contentDiv = document.createElement("div");
    if (msg.content.length > 200) {
      contentDiv.textContent = "Code generated (click Apply to view/use).";
      contentDiv.title = msg.content;
    } else {
      contentDiv.textContent = msg.content;
    }
    lastMsgDiv.appendChild(contentDiv);

    // Add Apply Button (only if there is content)
    if (msg.content) {
      const applyBtn = document.createElement("button");
      applyBtn.className = "letc-btn letc-btn-secondary letc-btn-xs";
      applyBtn.textContent = "Apply Code";
      applyBtn.style.marginTop = "5px";
      applyBtn.onclick = async () => {
        const status = document.getElementById("letc-status");
        if (!status) return;
        try {
          status.textContent = "Applying code...";
          await setCurrentCode(msg.content);
          status.textContent = "Code applied from history!";
          status.style.color = "green";
        } catch (e) {
          status.innerHTML = "Failed to apply code. ";
          status.className = "letc-status error";

          const copyBtn = document.createElement("button");
          copyBtn.className = "letc-btn letc-btn-primary letc-btn-xs";
          copyBtn.textContent = "Copy Code";
          copyBtn.style.marginLeft = "10px";
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(msg.content).then(() => {
              copyBtn.textContent = "Copied!";
              setTimeout(() => (copyBtn.textContent = "Copy Code"), 2000);
            });
          };
          status.appendChild(copyBtn);
        }
      };
      lastMsgDiv.appendChild(applyBtn);
    }

    container.scrollTop = container.scrollHeight;
  } else {
    // Fallback if structure mismatch
    renderHistory();
  }
}

async function handleGenerateTest() {
  const status = document.getElementById("letc-status");
  const generateTestBtn = document.getElementById(
    "letc-generate-test"
  ) as HTMLButtonElement;

  if (!status || !generateTestBtn) return;

  // UI Loading State
  generateTestBtn.disabled = true;
  generateTestBtn.textContent = "Generating Test...";
  status.textContent = "";
  status.className = "letc-status";

  const startTime = performance.now();

  try {
    // Get Problem Details
    const problemDetails = getProblemDetails();
    if (!problemDetails.title) {
      throw new Error(
        "Could not find problem details. Please ensure you are on a problem page."
      );
    }

    // Get Current Code
    const currentCode = await getCurrentCode();

    // Get Current Test Cases
    const currentTestCases = await getTestCases();

    const port = chrome.runtime.connect({ name: "generateTest" });
    port.postMessage({
      currentCode: currentCode,
      problemDetails: problemDetails,
      currentTestCases: currentTestCases,
    });

    port.onMessage.addListener(async (msg) => {
      if (msg.error) {
        status.textContent = msg.error;
        status.className = "letc-status error";
        generateTestBtn.disabled = false;
        generateTestBtn.textContent = "Test";
        return;
      }

      if (msg.type === "chunk") {
        // Optional: Show thinking for test generation in status
        if (msg.data.type === "reasoning") {
          status.textContent =
            "Thinking: " + msg.data.content.substring(0, 50) + "...";
        }
      } else if (msg.type === "complete") {
        const response = msg.result;
        const endTime = performance.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        if (response.isUserCorrect) {
          status.textContent = `Code appears correct! No new test case needed. (${timeTaken}s)`;
          status.style.color = "green";
        } else {
          // Append Test Case
          try {
            await appendTestCase(response.testCase);
            status.textContent = `Test case generated in ${timeTaken}s and appended!`;
            status.style.color = "green";
          } catch (appendError) {
            console.warn("Auto-append failed:", appendError);
            status.innerHTML = `Test case generated in ${timeTaken}s but failed to append.`;
            status.style.color = "orange";
            status.className = "letc-status";

            const copyBtn = document.createElement("button");
            copyBtn.className = "letc-btn letc-btn-primary letc-btn-xs";
            copyBtn.textContent = "Copy Test Case";
            copyBtn.style.marginLeft = "10px";
            copyBtn.onclick = () => {
              navigator.clipboard.writeText(response.testCase).then(() => {
                copyBtn.textContent = "Copied!";
                setTimeout(
                  () => (copyBtn.textContent = "Copy Test Case"),
                  2000
                );
              });
            };
            status.appendChild(copyBtn);
          }
        }
        generateTestBtn.disabled = false;
        generateTestBtn.textContent = "Test";
      }
    });
  } catch (error: any) {
    status.textContent = error.message;
    status.className = "letc-status error";
    generateTestBtn.disabled = false;
    generateTestBtn.textContent = "Test";
  }
}

function getProblemDetails() {
  // Selectors for LeetCode's new UI (React based)
  // Title
  let title = "";
  const titleElement =
    document.querySelector(
      "div.flex.items-start.justify-between.gap-4 > div.flex.items-center.gap-2 > div"
    ) || document.querySelector('[data-cy="question-title"]');
  if (titleElement) {
    title = (titleElement as HTMLElement).innerText;
  } else {
    // Fallback to document title
    const docTitle = document.title;
    if (docTitle) {
      title = docTitle.split("-")[0].trim();
    }
  }

  // Description
  let description = "";
  const descElement =
    document.querySelector('[data-track-load="description_content"]') ||
    document.querySelector("div.elfjS"); // Old class, might be outdated

  // Fallback: try to find the container with many paragraphs
  if (!descElement) {
    // This is a bit hacky, but LeetCode classes are obfuscated
    const containers = document.querySelectorAll("div.xFUwe"); // Another potential class
    if (containers.length > 0)
      description = (containers[0] as HTMLElement).innerText;
  } else {
    description = (descElement as HTMLElement).innerText;
  }

  return { title, description };
}

function getCurrentCode() {
  return new Promise((resolve) => {
    window.postMessage({ type: "LEETCODE_EXTENSION_GET_CODE" }, "*");

    const listener = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.type === "LEETCODE_EXTENSION_CODE_RESPONSE"
      ) {
        window.removeEventListener("message", listener);
        resolve(event.data.code);
      }
    };
    window.addEventListener("message", listener);

    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve("");
    }, 5000);
  });
}

function setCurrentCode(code: string) {
  return new Promise<void>((resolve, reject) => {
    window.postMessage(
      { type: "LEETCODE_EXTENSION_SET_CODE", code: code },
      "*"
    );

    const listener = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.type === "LEETCODE_EXTENSION_SET_CODE_RESPONSE"
      ) {
        window.removeEventListener("message", listener);
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error("Failed to insert code into editor."));
        }
      }
    };
    window.addEventListener("message", listener);

    // Timeout
    setTimeout(() => {
      window.removeEventListener("message", listener);
      reject(new Error("Timeout waiting for editor response."));
    }, 5000);
  });
}

function getTestCases() {
  return new Promise((resolve) => {
    window.postMessage({ type: "LEETCODE_EXTENSION_GET_TEST_CASES" }, "*");

    const listener = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.type === "LEETCODE_EXTENSION_TEST_CASES_RESPONSE"
      ) {
        window.removeEventListener("message", listener);
        resolve(event.data.testCases);
      }
    };
    window.addEventListener("message", listener);

    setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve("");
    }, 5000);
  });
}

function appendTestCase(testCase: string) {
  return new Promise<void>((resolve, reject) => {
    window.postMessage(
      { type: "LEETCODE_EXTENSION_APPEND_TEST_CASE", testCase: testCase },
      "*"
    );

    const listener = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.data.type === "LEETCODE_EXTENSION_APPEND_TEST_CASE_RESPONSE"
      ) {
        window.removeEventListener("message", listener);
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error("Failed to append test case"));
        }
      }
    };
    window.addEventListener("message", listener);

    setTimeout(() => {
      window.removeEventListener("message", listener);
      reject(new Error("Timeout waiting for editor response."));
    }, 5000);
  });
}

function loadHistory() {
  chrome.storage.local.get([`history_${currentProblemSlug}`], (result) => {
    chatHistory =
      (result[`history_${currentProblemSlug}`] as ChatMessage[]) || [];
    renderHistory();
  });
}

function saveHistory() {
  const key = `history_${currentProblemSlug}`;
  const data: { [key: string]: ChatMessage[] } = {};
  data[key] = chatHistory;
  chrome.storage.local.set(data);
}

function clearHistory() {
  chatHistory = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById("letc-history");
  if (!container) return;

  container.innerHTML = "";
  chatHistory.forEach((msg) => {
    const div = document.createElement("div");
    div.className = `letc-message ${msg.role}`;

    if (msg.role === "assistant") {
      if (msg.reasoning) {
        const reasoningDiv = document.createElement("div");
        reasoningDiv.className = "letc-reasoning";
        reasoningDiv.style.fontSize = "0.8em";
        reasoningDiv.style.color = "#888";
        reasoningDiv.style.marginBottom = "5px";
        reasoningDiv.style.fontStyle = "italic";
        reasoningDiv.textContent = "Thinking: " + msg.reasoning;
        div.appendChild(reasoningDiv);
      }

      const contentDiv = document.createElement("div");
      // Truncate code in display if it's too long
      if (msg.content.length > 200) {
        contentDiv.textContent = "Code generated (click Apply to view/use).";
        contentDiv.title = msg.content; // Tooltip with full code
      } else {
        contentDiv.textContent = msg.content;
      }
      div.appendChild(contentDiv);

      // Add Apply Button
      const applyBtn = document.createElement("button");
      applyBtn.className = "letc-btn letc-btn-secondary letc-btn-xs";
      applyBtn.textContent = "Apply Code";
      applyBtn.style.marginTop = "5px";
      applyBtn.onclick = async () => {
        const status = document.getElementById("letc-status");
        if (!status) return;
        try {
          status.textContent = "Applying code...";
          await setCurrentCode(msg.content);
          status.textContent = "Code applied from history!";
          status.style.color = "green";
        } catch (e) {
          status.innerHTML = "Failed to apply code. ";
          status.className = "letc-status error";

          const copyBtn = document.createElement("button");
          copyBtn.className = "letc-btn letc-btn-primary letc-btn-xs";
          copyBtn.textContent = "Copy Code";
          copyBtn.style.marginLeft = "10px";
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(msg.content).then(() => {
              copyBtn.textContent = "Copied!";
              setTimeout(() => (copyBtn.textContent = "Copy Code"), 2000);
            });
          };
          status.appendChild(copyBtn);
        }
      };
      div.appendChild(applyBtn);
    } else {
      div.textContent = msg.content;
    }
    container.appendChild(div);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}
