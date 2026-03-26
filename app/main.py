import os
from flask import Flask, render_template, request
from google.cloud import firestore

app = Flask(__name__)

# Conexión a tu base de datos específica en dev-gcp-qa
# Usamos el ID de la base de datos que creaste: 'costos-transporte'
db = firestore.Client(project='dev-gcp-qa', database='costo-transporte')

@app.route('/')
def index():
    # Captura lo que el usuario escribe en el buscador
    search_query = request.args.get('search', '').strip().upper()
    docs_ref = db.collection('transporte')
    
    if search_query:
        # Filtra por la columna ORIGEN (debe ser coincidencia exacta)
        docs = docs_ref.where('ORIGEN', '==', search_query).stream()
    else:
        # Si no hay búsqueda, muestra los últimos 15 registros
        docs = docs_ref.limit(15).stream()

    lista_datos = [doc.to_dict() for doc in docs]
    return render_template('index.html', docs=lista_datos)

if __name__ == "__main__":
    # Importante para Cloud Run: debe escuchar en el puerto que asigne Google
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)