<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app) {
    $db = new Database();

    // OPTIONS /api/devices
    $app->options('/api/devices', function (Request $request, Response $response) {
        return $response->withHeader('Content-Type', 'application/json');
    });

    // GET /api/devices
    $app->get('/api/devices', function (Request $request, Response $response) use ($db) {
        try {
            $devices = $db->getAllDevices();
            $response->getBody()->write(json_encode($devices));
            return $response->withHeader('Content-Type', 'application/json');
        } catch (Exception $e) {
            $response->getBody()->write(json_encode(['error' => 'Failed to fetch devices']));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    });

    // POST /api/devices
    $app->post('/api/devices', function (Request $request, Response $response) use ($db) {
        // Set JSON content type
        $response = $response->withHeader('Content-Type', 'application/json');

        // Parse request body
        $data = $request->getParsedBody();

        // Validate request body
        $errors = [];
        $requiredFields = ['device_id', 'coordinate_x', 'coordinate_y', 'signal_quality'];

        if (!is_array($data)) {
            $errors[] = 'Invalid or missing request body';
        } else {
            foreach ($requiredFields as $field) {
                if (!array_key_exists($field, $data) || trim($data[$field]) === '') {
                    $errors[] = "Missing or empty $field";
                }
            }

            if (!isset($errors) || count($errors) === 0) {
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

        if (!empty($errors)) {
            $response->getBody()->write(json_encode(['errors' => $errors]));
            return $response->withStatus(400);
        }

        // Add device
        try {
            $deviceId = $db->addDevice(
                $data['device_id'],
                (float)$data['coordinate_x'],
                (float)$data['coordinate_y'],
                (int)$data['signal_quality']
            );

            $response->getBody()->write(json_encode([
                'id' => $deviceId,
                'message' => 'Device added successfully'
            ]));
            return $response->withStatus(201);
        } catch (PDOException $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Database error: ' . $e->getMessage()
            ]));
            return $response->withStatus(500);
        }
    });
};
