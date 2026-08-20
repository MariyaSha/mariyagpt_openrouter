const newChatForm = document.getElementById(
    "new-chat-form"
);

const conversationList = document.getElementById(
    "conversation-list"
);

const messageForm = document.getElementById(
    "message-form"
);

const input = document.getElementById("message");

const sendButton = document.getElementById(
    "send-button"
);

const messagesContainer = document.getElementById(
    "chat-messages"
);

const currentUser = document.getElementById(
    "current-user"
);

const logoutButton = document.getElementById(
    "logout-button"
);

const sidebar = document.getElementById("sidebar");

const openButton = document.getElementById(
    "sidebar-toggle"
);

const closeButton = document.getElementById(
    "sidebar-close"
);

const newChatModal = document.getElementById(
    "new-chat-modal"
);

const newChatTitle = document.getElementById(
    "new-chat-title"
);

const newChatCancel = document.getElementById(
    "new-chat-cancel"
);

const newChatCreate = document.getElementById(
    "new-chat-create"
);


let activeConversationId =
    window.INITIAL_CONVERSATION_ID;

input.addEventListener("keydown", (event) => {
    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
    ) {
        event.preventDefault();
        messageForm.requestSubmit();
    }
});

input.addEventListener(
    "input",
    resizeMessageInput
);


function apiRequest(path, options = {}) {
    return fetch(
        `${window.BACKEND_URL}${path}`,
        {
            ...options,
            credentials: "include",
            headers: {
                ...options.headers
            }
        }
    );
}


async function readJsonResponse(response) {
    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401) {
        window.location.href = "/";
        throw new Error("Please log in again.");
    }

    if (!response.ok) {
        throw new Error(
            data.detail || "The request failed."
        );
    }

    return data;
}


function scrollToBottom() {
    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


function clearMessages() {
    messagesContainer.innerHTML = "";
}


function showEmptyState() {
    clearMessages();

    const emptyState = document.createElement("div");
    emptyState.className = "empty-chat";

    const heading = document.createElement("h2");
    heading.textContent =
        "How can I help you today?";

    const description = document.createElement("p");
    description.textContent =
        "Send a message to begin this conversation.";

    emptyState.appendChild(heading);
    emptyState.appendChild(description);

    messagesContainer.appendChild(emptyState);
}


function removeEmptyState() {
    const emptyChat = messagesContainer.querySelector(
        ".empty-chat"
    );

    if (emptyChat) {
        emptyChat.remove();
    }
}


function formatInlineText(text) {
    let formatted = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    formatted = formatted.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
    );

    formatted = formatted.replace(
        /\*(.+?)\*/g,
        "<em>$1</em>"
    );

    return formatted;
}


function splitTableRow(line) {
    return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
}


function formatAssistantText(text) {
    const lines = text.split("\n");
    const output = [];

    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const nextLine = lines[index + 1];

        // Markdown table
        if (
            line.includes("|") &&
            nextLine &&
            /^\s*\|?\s*:?-{3,}/.test(nextLine)
        ) {
            const headers =
                splitTableRow(line);

            const rows = [];

            index += 2;

            while (
                index < lines.length &&
                lines[index].includes("|") &&
                lines[index].trim()
            ) {
                rows.push(
                    splitTableRow(lines[index])
                );

                index++;
            }

            let table =
                '<div class="markdown-table-wrapper">' +
                "<table>" +
                "<thead><tr>";

            for (const header of headers) {
                table +=
                    `<th>${formatInlineText(header)}</th>`;
            }

            table += "</tr></thead><tbody>";

            for (const row of rows) {
                table += "<tr>";

                for (const cell of row) {
                    table +=
                        `<td>${formatInlineText(cell)}</td>`;
                }

                table += "</tr>";
            }

            table +=
                "</tbody></table></div>";

            output.push(table);

            continue;
        }

        // Horizontal divider
        if (/^\s*---\s*$/.test(line)) {
            output.push("<hr>");
            index++;
            continue;
        }

        // Headings
        if (/^####\s+(.+)$/.test(line)) {
            output.push(
                line.replace(
                    /^####\s+(.+)$/,
                    "<h4>$1</h4>"
                )
            );

            index++;
            continue;
        }

        if (/^###\s+(.+)$/.test(line)) {
            output.push(
                line.replace(
                    /^###\s+(.+)$/,
                    "<h3>$1</h3>"
                )
            );

            index++;
            continue;
        }

        if (/^##\s+(.+)$/.test(line)) {
            output.push(
                line.replace(
                    /^##\s+(.+)$/,
                    "<h2>$1</h2>"
                )
            );

            index++;
            continue;
        }

        if (/^#\s+(.+)$/.test(line)) {
            output.push(
                line.replace(
                    /^#\s+(.+)$/,
                    "<h1>$1</h1>"
                )
            );

            index++;
            continue;
        }

        output.push(
            formatInlineText(line)
        );

        index++;
    }

    return output.join("\n");
}

function createUserMessage(content) {
    const row = document.createElement("div");
    row.className = "message-row user-row";

    const bubble = document.createElement("div");
    bubble.className = "message user-message";
    bubble.textContent = content;

    row.appendChild(bubble);
    messagesContainer.appendChild(row);
}


function createAssistantMessage(content = "") {
    const row = document.createElement("div");
    row.className = "message-row assistant-row";

    const bubble = document.createElement("div");
    bubble.className = "message assistant-message";
    bubble.innerHTML = formatAssistantText(content);

    row.appendChild(bubble);
    messagesContainer.appendChild(row);

    return {
        row,
        bubble
    };
}


function createStreamingAssistantMessage() {
    const row = document.createElement("div");
    row.className = "message-row assistant-row";

    const contentArea = document.createElement("div");
    contentArea.className = "assistant-content";

    const status = document.createElement("div");
    status.className = "assistant-status";
    status.textContent = "Thinking…";

    const bubble = document.createElement("div");
    bubble.className = "message assistant-message";

    contentArea.appendChild(status);
    contentArea.appendChild(bubble);
    row.appendChild(contentArea);

    messagesContainer.appendChild(row);

    return {
        row,
        bubble,
        status
    };
}


function showPageError(message) {
    clearMessages();

    const row = document.createElement("div");
    row.className = "message-row assistant-row";

    const error = document.createElement("div");
    error.className = "message error-message";
    error.textContent = message;

    row.appendChild(error);
    messagesContainer.appendChild(row);
}


function renderMessages(messages) {
    if (messages.length === 0) {
        showEmptyState();
        return;
    }

    clearMessages();

    for (const message of messages) {
        if (message.role === "user") {
            createUserMessage(message.content);
        } else {
            createAssistantMessage(message.content);
        }
    }

    scrollToBottom();
}


function renderConversations(conversations) {
    conversationList.innerHTML = "";

    for (const conversation of conversations) {
        const link = document.createElement("a");

        link.href = `/chat/${conversation.id}`;
        link.className = "conversation-link";
        link.textContent = conversation.title;

        if (conversation.id === activeConversationId) {
            link.classList.add("active");
        }

        link.addEventListener("click", async (event) => {
            event.preventDefault();

            await openConversation(
                conversation.id,
                true
            );

            if (window.innerWidth <= 700) {
                sidebar.classList.add(
                    "sidebar-hidden"
                );
            }
        });

        conversationList.appendChild(link);
    }
}

function resizeMessageInput() {
    const maximumHeight = 110;

    input.style.height = "auto";

    const newHeight = Math.min(
        input.scrollHeight,
        maximumHeight
    );

    input.style.height = `${newHeight}px`;

    input.style.overflowY =
        input.scrollHeight > maximumHeight
            ? "auto"
            : "hidden";
}


async function loadSetup() {
    const response = await apiRequest("/api/setup");
    const data = await readJsonResponse(response);

    if (!data.ready) {
        window.location.href = "/";
        return false;
    }

    currentUser.textContent =
        `Chatting as ${data.name}`;

    return data;
}


async function loadConversations() {
    const response = await apiRequest(
        "/api/conversations"
    );

    const data = await readJsonResponse(response);

    return data.conversations;
}


async function createConversation(title) {
    const response = await apiRequest(
        "/api/conversations",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: title
            })
        }
    );

    const data = await readJsonResponse(response);

    return data.conversation;
}


async function loadMessages(conversationId) {
    const response = await apiRequest(
        `/api/conversations/${conversationId}/messages`
    );

    const data = await readJsonResponse(response);

    return data.messages;
}


async function openConversation(
    conversationId,
    updateBrowserHistory = false
) {
    activeConversationId = conversationId;

    if (updateBrowserHistory) {
        window.history.pushState(
            {},
            "",
            `/chat/${conversationId}`
        );
    }

    const conversationMessages =
        await loadMessages(conversationId);

    renderMessages(conversationMessages);

    const conversations =
        await loadConversations();

    renderConversations(conversations);
}


async function initializeChat() {
    try {
        const setup = await loadSetup();

        if (!setup) {
            return;
        }

        let conversations =
            await loadConversations();

        if (conversations.length === 0) {
            const conversation =
                await createConversation(
                    `${setup.name}'s First Chat`
                );

            activeConversationId =
                conversation.id;

            conversations =
                await loadConversations();
        }

        const requestedConversationExists =
            conversations.some(
                (conversation) =>
                    conversation.id ===
                    activeConversationId
            );

        if (
            !activeConversationId ||
            !requestedConversationExists
        ) {
            activeConversationId =
                conversations[0].id;
        }

        window.history.replaceState(
            {},
            "",
            `/chat/${activeConversationId}`
        );

        renderConversations(conversations);

        const conversationMessages =
            await loadMessages(
                activeConversationId
            );

        renderMessages(conversationMessages);

    } catch (error) {
        console.error(error);
        showPageError(error.message);
    }
}


newChatForm.addEventListener(
    "submit",
    (event) => {
        event.preventDefault();

        newChatTitle.value = "";
        newChatModal.hidden = false;
        newChatTitle.focus();
    }
);


newChatCancel.addEventListener(
    "click",
    () => {
        newChatModal.hidden = true;
    }
);


newChatCreate.addEventListener(
    "click",
    async () => {
        const title = newChatTitle.value.trim();

        if (!title) {
            newChatTitle.focus();
            return;
        }

        try {
            const conversation =
                await createConversation(title);

            newChatModal.hidden = true;

            await openConversation(
                conversation.id,
                true
            );

        } catch (error) {
            console.error(error);
            showPageError(error.message);
        }
    }
);


newChatTitle.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            newChatCreate.click();
        }

        if (event.key === "Escape") {
            newChatModal.hidden = true;
        }
    }
);


messageForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const userMessage = input.value.trim();

        if (
            !userMessage ||
            !activeConversationId
        ) {
            return;
        }

        removeEmptyState();
        createUserMessage(userMessage);

        const assistantMessage =
            createStreamingAssistantMessage();

        const assistantBubble =
            assistantMessage.bubble;

        const assistantStatus =
            assistantMessage.status;

        input.value = "";
        resizeMessageInput();
        input.disabled = true;
        sendButton.disabled = true;

        scrollToBottom();

        try {
            const response = await apiRequest(
                `/api/conversations/${activeConversationId}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        message: userMessage
                    })
                }
            );

            if (response.status === 401) {
                window.location.href = "/";
                return;
            }

            if (!response.ok) {
                const errorMessage =
                    await response.text();

                throw new Error(errorMessage);
            }

            if (!response.body) {
                throw new Error(
                    "Streaming is not supported by this browser."
                );
            }

            const reader =
                response.body.getReader();

            const decoder = new TextDecoder();

            let firstChunk = true;
            let completeText = "";

            let renderScheduled = false;

            function scheduleRender() {
                if (renderScheduled) {
                    return;
                }

                renderScheduled = true;

                requestAnimationFrame(() => {
                    assistantBubble.innerHTML =
                        formatAssistantText(
                            completeText
                        );

                    scrollToBottom();

                    renderScheduled = false;
                });
            }

            while (true) {
                const result = await reader.read();

                if (result.done) {
                    break;
                }

                const text = decoder.decode(
                    result.value,
                    {
                        stream: true
                    }
                );

                if (firstChunk) {
                    assistantStatus.remove();
                    firstChunk = false;
                }

                completeText += text;
                scheduleRender();
            }

            assistantBubble.innerHTML =
                formatAssistantText(
                    completeText
                );

            scrollToBottom();

            if (firstChunk) {
                assistantStatus.remove();
            }

        } catch (error) {
            console.error(error);

            if (assistantStatus.isConnected) {
                assistantStatus.remove();
            }

            assistantBubble.textContent =
                error.message ||
                "mariyaGPT could not generate a response.";

            assistantBubble.classList.add(
                "error-message"
            );

        } finally {
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        }
    }
);


logoutButton.addEventListener(
    "click",
    async () => {
        try {
            await apiRequest(
                "/api/reset",
                {
                    method: "POST"
                }
            );
        } finally {
            window.location.href = "/";
        }
    }
);


openButton.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar-hidden");
});


closeButton.addEventListener("click", () => {
    sidebar.classList.add("sidebar-hidden");
});


window.addEventListener(
    "popstate",
    async () => {
        const pathParts = window.location.pathname
            .split("/")
            .filter(Boolean);

        const conversationId =
            Number(pathParts[1]);

        if (Number.isInteger(conversationId)) {
            try {
                await openConversation(
                    conversationId,
                    false
                );
            } catch (error) {
                console.error(error);
                showPageError(error.message);
            }
        }
    }
);

resizeMessageInput();

initializeChat();