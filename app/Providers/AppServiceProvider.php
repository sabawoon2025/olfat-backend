<?php

namespace App\Providers;

use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\DamagedStock;
use App\Models\ExternalDebt;
use App\Models\ExternalDebtPayment;
use App\Models\ExternalParty;
use App\Models\HomeExpense;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Purchase;
use App\Models\PurchaseReturn;
use App\Models\Sale;
use App\Models\SalesReturn;
use App\Models\Setting;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerPayment;
use App\Observers\AuditLogObserver;
use App\Observers\ReportCacheObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production') && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));

            return [
                Limit::perMinute(5)->by($request->ip()),
                Limit::perMinute(5)->by($email.'|'.$request->ip()),
            ];
        });

        RateLimiter::for('password-reset', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));

            return [
                Limit::perMinute(5)->by($request->ip()),
                Limit::perMinute(3)->by($email.'|'.$request->ip()),
            ];
        });

        $reportCache = ReportCacheObserver::class;
        foreach ([
            Sale::class,
            Purchase::class,
            Customer::class,
            Supplier::class,
            CustomerPayment::class,
            SupplierPayment::class,
            SalesReturn::class,
            PurchaseReturn::class,
            DamagedStock::class,
            WorkerPayment::class,
            HomeExpense::class,
            ExternalDebt::class,
            ExternalDebtPayment::class,
            StockBalance::class,
        ] as $model) {
            $model::observe($reportCache);
        }

        // Append-only audit trail for master data and every financial / stock document.
        foreach ([
            User::class,
            Location::class,
            Customer::class,
            Supplier::class,
            Worker::class,
            ExternalParty::class,
            Product::class,
            ProductVariant::class,
            Sale::class,
            Purchase::class,
            SalesReturn::class,
            DamagedStock::class,
            StockMovement::class,
            CustomerPayment::class,
            SupplierPayment::class,
            WorkerPayment::class,
            ExternalDebt::class,
            ExternalDebtPayment::class,
            HomeExpense::class,
            Setting::class,
        ] as $model) {
            $model::observe(AuditLogObserver::class);
        }
    }
}
