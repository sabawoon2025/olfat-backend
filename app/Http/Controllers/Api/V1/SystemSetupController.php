<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * One-time production setup for hosts that cannot run Artisan during deploy.
 * Protected by the same bearer secret as the scheduler endpoint.
 *
 * POST /api/cron/setup
 * POST /api/cron/setup?fresh=1  → migrate:fresh --seed (wipes the database)
 */
class SystemSetupController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('app.cron_secret');

        if ($secret === '' || ! hash_equals($secret, (string) $request->bearerToken())) {
            abort(401, 'Invalid setup secret.');
        }

        $fresh = $request->boolean('fresh');

        try {
            // Clear a stuck Postgres transaction from a previous failed migrate.
            try {
                DB::statement('ROLLBACK');
            } catch (Throwable) {
                // No open transaction — fine.
            }

            if ($fresh) {
                Artisan::call('migrate:fresh', [
                    '--force' => true,
                    '--seed' => true,
                    '--no-interaction' => true,
                ]);
            } else {
                Artisan::call('migrate', [
                    '--force' => true,
                    '--no-interaction' => true,
                ]);
                $migrateOutput = trim(Artisan::output());

                Artisan::call('db:seed', [
                    '--force' => true,
                    '--no-interaction' => true,
                ]);
            }

            $output = trim(Artisan::output());
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'output' => trim(Artisan::output()),
            ], 500);
        }

        return response()->json([
            'status' => 'ok',
            'mode' => $fresh ? 'fresh' : 'migrate',
            'output' => $fresh ? $output : trim(($migrateOutput ?? '')."\n".$output),
        ]);
    }
}
