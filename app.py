from flask import Flask, render_template, request, redirect, session, jsonify, url_for, send_from_directory
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import time

app = Flask(__name__)
app.secret_key = "mi_secreto_seguro"

# NUEVO: Configuración para imágenes
UPLOAD_FOLDER = 'static/uploads/preguntas'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB máximo

# Crear carpeta si no existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configuración MySQL
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "admi321",
    "database": "Intellecto",
    "port": "3308"
}

# NUEVO: Función para validar archivos
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Función para conexión
def get_db_connection():
    return mysql.connector.connect(**db_config)

# ---- Rutas de Vistas y Autenticación ----
@app.route('/')
def index():
    if session.get('logged_in'):
        return redirect(url_for('docente_panel'))
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username'].strip()
    password = request.form['password']
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM user WHERE nombre_usuario=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['logged_in'] = True
        session['username'] = username
        return redirect(url_for('docente_panel'))
    
    return render_template('login.html', error="Usuario o contraseña incorrectos.")

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['regName'].strip()
        password = request.form['regPass']

        if len(username) < 3 or len(password) < 4:
            return render_template('register.html', regError="El usuario y la contraseña deben tener al menos 3 y 4 caracteres respectivamente.")

        hashed_pass = generate_password_hash(password)
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO user (nombre_usuario, password_hash) VALUES (%s, %s)", (username, hashed_pass))
            conn.commit()
        except mysql.connector.IntegrityError:
            return render_template('register.html', regError="Ese nombre de usuario ya existe.")
        finally:
            cursor.close()
            conn.close()

        session['logged_in'] = True
        session['username'] = username
        return redirect(url_for('docente_panel'))
    
    if request.method == 'GET':
        if session.get('logged_in'):
            return redirect(url_for('docente_panel'))
        return render_template('register.html')

@app.route('/docente')
def docente_panel():
    if not session.get('logged_in'):
        return redirect(url_for('index'))
    return render_template('Docente.html', username=session.get('username'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/juego')
def juego_page():
    return render_template('Juego.html')

# NUEVO: Ruta para servir imágenes
@app.route('/uploads/preguntas/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ======================================================================
# ======================== API RESTful =================================
# ======================================================================

### API para Configuración ###
@app.route('/api/configuracion', methods=['GET', 'PUT'])
def manage_configuracion():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT cantidad FROM rondas WHERE id_rondas = 1")
        config = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify(config if config else {"cantidad": 3})

    if request.method == 'PUT':
        data = request.get_json()
        cantidad = data.get('cantidad')
        if cantidad is None or not isinstance(cantidad, int) or cantidad < 1:
            return jsonify({"error": "La cantidad debe ser un número entero positivo"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        query = "INSERT INTO rondas (id_rondas, cantidad) VALUES (1, %s) ON DUPLICATE KEY UPDATE cantidad = %s"
        try:
            cursor.execute(query, (cantidad, cantidad))
            conn.commit()
        except mysql.connector.Error as err:
            return jsonify({"error": f"Error en la base de datos: {err}"}), 500
        finally:
            cursor.close()
            conn.close()
        return jsonify({"success": True, "cantidad": cantidad})

### API para Materias ###
@app.route('/api/materias', methods=['GET', 'POST'])
def manage_materias():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_materia, materia_nombre FROM materias ORDER BY materia_nombre")
        materias = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(materias)

    if request.method == 'POST':
        if not session.get('logged_in'):
            return jsonify({"error": "No autorizado"}), 401
        
        data = request.get_json()
        nombre_materia = data.get('materia_nombre')
        if not nombre_materia:
            return jsonify({"error": "Nombre de materia requerido"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO materias (materia_nombre) VALUES (%s)", (nombre_materia,))
            conn.commit()
            new_id = cursor.lastrowid
        except mysql.connector.IntegrityError:
            return jsonify({"error": "La materia ya existe"}), 409
        finally:
            cursor.close()
            conn.close()
        return jsonify({"id_materia": new_id, "materia_nombre": nombre_materia}), 201

@app.route('/api/materias/<int:materia_id>', methods=['PUT', 'DELETE'])
def manage_materia_item(materia_id):
    if request.method == 'PUT':
        data = request.get_json()
        nombre = data.get('materia_nombre')
        if not nombre:
            return jsonify({"error": "El nombre es requerido"}), 400
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE materias SET materia_nombre = %s WHERE id_materia = %s", (nombre, materia_id))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Materia no encontrada"}), 404
        except mysql.connector.IntegrityError:
            return jsonify({"error": "Ese nombre de materia ya existe"}), 409
        finally:
            cursor.close()
            conn.close()
        return jsonify({"id_materia": materia_id, "materia_nombre": nombre})

    if request.method == 'DELETE':
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            conn.start_transaction()
            cursor.execute("DELETE FROM respuestas WHERE id_pregunta IN (SELECT id_pregunta FROM preguntas WHERE id_materia = %s)", (materia_id,))
            cursor.execute("DELETE FROM preguntas WHERE id_materia = %s", (materia_id,))
            cursor.execute("DELETE FROM materias WHERE id_materia = %s", (materia_id,))
            conn.commit()
        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": f"Error en la base de datos: {err}"}), 500
        finally:
            cursor.close()
            conn.close()
        return jsonify({"success": True})

### API para Preguntas (ACTUALIZADA CON SOPORTE DE IMÁGENES) ###
@app.route('/api/preguntas', methods=['GET', 'POST'])
def manage_preguntas():
    if request.method == 'GET':
        filtro_materia_id = request.args.get('materia_id')
        filtro_texto = request.args.get('texto')
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT p.id_pregunta, p.pregunta, p.imagen_url, m.id_materia, m.materia_nombre FROM preguntas p JOIN materias m ON p.id_materia = m.id_materia WHERE p.estado = 1"
        params = []
        if filtro_materia_id:
            query += " AND p.id_materia = %s"
            params.append(filtro_materia_id)
        if filtro_texto:
            query += " AND (p.pregunta LIKE %s OR p.id_pregunta IN (SELECT id_pregunta FROM respuestas WHERE respuesta LIKE %s))"
            params.append(f"%{filtro_texto}%")
            params.append(f"%{filtro_texto}%")
        cursor.execute(query, tuple(params))
        preguntas = cursor.fetchall()
        for pregunta in preguntas:
            cursor.execute("SELECT id_respuesta, respuesta, es_correcta FROM respuestas WHERE id_pregunta = %s", (pregunta['id_pregunta'],))
            pregunta['respuestas'] = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(preguntas)

    if request.method == 'POST':
        # Obtener datos del formulario
        id_materia = request.form.get('id_materia')
        pregunta_texto = request.form.get('pregunta')
        respuestas_json = request.form.get('respuestas')
        
        if not all([id_materia, pregunta_texto, respuestas_json]):
            return jsonify({"error": "Faltan datos requeridos"}), 400
        
        try:
            respuestas = eval(respuestas_json)  # O usar json.loads()
        except:
            return jsonify({"error": "Formato de respuestas inválido"}), 400
        
        if len(respuestas) < 2:
            return jsonify({"error": "Se requieren al menos 2 respuestas"}), 400
        
        # Procesar imagen si existe
        imagen_url = None
        if 'imagen' in request.files:
            file = request.files['imagen']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                timestamp = str(int(time.time()))
                filename = f"{timestamp}_{filename}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                imagen_url = url_for('uploaded_file', filename=filename)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            conn.start_transaction()
            cursor.execute("INSERT INTO preguntas (id_materia, pregunta, imagen_url) VALUES (%s, %s, %s)", 
                          (id_materia, pregunta_texto, imagen_url))
            id_pregunta_nueva = cursor.lastrowid
            for resp in respuestas:
                cursor.execute("INSERT INTO respuestas (id_pregunta, respuesta, es_correcta) VALUES (%s, %s, %s)", 
                              (id_pregunta_nueva, resp['texto'], resp['es_correcta']))
            conn.commit()
        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": f"Error en la base de datos: {err}"}), 500
        finally:
            cursor.close()
            conn.close()
        return jsonify({"success": True, "id_pregunta": id_pregunta_nueva}), 201

@app.route('/api/preguntas/<int:pregunta_id>', methods=['PUT', 'DELETE'])
def manage_pregunta_item(pregunta_id):
    if request.method == 'PUT':
        # Determinar si es JSON o FormData
        is_json = request.is_json
        
        if is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            if 'respuestas' in data:
                try:
                    data['respuestas'] = eval(data['respuestas'])
                except:
                    return jsonify({"error": "Formato de respuestas inválido"}), 400
        
        if not data:
            return jsonify({"error": "No se enviaron datos"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            conn.start_transaction()
            
            # Actualizar pregunta y/o imagen
            if 'id_materia' in data and 'pregunta' in data:
                id_materia = data.get('id_materia')
                pregunta_texto = data.get('pregunta')
                if not id_materia or not pregunta_texto:
                    conn.rollback()
                    return jsonify({"error": "Faltan datos de la pregunta"}), 400
                
                # Procesar nueva imagen si existe
                imagen_url = None
                if not is_json and 'imagen' in request.files:
                    file = request.files['imagen']
                    if file and file.filename != '' and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        timestamp = str(int(time.time()))
                        filename = f"{timestamp}_{filename}"
                        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                        file.save(filepath)
                        imagen_url = url_for('uploaded_file', filename=filename)
                        
                        cursor.execute("UPDATE preguntas SET id_materia = %s, pregunta = %s, imagen_url = %s WHERE id_pregunta = %s", 
                                     (id_materia, pregunta_texto, imagen_url, pregunta_id))
                    else:
                        cursor.execute("UPDATE preguntas SET id_materia = %s, pregunta = %s WHERE id_pregunta = %s", 
                                     (id_materia, pregunta_texto, pregunta_id))
                else:
                    cursor.execute("UPDATE preguntas SET id_materia = %s, pregunta = %s WHERE id_pregunta = %s", 
                                 (id_materia, pregunta_texto, pregunta_id))
                
                if cursor.rowcount == 0:
                    conn.rollback()
                    return jsonify({"error": "Pregunta no encontrada"}), 404

            # Actualizar respuestas
            if 'respuestas' in data:
                respuestas = data.get('respuestas')
                if not isinstance(respuestas, list) or len(respuestas) < 2:
                    conn.rollback()
                    return jsonify({"error": "Se requieren al menos 2 respuestas"}), 400
                
                cursor.execute("DELETE FROM respuestas WHERE id_pregunta = %s", (pregunta_id,))
                for resp in respuestas:
                    cursor.execute("INSERT INTO respuestas (id_pregunta, respuesta, es_correcta) VALUES (%s, %s, %s)", 
                                  (pregunta_id, resp['texto'], resp['es_correcta']))

            conn.commit()
        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": f"Error en la base de datos: {err}"}), 500
        finally:
            cursor.close()
            conn.close()
            
        return jsonify({"success": True, "id_pregunta": pregunta_id})

    if request.method == 'DELETE':
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            conn.start_transaction()
            cursor.execute("DELETE FROM respuestas WHERE id_pregunta = %s", (pregunta_id,))
            cursor.execute("DELETE FROM preguntas WHERE id_pregunta = %s", (pregunta_id,))
            if cursor.rowcount == 0:
                conn.rollback()
                return jsonify({"error": "Pregunta no encontrada"}), 404
            conn.commit()
        except mysql.connector.Error as err:
            conn.rollback()
            return jsonify({"error": f"Error en la base de datos: {err}"}), 500
        finally:
            cursor.close()
            conn.close()
        return jsonify({"success": True})

### API para Equipos ###
@app.route('/api/equipos', methods=['GET', 'POST'])
def manage_equipos():
    if request.method == 'GET':
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_equipo, nombre_equipo FROM equipos ORDER BY nombre_equipo")
        equipos = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(equipos)

    if request.method == 'POST':
        data = request.get_json()
        nombre = data.get('nombre')
        if not nombre:
            return jsonify({"error": "El nombre del equipo es requerido"}), 400
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO equipos (nombre_equipo) VALUES (%s)", (nombre,))
            conn.commit()
            new_id = cursor.lastrowid
        except mysql.connector.IntegrityError:
            return jsonify({"error": "Ese nombre de equipo ya existe"}), 409
        finally:
            cursor.close()
            conn.close()
        return jsonify({"id_equipo": new_id, "nombre_equipo": nombre}), 201

@app.route('/api/equipos/<int:equipo_id>', methods=['PUT', 'DELETE'])
def manage_equipo_item(equipo_id):
    if request.method == 'PUT':
        data = request.get_json()
        nombre = data.get('nombre')
        if not nombre:
            return jsonify({"error": "El nombre del equipo es requerido"}), 400
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE equipos SET nombre_equipo = %s WHERE id_equipo = %s", (nombre, equipo_id))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({"error": "Equipo no encontrado"}), 404
        except mysql.connector.IntegrityError:
            return jsonify({"error": "Ese nombre de equipo ya existe"}), 409
        finally:
            cursor.close()
            conn.close()
        return jsonify({"id_equipo": equipo_id, "nombre_equipo": nombre})

    if request.method == 'DELETE':
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM equipos WHERE id_equipo = %s", (equipo_id,))
        conn.commit()
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return jsonify({"error": "Equipo no encontrado"}), 404
        cursor.close()
        conn.close()
        return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True)