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

        $lowStock = StockBalance::query()
            ->with(['variant.product', 'location'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->where('quantity', '<=', $lowStockThreshold)
            ->orderBy('quantity')
            ->limit(10)
            ->get();

        $recentSales = Sale::query()
            ->with(['customer', 'location'])
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->latest('sold_at')
            ->limit(5)
            ->get();

        $recentPurchases = Purchase::query()
            ->with(['supplier', 'location'])
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

        return [
            'today' => [
                'sales_total' => round((float) ($salesTodayAgg->sales_total ?? 0), 2),
                'sales_count' => (int) ($salesTodayAgg->sales_count ?? 0),
                'purchases_total' => round((float) ($purchasesTodayAgg->purchases_total ?? 0), 2),
                'purchases_count' => (int) ($purchasesTodayAgg->purchases_count ?? 0),
            ],
            'receivables' => [
                'customers_total' => round((float) Customer::query()->sum('balance'), 2),
                'external_person_owes' => round((float) ExternalDebt::query()
                    ->where('direction', 'person_owes')
                    ->where('status', 'open')
                    ->sum('remaining_amount'), 2),
            ],
            'payables' => [
                'suppliers_total' => round((float) Supplier::query()->sum('balance'), 2),
                'external_business_owes' => round((float) ExternalDebt::query()
                    ->where('direction', 'business_owes')
                    ->where('status', 'open')
                    ->sum('remaining_amount'), 2),
            ],
            'stock_warnings' => $lowStock,
            'low_stock_threshold' => $lowStockThreshold,
            'recent_sales' => $recentSales,
            'recent_purchases' => $recentPurchases,
            'profit_loss' => $this->profitLossSummaryCard($todayStart, $todayEnd, $locationId),
            'worker_payments_today' => $workerPaymentsToday,
            'stock_quantity' => $stockQuantity,
            'by_location' => $this->dashboardByLocation($todayStart, $todayEnd, $locationId),
        ];
    }

    /**
     * Province totals that make up the dashboard headline numbers.
     *
     * @return list<array{
     *     location_id:int,
     *     name:string,
     *     stock_quantity:float,
     *     sales_total:float,
     *     sales_count:int,
     *     purchases_total:float,
     *     purchases_count:int,
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

        $salesByLoc = Sale::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('sold_at', [$todayStart, $todayEnd])
            ->selectRaw('location_id, COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as sales_total')
            ->groupBy('location_id')
            ->get()
            ->keyBy('location_id');

        $purchasesByLoc = Purchase::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('purchased_at', [$todayStart, $todayEnd])
            ->selectRaw('location_id, COUNT(*) as purchases_count, COALESCE(SUM(total_amount), 0) as purchases_total')
            ->groupBy('location_id')
            ->get()
            ->keyBy('location_id');

        $workersByLoc = WorkerPayment::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->whereBetween('paid_at', [$todayStart, $todayEnd])
            ->selectRaw('location_id, COALESCE(SUM(amount), 0) as total')
            ->groupBy('location_id')
            ->pluck('total', 'location_id');

        return $locations->map(function (Location $location) use ($stockByLoc, $salesByLoc, $purchasesByLoc, $workersByLoc) {
            $sales = $salesByLoc->get($location->id);
            $purchases = $purchasesByLoc->get($location->id);

            return [
                'location_id' => $location->id,
                'name' => $location->name,
                'stock_quantity' => round((float) ($stockByLoc[$location->id] ?? 0), 4),
                'sales_total' => round((float) ($sales->sales_total ?? 0), 2),
                'sales_count' => (int) ($sales->sales_count ?? 0),
                'purchases_total' => round((float) ($purchases->purchases_total ?? 0), 2),
                'purchases_count' => (int) ($purchases->purchases_count ?? 0),
                'worker_payments_today' => round((float) ($workersByLoc[$location->id] ?? 0), 2),
            ];
        })->values()->all();
    }

    public function salesSummary(?Carbon $from, ?Carbon $to, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = Sale::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('sold_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('sold_at', '<=', $to->copy()->endOfDay()));

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
            ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
            ->first();

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($summary->paid_amount ?? 0), 2),
                'remaining_amount' => round((float) ($summary->remaining_amount ?? 0), 2),
            ],
            'by_day' => $this->groupByDay(clone $query, 'sold_at', 'total_amount'),
        ];
    }

    public function purchasesSummary(?Carbon $from, ?Carbon $to, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);

        $query = Purchase::query()
            ->when($locationId, fn ($q) => $q->where('location_id', $locationId))
            ->when($from, fn ($q) => $q->where('purchased_at', '>=', $from->copy()->startOfDay()))
            ->when($to, fn ($q) => $q->where('purchased_at', '<=', $to->copy()->endOfDay()));

        $summary = (clone $query)
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as total_amount')
            ->selectRaw('COALESCE(SUM(paid_amount), 0) as paid_amount')
            ->selectRaw('COALESCE(SUM(remaining_amount), 0) as remaining_amount')
            ->first();

        return [
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'count' => (int) ($summary->count ?? 0),
                'total_amount' => round((float) ($summary->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($summary->paid_amount ?? 0), 2),
                'remaining_amount' => round((float) ($summary->remaining_amount ?? 0), 2),
            ],
            'by_day' => $this->groupByDay(clone $query, 'purchased_at', 'total_amount'),
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
        return [
            'customers' => [
                'total_receivable' => round((float) Customer::query()->sum('balance'), 2),
                'with_balance' => Customer::query()
                    ->where('balance', '>', 0)
                    ->orderByDesc('balance')
                    ->limit(200)
                    ->get(['id', 'name', 'phone', 'balance']),
            ],
            'suppliers' => [
                'total_payable' => round((float) Supplier::query()->sum('balance'), 2),
                'with_balance' => Supplier::query()
                    ->where('balance', '>', 0)
                    ->orderByDesc('balance')
                    ->limit(200)
                    ->get(['id', 'name', 'phone', 'balance']),
            ],
            'external' => [
                'person_owes_total' => round((float) ExternalDebt::query()
                    ->where('direction', 'person_owes')
                    ->where('status', 'open')
                    ->sum('remaining_amount'), 2),
                'business_owes_total' => round((float) ExternalDebt::query()
                    ->where('direction', 'business_owes')
                    ->where('status', 'open')
                    ->sum('remaining_amount'), 2),
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
    public function profitLoss(?Carbon $from = null, ?Carbon $to = null, ?int $locationId = null): array
    {
        [$from, $to] = $this->normalizeDateRange($from, $to);
        $cacheKey = 'mbms.pl.'.$this->reportCacheVersion().'.'.($locationId ?? 'all').'.'.$from->getTimestamp().'.'.$to->getTimestamp();

        return Cache::remember($cacheKey, 45, function () use ($from, $to, $locationId) {
            return $this->calculateProfitLoss($from, $to, $locationId);
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

    private function calculateProfitLoss(Carbon $from, Carbon $to, ?int $locationId): array
    {
        // Net purchase qty/cost after purchase returns (weighted-average denominator).
        $avgCosts = PurchaseItem::query()
            ->join('purchases', 'purchases.id', '=', 'purchase_items.purchase_id')
            ->when($locationId, fn ($q) => $q->where('purchases.location_id', $locationId))
            ->where('purchases.purchased_at', '<=', $to)
            ->selectRaw('purchase_items.product_variant_id as product_variant_id')
            ->selectRaw('SUM(purchase_items.unit_price * (purchase_items.quantity - COALESCE(purchase_items.returned_quantity, 0))) as cost_total')
            ->selectRaw('SUM(purchase_items.quantity - COALESCE(purchase_items.returned_quantity, 0)) as qty_total')
            ->groupBy('purchase_items.product_variant_id')
            ->get()
            ->keyBy('product_variant_id');

        // Gross sold qty/revenue before sales returns (for transparency).
        $soldItems = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->when($locationId, fn ($q) => $q->where('sales.location_id', $locationId))
            ->whereBetween('sales.sold_at', [$from, $to])
            ->selectRaw('sale_items.product_variant_id as product_variant_id')
            ->selectRaw('SUM(sale_items.quantity) as sold_qty_gross')
            ->selectRaw('SUM(COALESCE(sale_items.returned_quantity, 0)) as returned_qty')
            ->selectRaw('SUM(sale_items.quantity - COALESCE(sale_items.returned_quantity, 0)) as sold_qty')
            ->selectRaw('SUM(sale_items.unit_price * sale_items.quantity) as revenue_gross')
            ->selectRaw('SUM(sale_items.unit_price * COALESCE(sale_items.returned_quantity, 0)) as returns_amount')
            ->selectRaw('SUM(sale_items.unit_price * (sale_items.quantity - COALESCE(sale_items.returned_quantity, 0))) as revenue_total')
            ->groupBy('sale_items.product_variant_id')
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

        $cogs = 0.0;
        $revenue = 0.0;
        $grossSales = 0.0;
        $returnsFromLines = 0.0;
        $rows = [];
        $locationLabel = $locationId
            ? (string) (Location::query()->whereKey($locationId)->value('name') ?: $locationId)
            : 'All';

        foreach ($soldItems as $item) {
            $avg = $avgCosts->get($item->product_variant_id);
            $unitCost = ($avg && (float) $avg->qty_total > 0)
                ? ((float) $avg->cost_total / (float) $avg->qty_total)
                : 0.0;
            $soldQty = max(0, (float) $item->sold_qty);
            $lineCogs = round($unitCost * $soldQty, 2);
            $lineRevenue = round((float) $item->revenue_total, 2);
            $lineGross = round((float) $item->revenue_gross, 2);
            $lineReturns = round((float) $item->returns_amount, 2);
            $cogs += $lineCogs;
            $revenue += $lineRevenue;
            $grossSales += $lineGross;
            $returnsFromLines += $lineReturns;

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

        $cogs = round($cogs, 2);
        $revenue = round($revenue, 2);
        $grossSales = round($grossSales, 2);
        // Keep returns aligned with net line revenue (sale-period returned qty), not return-date totals.
        $returnsAmount = round($returnsFromLines, 2);
        $returnsCount = (int) ($returnsSummary->returns_count ?? 0);
        $gross = round($revenue - $cogs, 2);
        $operating = 0.0;
        $net = $gross;

        return [
            'available' => true,
            'method' => 'weighted_average',
            'method_label' => 'Weighted Average',
            'filters' => $this->filtersPayload($from, $to, $locationId),
            'summary' => [
                'gross_sales' => $grossSales,
                'returns_amount' => $returnsAmount,
                'returns_count' => $returnsCount,
                'revenue' => $revenue,
                'cost' => $cogs,
                'cogs' => $cogs,
                'gross_profit' => $gross,
                'operating_expenses' => $operating,
                'net_profit' => $net,
                'note' => 'Net sales after returns. COGS uses weighted-average purchase unit cost through the period end. Home expenses are excluded from business P&L.',
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
        ];
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
