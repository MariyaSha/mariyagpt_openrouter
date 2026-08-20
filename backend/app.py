import os
from collections.abc import Generator
from datetime import datetime

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI, APIStatusError
from pydantic import BaseModel


load_dotenv()

app = FastAPI(title="MariyaGPT API")

DATABASE_URL = os.getenv("DATABASE_URL")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://127.0.0.1:5000",
)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not configured."
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


runtime = {
    "name": None,
    "api_key": None,
    "model": None,
}


class SetupRequest(BaseModel):
    name: str
    api_key: str
    model: str


class MessageRequest(BaseModel):
    message: str

class ConversationRequest(BaseModel):
    title: str

def create_conversation(title: str):
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO conversations (title)
                VALUES (%s)
                RETURNING
                    id,
                    title,
                    created_at;
                """,
                (title,)
            )

            return cursor.fetchone()

def get_conversation(conversation_id: int):
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    title,
                    created_at
                FROM conversations
                WHERE id = %s;
                """,
                (conversation_id,),
            )

            return cursor.fetchone()


def get_conversations():
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    title,
                    created_at
                FROM conversations
                ORDER BY created_at DESC, id DESC;
                """
            )

            return cursor.fetchall()


def save_message(
    conversation_id: int,
    role: str,
    content: str,
):
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content
                )
                VALUES (%s, %s, %s);
                """,
                (
                    conversation_id,
                    role,
                    content,
                ),
            )


def get_messages(conversation_id: int):
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    role,
                    content,
                    created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY created_at, id;
                """,
                (conversation_id,),
            )

            return cursor.fetchall()


def serialize_datetime(value: datetime) -> str:
    return value.isoformat()


@app.get("/")
def root():
    return {
        "message": "MariyaGPT API is running"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/api/setup")
def setup(data: SetupRequest):
    name = data.name.strip()
    api_key = data.api_key.strip()
    model = data.model.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required.",
        )

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key is required.",
        )

    if not model:
        raise HTTPException(
            status_code=400,
            detail="Model is required.",
        )

    runtime["name"] = name
    runtime["api_key"] = api_key
    runtime["model"] = model

    return {
        "ready": True,
        "name": name,
        "model": model,
    }


@app.get("/api/setup")
def get_setup():
    return {
        "ready": bool(
            runtime["name"]
            and runtime["api_key"]
            and runtime["model"]
        ),
        "name": runtime["name"],
        "model": runtime["model"],
    }


@app.get("/api/conversations")
def list_conversations():
    rows = get_conversations()

    conversations = []

    for row in rows:
        conversations.append(
            {
                "id": row[0],
                "title": row[1],
                "created_at":
                    serialize_datetime(row[2]),
            }
        )

    return {
        "conversations": conversations
    }


@app.post("/api/conversations")
def new_conversation(data: ConversationRequest):
    conversation = create_conversation(data.title)

    return {
        "conversation": {
            "id": conversation[0],
            "title": conversation[1],
            "created_at":
                serialize_datetime(
                    conversation[2]
                ),
        }
    }


@app.get(
    "/api/conversations/{conversation_id}/messages"
)
def list_messages(conversation_id: int):
    conversation = get_conversation(
        conversation_id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    rows = get_messages(conversation_id)

    messages = []

    for row in rows:
        messages.append(
            {
                "role": row[0],
                "content": row[1],
                "created_at":
                    serialize_datetime(row[2]),
            }
        )

    return {
        "conversation": {
            "id": conversation[0],
            "title": conversation[1],
            "created_at":
                serialize_datetime(
                    conversation[2]
                ),
        },
        "messages": messages,
    }


@app.post(
    "/api/conversations/{conversation_id}/messages"
)
def stream_message(
    conversation_id: int,
    data: MessageRequest,
):
    if not runtime["api_key"]:
        raise HTTPException(
            status_code=400,
            detail=(
                "MariyaGPT is not configured yet."
            ),
        )

    conversation = get_conversation(
        conversation_id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    user_message = data.message.strip()

    if not user_message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message.",
        )

    save_message(
        conversation_id,
        "user",
        user_message,
    )

    stored_messages = get_messages(
        conversation_id
    )

    openrouter_messages = [
        {
            "role": row[0],
            "content": row[1],
        }
        for row in stored_messages
    ]

    def generate() -> Generator[str, None, None]:
        complete_response = ""

        try:
            client = OpenAI(
                base_url=(
                    "https://openrouter.ai/api/v1"
                ),
                api_key=runtime["api_key"],
            )

            stream = client.chat.completions.create(
                model=runtime["model"],
                messages=openrouter_messages[-20:],
                stream=True,
                extra_body={
                    "provider": {
                        "sort": "latency"
                    }
                },
            )

            for chunk in stream:
                token = (
                    chunk.choices[0]
                    .delta.content
                )

                if token:
                    complete_response += token
                    yield token

            if complete_response:
                save_message(
                    conversation_id,
                    "assistant",
                    complete_response,
                )

        except APIStatusError as error:
            print(
                "OpenRouter API error:",
                repr(error),
            )

            if error.status_code == 404:
                yield (
                    "This model is no longer available on OpenRouter. "
                    "Press Log out to return to the setup page and choose a different model."
                )

            elif error.status_code == 429:
                yield (
                    "This model is temporarily rate-limited. "
                    "Please try again shortly, or press Log out to return to the setup page "
                    "and choose a different model."
                )

            else:
                yield (
                    "OpenRouter could not use the selected model. "
                    "Press Log out to return to the setup page and choose a different model."
                )

        except Exception as error:
            print(
                "OpenRouter streaming error:",
                repr(error),
            )

            yield (
                "MariyaGPT could not complete the response. "
                "Please try again."
            )

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/reset")
def reset_setup():
    runtime["name"] = None
    runtime["api_key"] = None
    runtime["model"] = None

    return {
        "ready": False
    }