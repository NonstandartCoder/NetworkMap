<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app) {
    $db = new Database();

    // Handle CORS preflight requests for /api/devices endpoint
    $app->options('/api/devices', function (Request $request, Response $response) {
        return $response->withHeader('Content-Type', 'application/json');
    });

    // GET all devices endpoint
    $app->get('/api/devices', function (Request $request, Response $response) use ($db) {
        try {
            // Retrieve all devices from database
            $devices = $db->getAllDevices();
            $response->getBody()->write(json_encode($devices));
            return $response->withHeader('Content-Type', 'application/json');
        } catch (Exception $e) {
            // Handle database errors
            $response->getBody()->write(json_encode(['error' => 'Failed to fetch devices']));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    });

    // POST new device endpoint
    $app->post('/api/devices', function (Request $request, Response $response) use ($db) {
        // Set JSON content type for response
        $response = $response->withHeader('Content-Type', 'application/json');

        // Parse and validate request data
        $data = $request->getParsedBody();
        $errors = [];
        $requiredFields = ['device_id', 'coordinate_x', 'coordinate_y', 'signal_quality'];

        // Validate required fields existence
        if (!is_array($data)) {
            $errors[] = 'Invalid or missing request body';
        } else {
            foreach ($requiredFields as $field) {
                if (!array_key_exists($field, $data) || trim($data[$field]) === '') {
                    $errors[] = "Missing or empty $field";
                }
            }

            // Validate field formats if no errors
            if (empty($errors)) {
                if (!is_numeric($data['coordinate_x'])) {
                    $errors[] = "Coordinate_x must be a number";
                }
                if (!is_numeric($data['coordinate_y'])) {
                    $errors[] = "Coordinate_y must be a number";
                }
                if (!is_numeric($data['signal_quality']) || $data['signal_quality'] < 0 || $data['signal_quality'] > 10) {
                    $errors[] = "Signal quality must be a number between 0 and 10";
                }
            }
        }

        // Return validation errors if any
        if (!empty($errors)) {
            $response->getBody()->write(json_encode(['errors' => $errors]));
            return $response->withStatus(400);
        }

        // Attempt to create new device
        try {
            // Insert device into database
            $deviceId = $db->addDevice(
                $data['device_id'],
                (float)$data['coordinate_x'],
                (float)$data['coordinate_y'],
                (int)$data['signal_quality']
            );

            // Return newly created device with 201 status
            $newDevice = $db->getDeviceById($deviceId);
            $response->getBody()->write(json_encode($newDevice));
            return $response->withStatus(201);
        } catch (PDOException $e) {
            // Handle database exceptions
            $response->getBody()->write(json_encode([
                'error' => 'Database error: ' . $e->getMessage()
            ]));
            return $response->withStatus(500);
        }
    });
};