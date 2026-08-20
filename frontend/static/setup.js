const form = document.getElementById("setup-form");
const errorMessage = document.getElementById("setup-error");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    errorMessage.textContent = "";

    const name = document.getElementById("name").value.trim();
    const apiKey = document.getElementById("api-key").value.trim();
    const model = document.getElementById("model").value;

    try {
        const response = await fetch(
            `${window.BACKEND_URL}/api/setup`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: name,
                    api_key: apiKey,
                    model: model,
                }),
            }
        );

        if (!response.ok) {
            throw new Error("Setup failed.");
        }

        window.location.href = "/chat";

    } catch (error) {
        errorMessage.textContent =
            "Could not connect to the backend.";
    }
});