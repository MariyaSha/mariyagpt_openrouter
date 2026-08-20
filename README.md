# MariyaGPT

MariyaGPT is a lightweight AI chat application that runs locally with Docker.

It provides a simple ChatGPT-style interface powered by OpenRouter, with persistent conversation history stored in PostgreSQL.

The application is packaged as a single Docker image so users can run the complete frontend, backend, and database without installing Python, PostgreSQL, Flask, or FastAPI on their computer.

Developers can also clone the source code, customize the application, and rebuild the image themselves.

## Architecture

MariyaGPT uses three main components packaged inside a single Docker container:

```text
Browser
   │
   ▼
Flask Frontend
   │
   ▼
FastAPI Backend
   ├──► OpenRouter
   │       └──► Selected AI Model
   │
   └──► PostgreSQL
           └──► Conversations and Messages
```

The main components are:

* **Flask** — serves the web interface.
* **FastAPI** — handles application logic and communication with OpenRouter.
* **PostgreSQL** — stores conversation titles and message history.
* **OpenRouter** — provides access to the AI models available in the model selector.
* **Docker** — packages the complete application and its dependencies into one image.

Only the Flask frontend is exposed to the host computer on port `5000`. The FastAPI backend and PostgreSQL database remain internal to the container.

## Requirements

To run MariyaGPT you need:

* Docker Desktop or Docker Engine
* An OpenRouter API key

You do not need to install Python, PostgreSQL, Flask, FastAPI, or any other application dependencies manually.

## Run with Docker

Pull the image from Docker Hub:

```bash
docker pull mariyasha/mariyagpt_openrouter:latest
```

Create and start the container:

```bash
docker run -d \
  --name mariyagpt \
  -p 5000:5000 \
  -v mariyagpt_data:/var/lib/postgresql/data \
  mariyasha/mariyagpt_openrouter:latest
```

Then open:

```text
http://localhost:5000
```

The `mariyagpt_data` Docker volume keeps your conversation history available even if the MariyaGPT container is stopped, removed, or replaced.

## OpenRouter Setup

When MariyaGPT starts without an active setup, the setup page asks for:

* Your name
* Your OpenRouter API key
* The AI model you want to use

The model can be selected directly from the model selector.

The selector contains a curated collection of free models available through OpenRouter. Model availability and free-tier limits are controlled by OpenRouter and may change over time.

If a selected model becomes unavailable or temporarily rate-limited, MariyaGPT displays an error so you can return to the setup page and select another model.

## API Key Privacy

Your OpenRouter API key is **not stored in PostgreSQL**.

The key is entered through the MariyaGPT setup interface and kept only in the running application's memory.

PostgreSQL stores:

* Conversation titles
* User messages
* Assistant messages

It does **not** store your OpenRouter API key.

Using **Log out** clears the current runtime setup, including:

* Your name
* Your OpenRouter API key
* Your selected model

Because these values exist only in memory, you will also be asked to enter them again after the container is restarted.

Your stored conversations remain available through the Docker volume.

## Persistent Conversations

Conversation titles and messages are stored in PostgreSQL.

The PostgreSQL data directory is persisted using the Docker volume:

```text
mariyagpt_data
```

This means you can stop and remove the MariyaGPT container without losing your conversations, provided that you keep the Docker volume.

For example:

```bash
docker stop mariyagpt
docker rm mariyagpt
```

You can then create a new container using the same volume:

```bash
docker run -d \
  --name mariyagpt \
  -p 5000:5000 \
  -v mariyagpt_data:/var/lib/postgresql/data \
  mariyasha/mariyagpt_openrouter:latest
```

Your previous conversations will still be available.

## Delete All Local Conversation Data

To completely reset MariyaGPT and permanently delete all stored conversations, remove the container and its Docker volume:

```bash
docker stop mariyagpt
docker rm mariyagpt
docker volume rm mariyagpt_data
```

The next time you start MariyaGPT with a new `mariyagpt_data` volume, PostgreSQL will automatically initialize a fresh database.

**Warning:** deleting the Docker volume permanently deletes all conversations stored inside it.

## Build from Source

Clone the GitHub repository:

```bash
git clone https://github.com/MariyaSha/mariyagpt_openrouter.git
cd mariyagpt_openrouter
```

Build the Docker image:

```bash
docker build -t mariyagpt_openrouter .
```

Run the locally built image:

```bash
docker run -d \
  --name mariyagpt \
  -p 5000:5000 \
  -v mariyagpt_data:/var/lib/postgresql/data \
  mariyagpt_openrouter
```

Then open:

```text
http://localhost:5000
```

Developers can modify the Flask frontend, FastAPI backend, database schema, styles, JavaScript, or model selector and rebuild the image using the same Docker commands.

## Project Structure

```text
mariyagpt_openrouter/
├── .dockerignore
├── .gitignore
├── Dockerfile
├── LICENSE
├── README.md
├── start.sh
├── supervisord.conf
│
├── backend/
│   ├── app.py
│   └── requirements.txt
│
├── database/
│   └── schema.sql
│
└── frontend/
    ├── app.py
    ├── requirements.txt
    ├── static/
    │   ├── chat.js
    │   ├── setup.js
    │   └── styles.css
    └── templates/
        ├── chat.html
        └── home.html
```

## License

MariyaGPT is released under the MIT License.

See the `LICENSE` file for details.
