<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Report\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Production diagnose endpoint protected by CRON_SECRET.
 * GET /api/cron/diagnose
 */
class SystemDiagnoseController extends Controller
{
    public function __invoke(Request $request, ReportService $reportService): JsonResponse
    {
        $secret = (string) config('app.cron_secret');

        if ($secret === '' || ! hash_equals($secret, (string) $request->bearerToken())) {
            abort(401, 'Invalid diagnose secret.');
        }

        $schema = [
            'sales.currency' => Schema::hasColumn('sales', 'currency'),
            'purchases.currency' => Schema::hasColumn('purchases', 'currency'),
            'customers.balance_usd' => Schema::hasColumn('customers', 'balance_usd'),
            'suppliers.balance_usd' => Schema::hasColumn('suppliers', 'balance_usd'),
            'external_debts.currency' => Schema::hasColumn('external_debts', 'currency'),
        ];

        try {
            $dashboard = $reportService->dashboard(null);

            return response()->json([
                'status' => 'ok',
                'schema' => $schema,
                'dashboard_keys' => array_keys($dashboard),
            ]);
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'status' => 'error',
                'schema' => $schema,
                'type' => $e::class,
                'message' => $e->getMessage(),
                'file' => $e->getFile().':'.$e->getLine(),
            ], 500);
        }
    }
}
