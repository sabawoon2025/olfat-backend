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
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Throwable;

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

        // Vercel cannot run artisan during deploy. Apply pending migrations once
        // when the live DB is behind the multi-currency schema the app expects.
        $this->ensureMultiCurrencySchema();

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

    private function ensureMultiCurrencySchema(): void
    {
        if ($this->app->runningInConsole()) {
            return;
        }

        $onVercel = getenv('VERCEL') !== false
            || getenv('VERCEL_ENV') !== false
            || (isset($_ENV['VERCEL']) && $_ENV['VERCEL'] !== '')
            || (isset($_SERVER['VERCEL']) && $_SERVER['VERCEL'] !== '');

        if (! $onVercel && ! $this->app->environment('production')) {
            return;
        }

        try {
            $this->addCurrencyColumn('sales');
            $this->addCurrencyColumn('purchases');
            $this->addCurrencyColumn('customer_payments');
            $this->addCurrencyColumn('supplier_payments');
            $this->addCurrencyColumn('external_debts');

            if (! Schema::hasColumn('customers', 'balance_usd')) {
                Schema::table('customers', function (Blueprint $table) {
                    $table->decimal('balance_usd', 15, 2)->default(0);
                });
            }

            if (! Schema::hasColumn('suppliers', 'balance_usd')) {
                Schema::table('suppliers', function (Blueprint $table) {
                    $table->decimal('balance_usd', 15, 2)->default(0);
                });
            }
        } catch (Throwable $e) {
            report($e);
        }
    }

    private function addCurrencyColumn(string $table): void
    {
        if (Schema::hasColumn($table, 'currency')) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) {
            $blueprint->string('currency', 3)->default('AFN');
            $blueprint->index('currency');
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            try {
                DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_currency_check CHECK (currency IN ('AFN', 'USD'))");
            } catch (Throwable) {
                // Constraint may already exist from a previous partial run.
            }
        }
    }
}
