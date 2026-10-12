<?php

/*
|--------------------------------------------------------------------------
| Vercel serverless entry point
|--------------------------------------------------------------------------
|
| Vercel (vercel-php runtime) invokes this file for every non-static request.
| The function filesystem is read-only except /tmp, so Laravel's compiled
| caches are redirected there before the framework boots. Everything else is
| the normal public/index.php front controller.
|
*/

// Neon / Vercel Storage injects DATABASE_URL. Laravel reads DB_URL.
if ((getenv('DB_URL') === false || getenv('DB_URL') === '') && getenv('DATABASE_URL')) {
    $databaseUrl = (string) getenv('DATABASE_URL');
    putenv('DB_URL='.$databaseUrl);
    $_ENV['DB_URL'] = $databaseUrl;
    $_SERVER['DB_URL'] = $databaseUrl;
}

// Neon pooler hosts need an endpoint id when libpq lacks SNI. Do NOT put it in
// the URL ?options= query: Laravel maps that key onto PDO "options" and crashes.
// Neon accepts endpoint=<id>;<password> in the password field instead.
$dbUrl = (string) (getenv('DB_URL') ?: '');
if ($dbUrl !== '' && str_contains($dbUrl, 'neon.tech') && ! str_contains($dbUrl, 'endpoint=')) {
    $parts = parse_url($dbUrl);
    $host = (string) ($parts['host'] ?? '');
    $password = (string) ($parts['pass'] ?? '');
    if ($password !== '' && preg_match('/^(ep-[a-z0-9-]+)/i', $host, $matches) === 1) {
        $parts['pass'] = 'endpoint='.$matches[1].';'.$password;
        $scheme = ($parts['scheme'] ?? 'postgresql').'://';
        $user = isset($parts['user']) ? rawurlencode($parts['user']) : '';
        $pass = ':'.rawurlencode($parts['pass']);
        $auth = ($user !== '' || isset($parts['pass'])) ? $user.$pass.'@' : '';
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = $parts['path'] ?? '';
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';
        $dbUrl = $scheme.$auth.$host.$port.$path.$query;
        putenv('DB_URL='.$dbUrl);
        $_ENV['DB_URL'] = $dbUrl;
        $_SERVER['DB_URL'] = $dbUrl;
    }
}

if ((getenv('DB_CONNECTION') === false || getenv('DB_CONNECTION') === '') && getenv('DB_URL')) {
    putenv('DB_CONNECTION=pgsql');
    $_ENV['DB_CONNECTION'] = 'pgsql';
    $_SERVER['DB_CONNECTION'] = 'pgsql';
}

// On Vercel the rate limiter runs before controllers. CACHE_STORE=database
// 500s every API call until migrate creates the cache table. Array cache is
// the correct serverless default (function memory is ephemeral anyway).
if (getenv('VERCEL') !== false || getenv('VERCEL_ENV') !== false) {
    putenv('CACHE_STORE=array');
    $_ENV['CACHE_STORE'] = 'array';
    $_SERVER['CACHE_STORE'] = 'array';

    if (getenv('SESSION_DRIVER') === false || getenv('SESSION_DRIVER') === '' || getenv('SESSION_DRIVER') === 'database') {
        putenv('SESSION_DRIVER=array');
        $_ENV['SESSION_DRIVER'] = 'array';
        $_SERVER['SESSION_DRIVER'] = 'array';
    }
}

// Laravel only treats cache paths starting with "/" as absolute, so this block is
// Linux-only (which is what Vercel runs). On Windows it is skipped on purpose.
if ((getenv('VERCEL') !== false || getenv('VERCEL_ENV') !== false) && DIRECTORY_SEPARATOR === '/') {
    $tmp = rtrim(sys_get_temp_dir(), '/') ?: '/tmp';

    foreach ([
        'APP_CONFIG_CACHE' => $tmp.'/config.php',
        'APP_EVENTS_CACHE' => $tmp.'/events.php',
        'APP_PACKAGES_CACHE' => $tmp.'/packages.php',
        'APP_ROUTES_CACHE' => $tmp.'/routes-v7.php',
        'APP_SERVICES_CACHE' => $tmp.'/services.php',
        'VIEW_COMPILED_PATH' => $tmp.'/views',
    ] as $key => $value) {
        if (getenv($key) === false) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    if (! is_dir($tmp.'/views')) {
        @mkdir($tmp.'/views', 0777, true);
    }
}

// Lightweight env probe that does not boot Laravel.
$requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
if (str_starts_with($requestUri, '/api/diag')) {
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => true,
        'php' => PHP_VERSION,
        'env' => [
            'APP_KEY' => getenv('APP_KEY') !== false && getenv('APP_KEY') !== '',
            'APP_ENV' => getenv('APP_ENV') ?: null,
            'APP_URL' => getenv('APP_URL') ?: null,
            'DB_CONNECTION' => getenv('DB_CONNECTION') ?: null,
            'DB_URL' => getenv('DB_URL') !== false && getenv('DB_URL') !== '',
            'DATABASE_URL' => getenv('DATABASE_URL') !== false && getenv('DATABASE_URL') !== '',
            'CRON_SECRET' => getenv('CRON_SECRET') !== false && getenv('CRON_SECRET') !== '',
            'CACHE_STORE' => getenv('CACHE_STORE') ?: null,
        ],
    ], JSON_PRETTY_PRINT);
    exit;
}

// The function lives under /api, but the application's own routes also start
// with /api/... . Without this, Symfony would strip "/api" as the base path and
// "/api/v1/..." would 404. Pretend the front controller is public/index.php.
if (str_ends_with((string) ($_SERVER['SCRIPT_NAME'] ?? ''), '/api/index.php')) {
    $_SERVER['SCRIPT_NAME'] = '/index.php';
    $_SERVER['PHP_SELF'] = '/index.php';
    $_SERVER['SCRIPT_FILENAME'] = __DIR__.'/../public/index.php';
}

try {
    require __DIR__.'/../public/index.php';
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'message' => 'Bootstrap failed',
        'type' => $e::class,
        'error' => $e->getMessage(),
    ]);
}
