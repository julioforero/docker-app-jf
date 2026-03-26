# Proyecto: Visualizador de Transporte Serverless
**Estudiante:** Julio Forero

## Arquitectura
1. **Dataset:** CSV de transporte cargado mediante Python/Pandas.
2. **Base de Datos:** Google Firestore (NoSQL Serverless).
3. **Backend:** Python Flask contenerizado.
4. **Infraestructura:** Desplegado en **Google Cloud Run**.

## Cómo ejecutar el contenedor localmente
1. `docker build -t app-transporte .`
2. `docker run -p 8080:8080 app-transporte`