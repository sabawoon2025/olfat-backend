<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Throwable;

/**
 * One-time production setup for hosts that cannot run Artisan during deploy.
 * Protected by the same bearer secret as the scheduler endpoint.
 */
class SystemSetupController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('app.cron_secret');

        if ($secret === '' || ! hash_equals($secret, (string) $request->bearerToken())) {
            abort(401, 'Invalid setup secret.');
        }

        try {
            Artisan::call('migrate', [
                '--force' => true,
                '--no-interaction' => true,
            ]);
            $migrateOutput = trim(Artisan::output());

            Artisan::call('db:seed', [
                '--force' => true,
                '--no-interaction' => true,
            ]);
            $seedOutput = trim(Artisan::output());
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'status' => 'ok',
            'migrate' => $migrateOutput,
            'seed' => $seedOutput,
        ]);
    }
}
