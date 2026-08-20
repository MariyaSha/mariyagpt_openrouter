import os
import time

import requests
from flask import (
    Flask,
    Response,
    render_template,
    request,
)


app = Flask(__name__)

app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

STATIC_VERSION = str(int(time.time()))

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://127.0.0.1:8000",
)


@app.context_processor
def inject_globals():
    return {
        "backend_url": "",
        "static_version": STATIC_VERSION,
    }


@app.get("/")
def home():
    return render_template("home.html")


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/chat")
@app.get("/chat/<int:conversation_id>")
def chat(conversation_id=None):
    return render_template(
        "chat.html",
        conversation_id=conversation_id,
    )


@app.route(
    "/api/<path:path>",
    methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    ],
)
def api_proxy(path):
    backend_response = requests.request(
        method=request.method,
        url=f"{BACKEND_URL}/api/{path}",
        headers={
            key: value
            for key, value in request.headers
            if key.lower() not in {
                "host",
                "content-length",
            }
        },
        data=request.get_data(),
        params=request.args,
        stream=True,
        timeout=120,
    )

    excluded_headers = {
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
    }

    headers = [
        (key, value)
        for key, value in backend_response.headers.items()
        if key.lower() not in excluded_headers
    ]

    return Response(
        backend_response.iter_content(
            chunk_size=1024
        ),
        status=backend_response.status_code,
        headers=headers,
    )