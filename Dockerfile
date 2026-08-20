FROM python:3.12-slim-trixie

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql \
        postgresql-contrib \
        supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /tmp/backend-requirements.txt
COPY frontend/requirements.txt /tmp/frontend-requirements.txt

RUN pip install --no-cache-dir \
        -r /tmp/backend-requirements.txt \
        -r /tmp/frontend-requirements.txt

COPY backend /app/backend
COPY frontend /app/frontend
COPY database /app/database

EXPOSE 5000

COPY start.sh /start.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /start.sh

VOLUME ["/var/lib/postgresql/data"]

ENTRYPOINT ["/start.sh"]