import mysql.connector

def get_db_connection():
    conn = mysql.connector.connect(
        host='localhost',  
        user='root',
        password='admi321',
        database='Intellecto',
        port = 3306     #PUERTO CAMBIADO POR MI CREACION EN MI DOCKER
    )
    return conn

if __name__ == "__main__":
    try:
        conn = get_db_connection()
        print("✅ Conexión exitosa a la base de datos!")
        conn.close()
    except mysql.connector.Error as err:
        print(f"❌ Error al conectar: {err}")