<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app) {
    $db = new Database();

    // Process options
    $app->options('/api/devices', function (Request $request, Response $response) {
        return $response
            ->withHeader('Content-Type', 'application/json');
    });

    // Process GET
    $app->get('/api/devices', function (Request $request, Response $response) use ($db) {
        $devices = $db->getAllDevices();
        $response->getBody()->write(json_encode($devices));
        return $response
            ->withHeader('Content-Type', 'application/json');
    });

    // Process Post (to add new devices)
    $app->post('/api/devices', function (Request $request, Response $response) use ($db) {
        $data = $request->getParsedBody();

        // Data validation
        $errors = [];
        $requiredFields = ['device_id', 'coordinate_x', 'coordinate_y', 'signal_quality'];

        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $errors[] = "You have to fill the $field";
            }
        }

        if (!is_numeric($data['coordinate_x']) || !is_numeric($data['coordinate_y'])) {
            $errors[] = "Wrong coordinates format";
        }

        if (!is_numeric($data['signal_quality']) || $data['signal_quality'] < 0 || $data['signal_quality'] > 10) {
            $errors[] = "Signal quality should be a number from 0 to 10";
        }

        if (!empty($errors)) {
            $response->getBody()->write(json_encode(['errors' => $errors]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        // Add device
        try {
            $deviceId = $db->addDevice(
                $data['device_id'],
                $data['coordinate_x'],
                $data['coordinate_y'],
                (int)$data['signal_quality']
            );

            $response->getBody()->write(json_encode([
                'id' => $deviceId,
                'message' => 'Device has been added successfully'
            ]));

            return $response->withStatus(201)->withHeader('Content-Type', 'application/json');

        } catch (PDOException $e) {
            $response->getBody()->write(json_encode([
                'error' => 'Database error: ' . $e->getMessage()
            ]));
            return $response->withStatus(500)->withHeader('Content-Type', 'application/json');
        }
    });
};