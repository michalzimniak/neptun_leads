from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import json
from datetime import datetime
import secrets
import os

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

DATABASE = 'leads.db'

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username):
        self.id = id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    with get_db() as conn:
        cursor = conn.execute('SELECT id, username FROM users WHERE id = ?', (user_id,))
        user_row = cursor.fetchone()
        if user_row:
            return User(user_row['id'], user_row['username'])
    return None

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # Users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                type TEXT DEFAULT 'city',
                geojson TEXT,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS lead_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                leads_count INTEGER DEFAULT 0,
                rejections_count INTEGER DEFAULT 0,
                no_prospects INTEGER DEFAULT 0,
                user_id INTEGER,
                FOREIGN KEY (location_id) REFERENCES locations(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(location_id, date)
            )
        ''')
        
        # Reservations table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                area_name TEXT NOT NULL,
                area_lat REAL NOT NULL,
                area_lng REAL NOT NULL,
                user_id INTEGER NOT NULL,
                reservation_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(area_name, reservation_date)
            )
        ''')
        
        # Add user_id columns if they don't exist (migration)
        try:
            conn.execute('ALTER TABLE locations ADD COLUMN user_id INTEGER')
        except sqlite3.OperationalError:
            pass
        
        try:
            conn.execute('ALTER TABLE lead_data ADD COLUMN user_id INTEGER')
        except sqlite3.OperationalError:
            pass
        
        # Add no_prospects column if it doesn't exist (migration)
        try:
            conn.execute('ALTER TABLE lead_data ADD COLUMN no_prospects INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass
        
        conn.commit()

@app.route('/')
def index():
    return render_template('index.html')

# PWA routes
@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def service_worker():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')

# ============== AUTH ENDPOINTS ==============

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    password_hash = generate_password_hash(password)
    
    try:
        with get_db() as conn:
            cursor = conn.execute(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                (username, password_hash)
            )
            conn.commit()
            user_id = cursor.lastrowid
        
        user = User(user_id, username)
        login_user(user)
        
        return jsonify({'message': 'Registration successful', 'user': {'id': user_id, 'username': username}}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    with get_db() as conn:
        cursor = conn.execute('SELECT id, username, password_hash FROM users WHERE username = ?', (username,))
        user_row = cursor.fetchone()
    
    if user_row and check_password_hash(user_row['password_hash'], password):
        user = User(user_row['id'], user_row['username'])
        login_user(user)
        return jsonify({'message': 'Login successful', 'user': {'id': user.id, 'username': user.username}}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/auth/current', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({'user': {'id': current_user.id, 'username': current_user.username}}), 200
    else:
        return jsonify({'user': None}), 200

# ============== LOCATIONS ENDPOINTS ==============

@app.route('/api/locations', methods=['GET'])
def get_locations():
    with get_db() as conn:
        cursor = conn.execute('SELECT l.*, u.username FROM locations l LEFT JOIN users u ON l.user_id = u.id')
        locations = []
        for row in cursor.fetchall():
            location = dict(row)
            if location.get('geojson'):
                location['geojson'] = json.loads(location['geojson'])
            locations.append(location)
    return jsonify(locations)

@app.route('/api/locations', methods=['POST'])
@login_required
def add_location():
    data = request.json
    geojson_str = json.dumps(data.get('geojson')) if data.get('geojson') else None
    with get_db() as conn:
        cursor = conn.execute(
            'INSERT INTO locations (name, lat, lng, type, geojson, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            (data['name'], data['lat'], data['lng'], data.get('type', 'city'), geojson_str, current_user.id)
        )
        conn.commit()
        location_id = cursor.lastrowid
    return jsonify({'id': location_id, 'message': 'Location added successfully'}), 201

@app.route('/api/locations/<int:location_id>', methods=['DELETE'])
@login_required
def delete_location(location_id):
    with get_db() as conn:
        conn.execute('DELETE FROM lead_data WHERE location_id = ?', (location_id,))
        conn.execute('DELETE FROM locations WHERE id = ?', (location_id,))
        conn.commit()
    return jsonify({'message': 'Location deleted successfully'})

@app.route('/api/lead-data', methods=['GET'])
def get_lead_data():
    location_id = request.args.get('location_id')
    with get_db() as conn:
        if location_id:
            cursor = conn.execute(
                'SELECT ld.*, u.username FROM lead_data ld LEFT JOIN users u ON ld.user_id = u.id WHERE location_id = ? ORDER BY date DESC',
                (location_id,)
            )
        else:
            cursor = conn.execute('SELECT ld.*, u.username FROM lead_data ld LEFT JOIN users u ON ld.user_id = u.id ORDER BY date DESC')
        lead_data = [dict(row) for row in cursor.fetchall()]
    return jsonify(lead_data)

@app.route('/api/lead-data', methods=['POST'])
@login_required
def add_lead_data():
    data = request.json
    with get_db() as conn:
        try:
            conn.execute(
                'INSERT INTO lead_data (location_id, date, leads_count, rejections_count, no_prospects, user_id) VALUES (?, ?, ?, ?, ?, ?)',
                (data['location_id'], data['date'], data['leads_count'], data['rejections_count'], data.get('no_prospects', 0), current_user.id)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Update if already exists
            conn.execute(
                'UPDATE lead_data SET leads_count = ?, rejections_count = ?, no_prospects = ?, user_id = ? WHERE location_id = ? AND date = ?',
                (data['leads_count'], data['rejections_count'], data.get('no_prospects', 0), current_user.id, data['location_id'], data['date'])
            )
            conn.commit()
    return jsonify({'message': 'Lead data saved successfully'}), 201

@app.route('/api/lead-data/<int:data_id>', methods=['DELETE'])
@login_required
def delete_lead_data(data_id):
    with get_db() as conn:
        conn.execute('DELETE FROM lead_data WHERE id = ?', (data_id,))
        conn.commit()
    return jsonify({'message': 'Lead data deleted successfully'})

# ============== RESERVATIONS ENDPOINTS ==============

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    # Get reservations for a specific date (optional)
    date = request.args.get('date')
    with get_db() as conn:
        if date:
            cursor = conn.execute(
                'SELECT r.*, u.username FROM reservations r LEFT JOIN users u ON r.user_id = u.id WHERE reservation_date = ?',
                (date,)
            )
        else:
            cursor = conn.execute('SELECT r.*, u.username FROM reservations r LEFT JOIN users u ON r.user_id = u.id ORDER BY reservation_date DESC')
        reservations = [dict(row) for row in cursor.fetchall()]
    return jsonify(reservations)

@app.route('/api/reservations', methods=['POST'])
@login_required
def add_reservation():
    data = request.json
    try:
        with get_db() as conn:
            cursor = conn.execute(
                'INSERT INTO reservations (area_name, area_lat, area_lng, user_id, reservation_date) VALUES (?, ?, ?, ?, ?)',
                (data['area_name'], data['area_lat'], data['area_lng'], current_user.id, data['reservation_date'])
            )
            conn.commit()
            reservation_id = cursor.lastrowid
        return jsonify({'id': reservation_id, 'message': 'Reservation created successfully'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Area already reserved for this date'}), 409

@app.route('/api/reservations/<int:reservation_id>', methods=['DELETE'])
@login_required
def delete_reservation(reservation_id):
    with get_db() as conn:
        conn.execute('DELETE FROM reservations WHERE id = ?', (reservation_id,))
        conn.commit()
    return jsonify({'message': 'Reservation deleted successfully'})

# ============== USERS ENDPOINTS ==============

@app.route('/api/users', methods=['GET'])
def get_users():
    with get_db() as conn:
        cursor = conn.execute('SELECT id, username, created_at FROM users')
        users = [dict(row) for row in cursor.fetchall()]
    return jsonify(users)

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    # Prevent deleting yourself
    if current_user.id == user_id:
        return jsonify({'error': 'Nie możesz usunąć swojego konta'}), 403
    
    with get_db() as conn:
        # Delete all user's data in correct order (due to foreign keys)
        conn.execute('DELETE FROM lead_data WHERE location_id IN (SELECT id FROM locations WHERE user_id = ?)', (user_id,))
        conn.execute('DELETE FROM reservations WHERE user_id = ?', (user_id,))
        conn.execute('DELETE FROM locations WHERE user_id = ?', (user_id,))
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
    
    return jsonify({'message': 'User and all data deleted successfully'})

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
