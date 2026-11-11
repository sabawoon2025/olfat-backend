<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Availability probe for uptime monitors and the hosting platform.
 *
 * Returns 200 when the database and cache are reachable, 503 otherwise.
 * Intentionally exposes no configuration or data.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->check(function (): void {
                DB::connection()->getPdo();
                DB::select('select 1');
            }),
            'cache' => $this->check(function (): void {
                $key = 'health:'.Str::random(8);
                Cache::put($key, 1, 10);

                if (Cache::get($key) !== 1) {
                    throw new \RuntimeException('Cache round-trip failed.');
                }

                Cache::forget($key);
            }),
        ];

        $schema = $this->check(function (): void {
            foreach ([
                ['sales', 'currency'],
                ['purchases', 'currency'],
                ['customers', 'balance_usd'],
                ['suppliers', 'balance_usd'],
                ['external_debts', 'currency'],
            ] as [$table, $column]) {
                if (! Schema::hasColumn($table, $column)) {
                    throw new \RuntimeException("Missing {$table}.{$column}");
                }
            }
        });

        $healthy = ! in_array(false, array_column($checks, 'ok'), true);

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => $checks + ['multi_currency_schema' => $schema],
            'timestamp' => now()->toIso8601String(),
        ], $healthy ? 200 : 503);
    }

    /**
     * @param  callable(): void  $probe
     * @return array{ok: bool, error?: string}
     */
    private function check(callable $probe): array
    {
        try {
            $probe();

            return ['ok' => true];
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => class_basename($e)];
        }
    }
}
