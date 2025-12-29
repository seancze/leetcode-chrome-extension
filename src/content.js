// Inject the script to interact with Monaco Editor
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
(document.head || document.documentElement).appendChild(script);

let currentProblemSlug = "";
let chatHistory = [];
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
          <button class="letc-btn letc-btn-primary" id="letc-generate">Generate Code</button>
        </div>
        <div class="letc-status" id="letc-status"></div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Event Listeners
  document
    .getElementById("letc-minimize")
    .addEventListener("click", toggleCollapse);
  document
    .getElementById("letc-generate")
    .addEventListener("click", handleGenerate);
  document.getElementById("letc-clear").addEventListener("click", clearHistory);

  // Drag functionality
  const header = document.getElementById("letc-header");
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === header || e.target.parentNode === header) {
      isDragging = true;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, panel);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}

function toggleCollapse() {
  const panel = document.getElementById("leetcode-english-to-code-panel");
  const btn = document.getElementById("letc-minimize");
  isPanelCollapsed = !isPanelCollapsed;

  if (isPanelCollapsed) {
    panel.classList.add("collapsed");
    btn.textContent = "+";
  } else {
    panel.classList.remove("collapsed");
    btn.textContent = "−";
  }
}

async function handleGenerate() {
  const input = document.getElementById("letc-input");
  const userPrompt = input.value.trim();
  const status = document.getElementById("letc-status");
  const generateBtn = document.getElementById("letc-generate");

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

    // Send to Background
    const response = await chrome.runtime.sendMessage({
      action: "generateCode",
      data: {
        currentCode: currentCode,
        chatHistory: chatHistory,
        userPrompt: userPrompt,
      },
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const endTime = performance.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

    // Update Chat History
    chatHistory.push({ role: "user", content: userPrompt });
    chatHistory.push({ role: "assistant", content: response.code });

    saveHistory();
    renderHistory();

    // 5. Inject Code
    try {
      await setCurrentCode(response.code);
      status.textContent = `Code generated in ${timeTaken}s and inserted!`;
      status.style.color = "green";
    } catch (insertError) {
      console.warn("Auto-insertion failed:", insertError);
      status.innerHTML = `Code generated in ${timeTaken}s but failed to insert.`;
      status.style.color = "orange";
      status.className = "letc-status"; // Reset error class if any

      const copyBtn = document.createElement("button");
      copyBtn.className = "letc-btn letc-btn-primary letc-btn-xs";
      copyBtn.textContent = "Copy Code";
      copyBtn.style.marginLeft = "10px";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(response.code).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => (copyBtn.textContent = "Copy Code"), 2000);
        });
      };
      status.appendChild(copyBtn);
    }

    // 6. Clear Input
    input.value = "";
  } catch (error) {
    status.textContent = error.message;
    status.className = "letc-status error";
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Code";
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
    title = titleElement.innerText;
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
    if (containers.length > 0) description = containers[0].innerText;
  } else {
    description = descElement.innerText;
  }

  return { title, description };
}

function getCurrentCode() {
  return new Promise((resolve) => {
    window.postMessage({ type: "LEETCODE_EXTENSION_GET_CODE" }, "*");

    const listener = (event) => {
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

function setCurrentCode(code) {
  return new Promise((resolve, reject) => {
    window.postMessage(
      { type: "LEETCODE_EXTENSION_SET_CODE", code: code },
      "*"
    );

    const listener = (event) => {
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

function loadHistory() {
  chrome.storage.local.get([`history_${currentProblemSlug}`], (result) => {
    chatHistory = result[`history_${currentProblemSlug}`] || [];
    renderHistory();
  });
}

function saveHistory() {
  const key = `history_${currentProblemSlug}`;
  const data = {};
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
