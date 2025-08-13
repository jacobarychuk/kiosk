from flask import Flask, render_template, request, jsonify, abort
import os, sqlite3

latest_sample = {}

app = Flask(__name__)

API_KEY = os.getenv("API_KEY")

BC_HYDRO_RATE = 0.1398

# Web interface
@app.route("/")
def index():
    return render_template("index.html")

# ESP32 sends data here
@app.route("/data", methods=["POST"])
def receive_data():
    global latest_sample
    if request.headers.get("API-Key") != API_KEY:
        abort(401) # Unauthorized

    content = request.get_json()
    print("Received:", content)
    latest_sample = content

    # Extract expected fields
    expected_fields = ["timestamp", "glycol", "preheat", "ambient", "source", "hot", "flow", "solar_pv_array_power", "preheat_tank_power", "hybrid_hot_water_tank_power"]
    if not all(key in content for key in expected_fields):
        return 400

    # Insert into database
    with sqlite3.connect("sensor_data.db", isolation_level=None) as con:
        cur = con.cursor() # Used to execute SQL statements and fetch results from SQL queries
        cur.execute("""
            INSERT INTO samples (timestamp, glycol, preheat, ambient, source, hot, flow, solar_pv_array_power, preheat_tank_power, hybrid_hot_water_tank_power)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            content["timestamp"],
            content["glycol"],
            content["preheat"],
            content["ambient"],
            content["source"],
            content["hot"],
            content["flow"],
            content["solar_pv_array_power"],
            content["preheat_tank_power"],
            content["hybrid_hot_water_tank_power"]
        ))

    return "OK"

@app.route("/latest")
def latest():
    global latest_sample
    if latest_sample:
        return jsonify(latest_sample)
    else:
        abort(404)

@app.route("/temperature-range")
def temperature_range():
    start = int(request.args.get("start"))
    end = int(request.args.get("end"))

    data = {
        "glycol": [],
        "preheat": [],
        "ambient": [],
        "source": [],
        "hot": []
    }

    with sqlite3.connect("sensor_data.db", isolation_level=None) as con:
        cur = con.cursor()
        cur.execute("""
            SELECT * FROM samples
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        """, (start, end))

    for row in cur.fetchall():
        timestamp_ms = row[0] * 1000 # Convert to milliseconds for compatability with Highcharts
        data["glycol"].append([timestamp_ms, row[1]])
        data["preheat"].append([timestamp_ms, row[2]])
        data["ambient"].append([timestamp_ms, row[3]])
        data["source"].append([timestamp_ms, row[4]])
        data["hot"].append([timestamp_ms, row[5]])

    return jsonify(data)

@app.route("/flow-range")
def flow_range():
    start = int(request.args.get("start"))
    end = int(request.args.get("end"))

    data = {
        "flow": []
    }

    with sqlite3.connect("sensor_data.db", isolation_level=None) as con:
        cur = con.cursor()
        cur.execute("""
            SELECT * FROM samples
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        """, (start, end))

    for row in cur.fetchall():
        timestamp_ms = row[0] * 1000 # Convert to milliseconds for compatability with Highcharts
        data["flow"].append([timestamp_ms, row[6]])

    return jsonify(data)

@app.route("/power-range")
def power_range():
    start = int(request.args.get("start"))
    end = int(request.args.get("end"))

    data = {
        "solar_pv_array_power": [],
        "preheat_tank_power": [],
        "hybrid_hot_water_tank_power": []
    }

    with sqlite3.connect("sensor_data.db", isolation_level=None) as con:
        cur = con.cursor()
        cur.execute("""
            SELECT * FROM samples
            WHERE timestamp BETWEEN ? AND ?
            ORDER BY timestamp
        """, (start, end))

    for row in cur.fetchall():
        timestamp_ms = row[0] * 1000 # Convert to milliseconds for compatability with Highcharts
        data["solar_pv_array_power"].append([timestamp_ms, row[7]])
        data["preheat_tank_power"].append([timestamp_ms, row[8]])
        data["hybrid_hot_water_tank_power"].append([timestamp_ms, row[9]])

    return jsonify(data)

@app.route("/savings")
def savings():
    with sqlite3.connect("sensor_data.db", isolation_level=None) as con:
        cur = con.cursor()
        cur.execute("SELECT MIN(timestamp) FROM samples")
        earliest_timestamp = cur.fetchone()[0]
        total_savings = 999.99

    return jsonify({
        "total_savings": total_savings,
        "earliest_timestamp": earliest_timestamp
    })

