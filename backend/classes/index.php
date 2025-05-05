<?php
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../src/Database.php';

// Create Slim app
$app = AppFactory::create();

// Add body parsing middleware to handle JSON
$app->addBodyParsingMiddleware();

// Middleware for CORS
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->withHeader('Content-Type', 'application/json');
});

// Connect routes
(require __DIR__ . '/../src/routes.php')($app);

// Run the app
$app->run();