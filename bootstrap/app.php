<?php

use App\Http\Middleware\EnforceProvinceScope;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\ForceHttps;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Token auth only. The staff UI sends Authorization: Bearer and does not use CSRF cookies.
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'admin' => EnsureUserIsAdmin::class,
            'province' => EnforceProvinceScope::class,
        ]);

        // Behind a TLS-terminating proxy / CDN (Vercel, Cloudflare, Nginx) the app only
        // sees X-Forwarded-* headers; trusting them keeps $request->secure() and
        // ForceHttps correct and prevents redirect loops.
        $middleware->trustProxies(at: '*');

        $middleware->append(ForceHttps::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->throttleApi('api');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // When the caller presents CRON_SECRET, return the real exception
        // so production bootstrap failures can be diagnosed without APP_DEBUG.
        $exceptions->render(function (Throwable $e, Request $request) {
            $secret = (string) config('app.cron_secret');
            $token = (string) $request->bearerToken();

            if ($secret === '' || $token === '' || ! hash_equals($secret, $token)) {
                return null;
            }

            return response()->json([
                'message' => $e->getMessage(),
                'type' => $e::class,
            ], 500);
        });
    })->create();
