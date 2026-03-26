# Imagen base liviana
FROM python:3.10-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los requisitos e instalamos
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo el código de la carpeta app
COPY app/ .

# Ejecutamos con Gunicorn para que sea estable en Cloud Run
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app