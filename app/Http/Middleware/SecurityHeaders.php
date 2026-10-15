<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Baseline browser security headers for every response (API and static UI).
 */
class SecurityHeaders
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // Content-Security-Policy differs for the HTML UI vs the JSON API.
        // The staff UI is Bootstrap/vanilla JS served from Laravel's public/ directory.
        // The JSON API should never be rendered in a browsing context, so lock it down hard.
        if ($this->isApiResponse($request, $response)) {
            $response->headers->set(
                'Content-Security-Policy',
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
            );
        } else {
            $response->headers->set(
                'Content-Security-Policy',
                implode('; ', [
                    "default-src 'self'",
                    "img-src 'self' data: https:",
                    // Bootstrap bundle inline fallbacks and small early-boot inline scripts
                    // (RTL swap, token guard). Keeping 'unsafe-inline' here because the UI
                    // currently relies on it; tighten with a nonce in a follow-up.
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                    "font-src 'self' data: https://fonts.gstatic.com",
                    "connect-src 'self'",
                    "frame-ancestors 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                ])
            );
        }

        if ($request->secure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    private function isApiResponse(Request $request, Response $response): bool
    {
        if ($request->is('api/*')) {
            return true;
        }

        $contentType = (string) $response->headers->get('Content-Type', '');

        return str_contains($contentType, 'application/json');
    }
}
