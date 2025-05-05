<?php
class Database {
    private $conn;
    public function __construct() {
        $dbPath = __DIR__ . '..\\..\\data\\devices.db';
        $this->conn = new PDO("sqlite:$dbPath");
        $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
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