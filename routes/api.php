<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerPaymentController;
use App\Http\Controllers\Api\V1\DamagedStockController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ExternalDebtController;
use App\Http\Controllers\Api\V1\ExternalPartyController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HomeExpenseController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProductVariantController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\PurchaseReturnController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\SalesReturnController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SupplierPaymentController;
use App\Http\Controllers\Api\V1\SystemCronController;
use App\Http\Controllers\Api\V1\SystemSetupController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WorkerController;
use App\Http\Controllers\Api\V1\WorkerPaymentController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class)->middleware('throttle:60,1')->name('health');
Route::get('/cron/schedule', SystemCronController::class)->middleware('throttle:30,1')->name('cron.schedule');
Route::post('/cron/setup', SystemSetupController::class)->middleware('throttle:5,1')->name('cron.setup');

Route::prefix('v1')->group(function () {
    Route::get('/auth/login-options', [AuthController::class, 'loginOptions'])
        ->middleware('throttle:60,1');
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'active', 'province'])->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        Route::get('/settings', [SettingController::class, 'index']);
        Route::get('/settings/{key}', [SettingController::class, 'show'])->where('key', '.*');

        Route::middleware('admin')->group(function () {
            Route::apiResource('users', UserController::class);
            Route::put('/settings', [SettingController::class, 'bulkUpdate']);
            Route::put('/settings/{key}', [SettingController::class, 'update'])->where('key', '.*');
            Route::post('/stock/adjustments', [StockController::class, 'adjust']);
            Route::get('/audit-logs', [AuditLogController::class, 'index']);
        });

        Route::apiResource('locations', LocationController::class);
        Route::apiResource('customers', CustomerController::class);
        Route::apiResource('suppliers', SupplierController::class);
        Route::apiResource('products', ProductController::class);
        Route::apiResource('product-variants', ProductVariantController::class);
        Route::apiResource('purchases', PurchaseController::class)->only(['index', 'store', 'show']);
        Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);
        Route::apiResource('customer-payments', CustomerPaymentController::class)->only(['index', 'store', 'show']);
        Route::apiResource('supplier-payments', SupplierPaymentController::class)->only(['index', 'store', 'show']);
        Route::apiResource('sales-returns', SalesReturnController::class)->only(['index', 'store', 'show']);
        Route::apiResource('purchase-returns', PurchaseReturnController::class)->only(['index', 'store', 'show']);
        Route::apiResource('damaged-stocks', DamagedStockController::class)->only(['index', 'store', 'show']);

        Route::apiResource('workers', WorkerController::class);
        Route::apiResource('worker-payments', WorkerPaymentController::class)->only(['index', 'store', 'show']);

        Route::apiResource('external-parties', ExternalPartyController::class);
        Route::apiResource('external-debts', ExternalDebtController::class)->only(['index', 'store', 'show']);
        Route::post('external-debts/{external_debt}/payments', [ExternalDebtController::class, 'storePayment']);

        Route::apiResource('home-expenses', HomeExpenseController::class);

        Route::get('/stock/balances', [StockController::class, 'balances']);
        Route::get('/stock/movements', [StockController::class, 'movements']);

        Route::get('/dashboard', [DashboardController::class, 'show']);
        Route::prefix('reports')->group(function () {
            Route::get('/sales', [ReportController::class, 'sales']);
            Route::get('/purchases', [ReportController::class, 'purchases']);
            Route::get('/stock', [ReportController::class, 'stock']);
            Route::get('/stock-movements', [ReportController::class, 'stockMovements']);
            Route::get('/financial', [ReportController::class, 'financial']);
            Route::get('/workers', [ReportController::class, 'workers']);
            Route::get('/damaged-stock', [ReportController::class, 'damagedStock']);
            Route::get('/sales-returns', [ReportController::class, 'salesReturns']);
            Route::get('/home-expenses', [ReportController::class, 'homeExpenses']);
            Route::get('/profit-loss', [ReportController::class, 'profitLoss']);
        });
    });
});
