import pandas as pd
from google.cloud import firestore

db = firestore.Client(project='dev-gcp-qa', database='costos-transporte')

path = 'data/DatosTransporte.csv'

def cargar():
    df = pd.read_csv(path, sep=';')
    print(f"Subiendo {len(df)} registros...")
    
    for index, row in df.iterrows():
        db.collection('transporte').add(row.to_dict())
        if index % 10 == 0:
            print(f"Progreso: {index} registros.")
    print("¡Carga exitosa!")

if __name__ == "__main__":
    cargar()