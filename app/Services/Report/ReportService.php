<?php

namespace App\Services\Report;

use App\Models\Customer;
use App\Models\DamagedStock;
use App\Models\ExternalDebt;
use App\Models\HomeExpense;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalesReturn;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\WorkerPayment;
use App\Services\Settings\SettingsService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ReportService
{
    public function __construct(private readonly SettingsService $settingsService) {}

    public function dashboard(?int $locationId = null): array
    {
        $cacheKey = 'mbms.dashboard.'.$this->reportCacheVersion().'.'.($locationId ?? 'all');

        return Cache::remember($cacheKey, 45, function () use ($locationId) {
            return $this->buildDashboard($locationId);
        });
    }

    private function buildDashboard(?int $locationId = null): array
    {
        $todayStart = now()->startOfDay();
        $todayEnd = now()->endOfDay();
        $lowStockThreshold = (float) $this->settingsService->get('stock.low_stock_threshold', 5);
        $multiCurrency = $this->multiCurrencyEnabled();

        if ($multiCurrency) {
            $salesTodayByCurrency = Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('sold_at', [$todayStart, $todayEnd])
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as sales_total')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $purchasesTodayByCurrency = Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('purchased_at', [$todayStart, $todayEnd])
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as purchases_count, COALESCE(SUM(total_amount), 0) as purchases_total')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $salesTodayAgg = $salesTodayByCurrency->get('AFN');
            $purchasesTodayAgg = $purchasesTodayByCurrency->get('AFN');
            $salesTodayUsd = $salesTodayByCurrency->get('USD');
            $purchasesTodayUsd = $purchasesTodayByCurrency->get('USD');
        } else {
            $salesTodayAgg = Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('sold_at', [$todayStart, $todayEnd])
                ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as sales_total')
                ->first();

            $purchasesTodayAgg = Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('purchased_at', [$todayStart, $todayEnd])
                ->selectRaw('COUNT(*) as purchases_count, COALESCE(SUM(total_amount), 0) as purchases_total')
                ->first();

            $salesTodayUsd = null;
            $purchasesTodayUsd = null;
        }

        $lowStock = StockBalance::query()
            ->with([
                'variant:id,product_id,name',
                'variant.product:id,name',
                'location:id,name',
            ])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->where('quantity', '<=', $lowStockThreshold)
            ->orderBy('quantity')
            ->limit(10)
            ->get();

        $recentSales = Sale::query()
            ->with(['customer:id,name', 'location:id,name'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->latest('sold_at')
            ->limit(5)
            ->get();

        $recentPurchases = Purchase::query()
            ->with(['supplier:id,name', 'location:id,name'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->latest('purchased_at')
            ->limit(5)
            ->get();

        $workerPaymentsToday = round((float) WorkerPayment::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('paid_at', [$todayStart, $todayEnd])
            ->sum('amount'), 2);

        $stockQuantity = round((float) StockBalance::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->sum('quantity'), 4);

        $externalPersonOwes = ExternalDebt::query()
            ->where('direction', 'person_owes')
            ->where('status', 'open');
        $externalBusinessOwes = ExternalDebt::query()
            ->where('direction', 'business_owes')
            ->where('status', 'open');

        // Match Sales / Purchases / Reports menus: unpaid document remainings,
        // not denormalized customer/supplier balance columns (those can drift).
        if ($multiCurrency) {
            $salesRemaining = Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as total')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $purchasesRemaining = Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as total')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $customersTotalAfn = (float) ($salesRemaining->get('AFN')->total ?? 0);
            $customersTotalUsd = (float) ($salesRemaining->get('USD')->total ?? 0);
            $suppliersTotalAfn = (float) ($purchasesRemaining->get('AFN')->total ?? 0);
            $suppliersTotalUsd = (float) ($purchasesRemaining->get('USD')->total ?? 0);

            $externalPersonOwesAfn = (clone $externalPersonOwes)->where(function ($q) {
                $q->where('currency', 'AFN')->orWhereNull('currency');
            })->sum('remaining_amount');
            $externalPersonOwesUsd = (clone $externalPersonOwes)->where('currency', 'USD')->sum('remaining_amount');
            $externalBusinessOwesAfn = (clone $externalBusinessOwes)->where(function ($q) {
                $q->where('currency', 'AFN')->orWhereNull('currency');
            })->sum('remaining_amount');
            $externalBusinessOwesUsd = (clone $externalBusinessOwes)->where('currency', 'USD')->sum('remaining_amount');
        } else {
            $customersTotalAfn = (float) Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->sum('remaining_amount');
            $customersTotalUsd = 0;
            $suppliersTotalAfn = (float) Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->sum('remaining_amount');
            $suppliersTotalUsd = 0;
            $externalPersonOwesAfn = $externalPersonOwes->sum('remaining_amount');
            $externalPersonOwesUsd = 0;
            $externalBusinessOwesAfn = $externalBusinessOwes->sum('remaining_amount');
            $externalBusinessOwesUsd = 0;
        }

        return [
            'today' => [
                'sales_total' => round((float) ($salesTodayAgg->sales_total ?? 0), 2),
                'sales_count' => (int) ($salesTodayAgg->sales_count ?? 0),
                'purchases_total' => round((float) ($purchasesTodayAgg->purchases_total ?? 0), 2),
                'purchases_count' => (int) ($purchasesTodayAgg->purchases_count ?? 0),
                'sales_total_usd' => round((float) ($salesTodayUsd->sales_total ?? 0), 2),
                'sales_count_usd' => (int) ($salesTodayUsd->sales_count ?? 0),
                'purchases_total_usd' => round((float) ($purchasesTodayUsd->purchases_total ?? 0), 2),
                'purchases_count_usd' => (int) ($purchasesTodayUsd->purchases_count ?? 0),
            ],
            'receivables' => [
                'customers_total' => round($customersTotalAfn, 2),
                'customers_total_usd' => round($customersTotalUsd, 2),
                'external_person_owes' => round((float) $externalPersonOwesAfn, 2),
                'external_person_owes_usd' => round((float) $externalPersonOwesUsd, 2),
            ],
            'payables' => [
                'suppliers_total' => round($suppliersTotalAfn, 2),
                'suppliers_total_usd' => round($suppliersTotalUsd, 2),
                'external_business_owes' => round((float) $externalBusinessOwesAfn, 2),
                'external_business_owes_usd' => round((float) $externalBusinessOwesUsd, 2),
            ],
            'stock_warnings' => $lowStock,
            'low_stock_threshold' => $lowStockThreshold,
            'recent_sales' => $recentSales,
            'recent_purchases' => $recentPurchases,
            'profit_loss' => $this->safeProfitLossSummaryCard($todayStart, $todayEnd, $locationId),
            'worker_payments_today' => $workerPaymentsToday,
            'stock_quantity' => $stockQuantity,
            'by_location' => $this->dashboardByLocation($todayStart, $todayEnd, $locationId),
        ];
    }

    /**
     * Province totals that make up the dashboard headline numbers.
     * Sales and purchases keep AFN and USD separate per province.
     *
     * @return list<array{
     *     location_id:int,
     *     name:string,
     *     stock_quantity:float,
     *     sales_total:float,
     *     sales_count:int,
     *     sales_total_usd:float,
     *     sales_count_usd:int,
     *     purchases_total:float,
     *     purchases_count:int,
     *     purchases_total_usd:float,
     *     purchases_count_usd:int,
     *     worker_payments_today:float
     * }>
     */
    private function dashboardByLocation(Carbon $todayStart, Carbon $todayEnd, ?int $locationId): array
    {
        $locations = Location::query()
            ->when($locationId, fn ($q) => $q->whereKey($locationId))
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        if ($locations->isEmpty()) {
            return [];
        }

        $stockByLoc = StockBalance::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->selectRaw('location_id, COALESCE(SUM(quantity), 0) as total')
            ->groupBy('location_id')
            ->pluck('total', 'location_id');

        $multiCurrency = $this->multiCurrencyEnabled();

        if ($multiCurrency) {
            $salesByLocCurrency = Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('sold_at', [$todayStart, $todayEnd])
                ->selectRaw('location_id')
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as sales_total')
                ->groupBy('location_id', DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->groupBy('location_id');

            $purchasesByLocCurrency = Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('purchased_at', [$todayStart, $todayEnd])
                ->selectRaw('location_id')
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as purchases_count, COALESCE(SUM(total_amount), 0) as purchases_total')
                ->groupBy('location_id', DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->groupBy('location_id');
        } else {
            $salesByLocCurrency = Sale::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('sold_at', [$todayStart, $todayEnd])
                ->selectRaw('location_id')
                ->selectRaw("'AFN' as currency")
                ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as sales_total')
                ->groupBy('location_id')
                ->get()
                ->groupBy('location_id');

            $purchasesByLocCurrency = Purchase::query()
                ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
                ->whereBetween('purchased_at', [$todayStart, $todayEnd])
                ->selectRaw('location_id')
                ->selectRaw("'AFN' as currency")
                ->selectRaw('COUNT(*) as purchases_count, COALESCE(SUM(total_amount), 0) as purchases_total')
                ->groupBy('location_id')
                ->get()
                ->groupBy('location_id');
        }

        $workersByLoc = WorkerPayment::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('paid_at', [$todayStart, $todayEnd])
            ->selectRaw('location_id, COALESCE(SUM(amount), 0) as total')
            ->groupBy('location_id')
            ->pluck('total', 'location_id');

        return $locations->map(function (Location $location) use ($stockByLoc, $salesByLocCurrency, $purchasesByLocCurrency, $workersByLoc) {
            $salesRows = ($salesByLocCurrency->get($location->id) ?? collect())->keyBy('currency');
            $purchaseRows = ($purchasesByLocCurrency->get($location->id) ?? collect())->keyBy('currency');
            $salesAfn = $salesRows->get('AFN');
            $salesUsd = $salesRows->get('USD');
            $purchasesAfn = $purchaseRows->get('AFN');
            $purchasesUsd = $purchaseRows->get('USD');

            return [
                'location_id' => $location->id,
                'name' => $location->name,
                'stock_quantity' => round((float) ($stockByLoc[$location->id] ?? 0), 4),
                'sales_total' => round((float) ($salesAfn->sales_total ?? 0), 2),
                'sales_count' => (int) ($salesAfn->sales_count ?? 0),
                'sales_total_usd' => round((float) ($salesUsd->sales_total ?? 0), 2),
                'sales_count_usd' => (int) ($salesUsd->sales_count ?? 0),
                'purchases_total' => round((float) ($purchasesAfn->purchases_total ?? 0), 2),
                'purchases_count' => (int) ($purchasesAfn->purchases_count ?? 0),
                'purchases_total_usd' => round((float) ($purchasesUsd->purchases_total ?? 0), 2),
                'purchases_count_usd' => (int) ($purchasesUsd->purchases_count ?? 0),
                'worker_payments_today' => round((float) ($workersByLoc[$location->id] ?? 0), 2),
            ];
        })->values()->all();
    }

    public function salesSummary(?Carbon $from, ?Carbon $to, ?int $locationId = null, ?int $productId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = Sale::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($productId, function ($q) use ($productId) {
                $q->whereHas('items.variant', fn ($variant) => $variant->where('product_id', $productId));
            })
            ->when($from, fn ($q) => $q->where('sold_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('sold_at', '<=', $to->copy()->endOfDay()));

        if ($this->multiCurrencyEnabled()) {
            $byCurrency = (clone $query)
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as count')
                ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
                ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $summary = $byCurrency->get('AFN');
            $summaryUsd = $byCurrency->get('USD');
            $byDay = $this->groupByDay(
                (clone $query)->where(function ($q) {
                    $q->where('currency', 'AFN')->orWhereNull('currency');
                }),
                'sold_at',
                'total_amount'
            );
            $byDayUsd = $this->groupByDay(
                (clone $query)->where('currency', 'USD'),
                'sold_at',
                'total_amount'
            );
        } else {
            $summary = (clone $query)
                ->selectRaw('COUNT(*) as count')
                ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
                ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
                ->first();
            $summaryUsd = null;
            $byDay = $this->groupByDay(clone $query, 'sold_at', 'total_amount');
            $byDayUsd = collect();
        }

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($summary->paid_amount ?? 0), 2),
                'remaining_amount' => round((float) ($summary->remaining_amount ?? 0), 2),
                'count_usd' => (int) ($summaryUsd->count ?? 0),
                'total_amount_usd' => round((float) ($summaryUsd->total_amount ?? 0), 2),
                'paid_amount_usd' => round((float) ($summaryUsd->paid_amount ?? 0), 2),
                'remaining_amount_usd' => round((float) ($summaryUsd->remaining_amount ?? 0), 2),
            ],
            'by_day' => $byDay,
            'by_day_usd' => $byDayUsd,
        ];
    }

    public function purchasesSummary(?Carbon $from, ?Carbon $to, ?int $locationId = null, ?int $productId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = Purchase::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($productId, function ($q) use ($productId) {
                $q->whereHas('items.variant', fn ($variant) => $variant->where('product_id', $productId));
            })
            ->when($from, fn ($q) => $q->where('purchased_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('purchased_at', '<=', $to->copy()->endOfDay()));

        if ($this->multiCurrencyEnabled()) {
            $byCurrency = (clone $query)
                ->selectRaw("COALESCE(currency, 'AFN') as currency")
                ->selectRaw('COUNT(*) as count')
                ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
                ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
                ->groupBy(DB::raw("COALESCE(currency, 'AFN')"))
                ->get()
                ->keyBy('currency');

            $summary = $byCurrency->get('AFN');
            $summaryUsd = $byCurrency->get('USD');
            $byDay = $this->groupByDay(
                (clone $query)->where(function ($q) {
                    $q->where('currency', 'AFN')->orWhereNull('currency');
                }),
                'purchased_at',
                'total_amount'
            );
            $byDayUsd = $this->groupByDay(
                (clone $query)->where('currency', 'USD'),
                'purchased_at',
                'total_amount'
            );
        } else {
            $summary = (clone $query)
                ->selectRaw('COUNT(*) as count')
                ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
                ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
                ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
                ->first();
            $summaryUsd = null;
            $byDay = $this->groupByDay(clone $query, 'purchased_at', 'total_amount');
            $byDayUsd = collect();
        }

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($summary->paid_amount ?? 0), 2),
                'remaining_amount' => round((float) ($summary->remaining_amount ?? 0), 2),
                'count_usd' => (int) ($summaryUsd->count ?? 0),
                'total_amount_usd' => round((float) ($summaryUsd->total_amount ?? 0), 2),
                'paid_amount_usd' => round((float) ($summaryUsd->paid_amount ?? 0), 2),
                'remaining_amount_usd' => round((float) ($summaryUsd->remaining_amount ?? 0), 2),
            ],
            'by_day' => $byDay,
            'by_day_usd' => $byDayUsd,
        ];
    }

    public function stockReport(?int $locationId = null, ?string $module = null): array
    {
        $balances = StockBalance::query()
            ->with(['variant.product', 'location'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($module, function ($q) use ($module) {
                $q->whereHas('variant.product', fn ($p) => $p->where('module', $module));
            })
            ->orderBy('quantity')
            ->limit(500)
            ->get();

        return [
            'filters' => [
                'location_id' => $locationId,
                'module' => $module,
            ],
            'total_variants_in_stock' => $balances->where('quantity', '>', 0)->count(),
            'balances' => $balances,
            'truncated' => $balances->count() >= 500,
        ];
    }

    public function stockMovementsReport(?Carbon $from, ?Carbon $to, ?int $locationId = null, ?string $type = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = StockMovement::query()
            ->with(['variant.product', 'location', 'user'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($type, fn ($q) => $q->where('type', $type))
            ->when($from, fn ($q) => $q->where('occurred_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('occurred_at', '<=', $to->copy()->endOfDay()))
            ->latest('occurred_at')
            ->limit(200);

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId) + ['type' => $type],
            'movements' => $query->get(),
            'truncated' => true,
        ];
    }

    public function financialDebts(): array
    {
        $multiCurrency = $this->multiCurrencyEnabled();

        $customerQuery = Customer::query()->where('balance', '>', 0);
        $supplierQuery = Supplier::query()->where('balance', '>', 0);
        $customerColumns = ['id', 'name', 'phone', 'balance'];
        $supplierColumns = ['id', 'name', 'phone', 'balance'];

        if ($multiCurrency) {
            $customerQuery = Customer::query()->where(function ($q) {
                $q->where('balance', '>', 0)->orWhere('balance_usd', '>', 0);
            });
            $supplierQuery = Supplier::query()->where(function ($q) {
                $q->where('balance', '>', 0)->orWhere('balance_usd', '>', 0);
            });
            $customerColumns[] = 'balance_usd';
            $supplierColumns[] = 'balance_usd';
        }

        $personOwes = ExternalDebt::query()->where('direction', 'person_owes')->where('status', 'open');
        $businessOwes = ExternalDebt::query()->where('direction', 'business_owes')->where('status', 'open');

        if ($multiCurrency) {
            $personOwesAfn = (clone $personOwes)->where(function ($q) {
                $q->where('currency', 'AFN')->orWhereNull('currency');
            })->sum('remaining_amount');
            $personOwesUsd = (clone $personOwes)->where('currency', 'USD')->sum('remaining_amount');
            $businessOwesAfn = (clone $businessOwes)->where(function ($q) {
                $q->where('currency', 'AFN')->orWhereNull('currency');
            })->sum('remaining_amount');
            $businessOwesUsd = (clone $businessOwes)->where('currency', 'USD')->sum('remaining_amount');
            $customersTotalUsd = (float) Customer::query()->sum('balance_usd');
            $suppliersTotalUsd = (float) Supplier::query()->sum('balance_usd');
        } else {
            $personOwesAfn = $personOwes->sum('remaining_amount');
            $personOwesUsd = 0;
            $businessOwesAfn = $businessOwes->sum('remaining_amount');
            $businessOwesUsd = 0;
            $customersTotalUsd = 0;
            $suppliersTotalUsd = 0;
        }

        return [
            'customers' => [
                'total_receivable' => round((float) Customer::query()->sum('balance'), 2),
                'total_receivable_usd' => round($customersTotalUsd, 2),
                'with_balance' => $customerQuery
                    ->orderByDesc('balance')
                    ->limit(200)
                    ->get($customerColumns),
            ],
            'suppliers' => [
                'total_payable' => round((float) Supplier::query()->sum('balance'), 2),
                'total_payable_usd' => round($suppliersTotalUsd, 2),
                'with_balance' => $supplierQuery
                    ->orderByDesc('balance')
                    ->limit(200)
                    ->get($supplierColumns),
            ],
            'external' => [
                'person_owes_total' => round((float) $personOwesAfn, 2),
                'person_owes_total_usd' => round((float) $personOwesUsd, 2),
                'business_owes_total' => round((float) $businessOwesAfn, 2),
                'business_owes_total_usd' => round((float) $businessOwesUsd, 2),
                'open_debts' => ExternalDebt::query()
                    ->with('party')
                    ->where('status', 'open')
                    ->orderByDesc('remaining_amount')
                    ->limit(200)
                    ->get(),
            ],
        ];
    }

    public function workerPaymentsReport(?Carbon $from, ?Carbon $to, ?int $workerId = null, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = WorkerPayment::query()
            ->with(['worker', 'location', 'user'])
            ->when($workerId, fn ($q) => $q->where('worker_id', $workerId))
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('paid_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('paid_at', '<=', $to->copy()->endOfDay()));

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as payments_count, COALESCE(SUM(amount), 0) as total_amount')
            ->first();

        $payments = (clone $query)->latest('paid_at')->limit(200)->get();

        $byWorker = WorkerPayment::query()
            ->select('worker_id', DB::raw('SUM(amount) as total_amount'), DB::raw('COUNT(*) as payments_count'))
            ->when($workerId, fn ($q) => $q->where('worker_id', $workerId))
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('paid_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('paid_at', '<=', $to->copy()->endOfDay()))
            ->groupBy('worker_id')
            ->with('worker')
            ->get();

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId) + ['worker_id' => $workerId],
            'summary' => [
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
                'payments_count' => (int) ($summary->payments_count ?? 0),
            ],
            'by_worker' => $byWorker,
            'payments' => $payments,
            'truncated' => $payments->count() >= 200,
        ];
    }

    public function damagedStockReport(?Carbon $from, ?Carbon $to, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = DamagedStock::query()
            ->with(['variant.product', 'location', 'user'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('damaged_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('damaged_at', '<=', $to->copy()->endOfDay()))
            ->latest('damaged_at');

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as records_count, COALESCE(SUM(quantity), 0) as total_quantity')
            ->first();

        $rows = (clone $query)->limit(200)->get();

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'records_count' => (int) ($summary->records_count ?? 0),
                'total_quantity' => round((float) ($summary->total_quantity ?? 0), 4),
            ],
            'records' => $rows,
            'truncated' => $rows->count() >= 200,
        ];
    }

    public function salesReturnsReport(?Carbon $from, ?Carbon $to, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = SalesReturn::query()
            ->with(['sale', 'customer', 'location', 'items.variant.product'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('returned_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('returned_at', '<=', $to->copy()->endOfDay()));

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount')
            ->first();

        $records = (clone $query)->latest('returned_at')->limit(200)->get();

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
            ],
            'records' => $records,
            'truncated' => $records->count() >= 200,
        ];
    }

    public function homeExpensesReport(?Carbon $from, ?Carbon $to, ?string $category = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = HomeExpense::query()
            ->with('user')
            ->when($category, fn ($q) => $q->where('category', $category))
            ->when($from, fn ($q) => $q->where('expense_date', '>=', $from->toDateString()))
            ->when($to, fn ($q) => $q->where('expense_date', '<=', $to->toDateString()));

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount')
            ->first();

        $rows = (clone $query)->latest('expense_date')->limit(200)->get();

        return [
            'filters' => [
                'from' => $from?->toDateString(),
                'to' => $to?->toDateString(),
                'category' => $category,
            ],
            'note' => 'Home expenses are separate from business profit (Master Spec §15).',
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
            ],
            'records' => $rows,
            'truncated' => $rows->count() >= 200,
        ];
    }

    /**
     * Business P&L using weighted-average purchase cost (Master Spec costing choice).
     * Home expenses remain excluded from business net profit (§15 / §28.2).
     */
    public function profitLoss(?Carbon $from = null, ?Carbon $to = null, ?int $locationId = null, ?int $productId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);
        $cacheKey = 'mbms.pl.'.$this->reportCacheVersion().'.'.($locationId ?? 'all').'.'.($productId ?? 'all').'.'.$from->getTimestamp().'.'.$to->getTimestamp();

        return Cache::remember($cacheKey, 45, function () use ($from, $to, $locationId, $productId) {
            return $this->calculateProfitLoss($from, $to, $locationId, $productId);
        });
    }

    /**
     * Drop cached dashboard and profit figures after a sale, purchase, payment, or stock change.
     */
    public function forgetReports(): void
    {
        Cache::forever('mbms.report.version', $this->reportCacheVersion() + 1);
    }

    public function reportCacheVersion(): int
    {
        return (int) Cache::get('mbms.report.version', 1);
    }

    private function calculateProfitLoss(Carbon $from, Carbon $to, ?int $locationId, ?int $productId = null): array
    {
        $purchaseReturnedQty = $this->purchaseReturnedQuantitySql();
        $saleReturnedQty = $this->saleReturnedQuantitySql();

        // Net purchase qty/cost after purchase returns (weighted-average denominator), per currency.
        $avgCosts = PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->join('product_variants', 'product_variants.id', '=', 'purchase_items.product_variant_id')
            ->when($locationId, fn ($q) => $q->where('purchases.location_id', $locationId))
            ->when($productId, fn ($q) => $q->where('product_variants.product_id', $productId))
            ->where('purchases.purchased_at', '<=', $to)
            ->selectRaw('purchase_items.product_variant_id as product_variant_id')
            ->selectRaw("COALESCE(purchases.currency, 'AFN') as currency")
            ->selectRaw("SUM(purchase_items.unit_price * (purchase_items.quantity - {$purchaseReturnedQty})) as cost_total")
            ->selectRaw("SUM(purchase_items.quantity - {$purchaseReturnedQty}) as qty_total")
            ->groupBy('purchase_items.product_variant_id', DB::raw("COALESCE(purchases.currency, 'AFN')"))
            ->get()
            ->keyBy(fn ($row) => $row->product_variant_id.'|'.$row->currency);

        // Gross sold qty/revenue before sales returns (for transparency), per currency.
        $soldItems = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('product_variants', 'product_variants.id', '=', 'sale_items.product_variant_id')
            ->when($locationId, fn ($q) => $q->where('sales.location_id', $locationId))
            ->when($productId, fn ($q) => $q->where('product_variants.product_id', $productId))
            ->whereBetween('sales.sold_at', [$from, $to])
            ->selectRaw('sale_items.product_variant_id as product_variant_id')
            ->selectRaw('product_variants.product_id as product_id')
            ->selectRaw("COALESCE(sales.currency, 'AFN') as currency")
            ->selectRaw('SUM(sale_items.quantity) as sold_qty_gross')
            ->selectRaw("SUM({$saleReturnedQty}) as returned_qty")
            ->selectRaw("SUM(sale_items.quantity - {$saleReturnedQty}) as sold_qty")
            ->selectRaw('SUM(sale_items.unit_price * sale_items.quantity) as revenue_gross')
            ->selectRaw("SUM(sale_items.unit_price * {$saleReturnedQty}) as returns_amount")
            ->selectRaw("SUM(sale_items.unit_price * (sale_items.quantity - {$saleReturnedQty})) as revenue_total")
            ->groupBy(
                'sale_items.product_variant_id',
                'product_variants.product_id',
                DB::raw("COALESCE(sales.currency, 'AFN')")
            )
            ->get();

        $returnsSummary = SalesReturn::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('returned_at', [$from, $to])
            ->selectRaw('COUNT(*) as returns_count, COALESCE(SUM(total_amount), 0) as returns_amount')
            ->first();

        $variantNames = ProductVariant::query()
            ->with('product:id,name,module')
            ->whereIn('id', $soldItems->pluck('product_variant_id')->all())
            ->get()
            ->keyBy('id');

        $totals = [
            'AFN' => ['cogs' => 0.0, 'revenue' => 0.0, 'gross_sales' => 0.0, 'returns' => 0.0],
            'USD' => ['cogs' => 0.0, 'revenue' => 0.0, 'gross_sales' => 0.0, 'returns' => 0.0],
        ];
        $rows = [];
        $locationLabel = $locationId
            ? (string) (Location::query()->whereKey($locationId)->value('name') ?: $locationId)
            : 'All';

        foreach ($soldItems as $item) {
            $currency = in_array((string) $item->currency, ['AFN', 'USD'], true) ? (string) $item->currency : 'AFN';
            $avg = $avgCosts->get($item->product_variant_id.'|'.$currency);
            $unitCost = ($avg && (float) $avg->qty_total > 0)
                ? ((float) $avg->cost_total / (float) $avg->qty_total)
                : 0.0;
            $soldQty = max(0, (float) $item->sold_qty);
            $lineCogs = round($unitCost * $soldQty, 2);
            $lineRevenue = round((float) $item->revenue_total, 2);
            $lineGross = round((float) $item->revenue_gross, 2);
            $lineReturns = round((float) $item->returns_amount, 2);
            $totals[$currency]['cogs'] += $lineCogs;
            $totals[$currency]['revenue'] += $lineRevenue;
            $totals[$currency]['gross_sales'] += $lineGross;
            $totals[$currency]['returns'] += $lineReturns;

            if ($soldQty <= 0 && $lineReturns <= 0) {
                continue;
            }

            $variant = $variantNames->get($item->product_variant_id);
            $productName = $variant?->product?->name;
            $variantName = $variant?->name;
            $module = $variant?->product?->module;
            $moduleLabel = $module instanceof \BackedEnum
                ? (string) $module->value
                : (string) ($module ?? 'all');

            $rows[] = [
                'module' => $moduleLabel,
                'currency' => $currency,
                'product_id' => (int) ($item->product_id ?: ($variant?->product_id ?? 0)),
                'product' => trim(($productName ?? 'Product').($variantName ? ' · '.$variantName : '')),
                'location' => $locationLabel,
                'sold_qty' => round(max(0, (float) $item->sold_qty_gross), 4),
                'returned_qty' => round(max(0, (float) $item->returned_qty), 4),
                'revenue' => $lineRevenue,
                'returns' => $lineReturns,
                'cost' => $lineCogs,
                'result' => round($lineRevenue - $lineCogs, 2),
            ];
        }

        $afnCogs = round($totals['AFN']['cogs'], 2);
        $afnRevenue = round($totals['AFN']['revenue'], 2);
        $afnGrossSales = round($totals['AFN']['gross_sales'], 2);
        $afnReturns = round($totals['AFN']['returns'], 2);
        $afnGross = round($afnRevenue - $afnCogs, 2);

        $usdCogs = round($totals['USD']['cogs'], 2);
        $usdRevenue = round($totals['USD']['revenue'], 2);
        $usdGrossSales = round($totals['USD']['gross_sales'], 2);
        $usdReturns = round($totals['USD']['returns'], 2);
        $usdGross = round($usdRevenue - $usdCogs, 2);

        $returnsCount = (int) ($returnsSummary->returns_count ?? 0);
        $operating = 0.0;

        return [
            'available' => true,
            'method' => 'weighted_average',
            'method_label' => 'Weighted Average',
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                // Gross sales and net revenue are the same figure (sales after returns).
                'gross_sales' => $afnRevenue,
                'returns_amount' => $afnReturns,
                'returns_count' => $returnsCount,
                'revenue' => $afnRevenue,
                'cost' => $afnCogs,
                'cogs' => $afnCogs,
                'gross_profit' => $afnGross,
                'operating_expenses' => $operating,
                'net_profit' => $afnGross,
                'gross_sales_usd' => $usdRevenue,
                'returns_amount_usd' => $usdReturns,
                'revenue_usd' => $usdRevenue,
                'cost_usd' => $usdCogs,
                'cogs_usd' => $usdCogs,
                'gross_profit_usd' => $usdGross,
                'net_profit_usd' => $usdGross,
                'note' => 'AFN and USD kept separate (no FX). Gross sales and net revenue are equal (sales after returns). COGS uses weighted-average purchase unit cost in the same currency. Home expenses are excluded from business P&L.',
            ],
            'rows' => $rows,
        ];
    }

    /** @deprecated Use profitLoss() */
    public function profitLossPlaceholder(?Carbon $from = null, ?Carbon $to = null, ?int $locationId = null): array
    {
        return $this->profitLoss($from, $to, $locationId);
    }

    private function profitLossSummaryCard(Carbon $from, Carbon $to, ?int $locationId): array
    {
        $pl = $this->profitLoss($from, $to, $locationId);

        return [
            'available' => true,
            'method' => 'weighted_average',
            'net_profit' => $pl['summary']['net_profit'] ?? 0,
            'gross_profit' => $pl['summary']['gross_profit'] ?? 0,
            'revenue' => $pl['summary']['revenue'] ?? 0,
            'cost' => $pl['summary']['cost'] ?? 0,
            'net_profit_usd' => $pl['summary']['net_profit_usd'] ?? 0,
            'gross_profit_usd' => $pl['summary']['gross_profit_usd'] ?? 0,
            'revenue_usd' => $pl['summary']['revenue_usd'] ?? 0,
            'cost_usd' => $pl['summary']['cost_usd'] ?? 0,
        ];
    }

    /**
     * Dashboard must still load when P&L SQL fails (e.g. pending migrations).
     *
     * @return array{available:bool, method:string, net_profit:?float, gross_profit:?float, revenue:?float, cost:?float}
     */
    private function safeProfitLossSummaryCard(Carbon $from, Carbon $to, ?int $locationId): array
    {
        try {
            return $this->profitLossSummaryCard($from, $to, $locationId);
        } catch (Throwable $e) {
            report($e);

            return [
                'available' => false,
                'method' => 'weighted_average',
                'net_profit' => null,
                'gross_profit' => null,
                'revenue' => null,
                'cost' => null,
            ];
        }
    }

    /**
     * Production can briefly run new code before the multi-currency migration.
     * Detect the schema so dashboard/reports stay available on AFN-only DBs.
     */
    private function multiCurrencyEnabled(): bool
    {
        static $enabled = null;

        if ($enabled !== null) {
            return $enabled;
        }

        $enabled = Schema::hasColumn('sales', 'currency')
            && Schema::hasColumn('purchases', 'currency')
            && Schema::hasColumn('customers', 'balance_usd')
            && Schema::hasColumn('suppliers', 'balance_usd')
            && Schema::hasColumn('external_debts', 'currency');

        return $enabled;
    }

    private function purchaseReturnedQuantitySql(): string
    {
        return Schema::hasColumn('purchase_items', 'returned_quantity')
            ? 'COALESCE(purchase_items.returned_quantity, 0)'
            : '0';
    }

    private function saleReturnedQuantitySql(): string
    {
        return Schema::hasColumn('sale_items', 'returned_quantity')
            ? 'COALESCE(sale_items.returned_quantity, 0)'
            : '0';
    }

    private function filtersPayload(?Carbon $from, ?Carbon $to, ?int $locationId): array
    {
        return [
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
            'location_id' => $locationId,
        ];
    }

    /**
     * Default to the last 90 days and cap ranges to keep reports bounded.
     *
     * @return array{0:?Carbon,1:?Carbon}
     */
    private function normalizeDateRange(?Carbon $from, ?Carbon $to): array
    {
        $to = ($to ?? now())->copy()->endOfDay();
        $from = ($from ?? $to->copy()->subDays(90))->copy()->startOfDay();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        if ($from->diffInDays($to) > 366) {
            $from = $to->copy()->subDays(366)->startOfDay();
        }

        return [$from, $to];
    }

    private function groupByDay(Builder $query, string $dateColumn, string $amountColumn): Collection
    {
        $driver = DB::connection()->getDriverName();
        $dayExpression = $driver === 'sqlite'
            ? "strftime('%Y-%m-%d', {$dateColumn})"
            : "DATE({$dateColumn})";

        return $query
            ->selectRaw("{$dayExpression} as day")
            ->selectRaw('COUNT(*) as count')
            ->selectRaw("SUM({$amountColumn}) as total_amount")
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'count' => (int) $row->count,
                'total_amount' => round((float) $row->total_amount, 2),
            ]);
    }
}
