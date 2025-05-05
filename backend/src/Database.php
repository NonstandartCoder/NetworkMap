<?php
class Database {
    private $conn;

    public function __construct() {
        $dbPath = __DIR__ . '..\\..\\data\\devices.db';
        $this->conn = new PDO("sqlite:$dbPath");
        $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        // Создаём таблицу
        $this->conn->exec('
            CREATE TABLE IF NOT EXISTS device_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                coordinate_x REAL NOT NULL,
                coordinate_y REAL NOT NULL,
                signal_quality INTEGER NOT NULL
            )
        ');
        // Создаём индекс
        $this->conn->exec('CREATE INDEX IF NOT EXISTS idx_device_id ON device_data (device_id)');
    }

    public function getAllDevices() {
        $stmt = $this->conn->query('
            SELECT id, device_id, coordinate_x, coordinate_y, signal_quality
            FROM device_data
        ');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addDevice($device_id, $x, $y, $signal) {
        $stmt = $this->conn->prepare('
            INSERT INTO device_data (device_id, coordinate_x, coordinate_y, signal_quality)
            VALUES (:device_id, :x, :y, :signal)
        ');
        $stmt->execute([
            ':device_id' => $device_id,
            ':x' => $x,
            ':y' => $y,
            ':signal' => $signal
        ]);
        return $this->conn->lastInsertId();
    }
}