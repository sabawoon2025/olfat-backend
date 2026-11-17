<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Semantic / referential integrity audit of the business data.
 *
 * DBA reference: Mullins, "Database Administration" 2nd ed., Ch. 13 (Data Integrity:
 * structural and semantic integrity, referential integrity). Read-only; exits with
 * code 1 when any problem is found so a scheduler or CI can alert on it.
 */
class DatabaseIntegrityCheckCommand extends Command
{
    protected $signature = 'db:integrity-check {--json : Output machine-readable JSON}';

    protected $description = 'Audit referential and business-rule integrity of the database (read-only)';

    /** @var list<array{check: string, problems: int, sample: array<int, mixed>}> */
    private array $results = [];

    public function handle(): int
    {
        $this->orphans('sales', 'customer_id', 'customers');
        $this->orphans('sales', 'location_id', 'locations');
        $this->orphans('sales', 'user_id', 'users');
        $this->orphans('sale_items', 'sale_id', 'sales');
        $this->orphans('sale_items', 'product_variant_id', 'product_variants');
        $this->orphans('purchases', 'supplier_id', 'suppliers');
        $this->orphans('purchase_items', 'purchase_id', 'purchases');
        $this->orphans('purchase_items', 'product_variant_id', 'product_variants');
        $this->orphans('product_variants', 'product_id', 'products');
        $this->orphans('stock_balances', 'product_variant_id', 'product_variants');
        $this->orphans('stock_movements', 'product_variant_id', 'product_variants');
        $this->orphans('customer_payments', 'customer_id', 'customers');
        $this->orphans('supplier_payments', 'supplier_id', 'suppliers');
        $this->orphans('sales_returns', 'sale_id', 'sales');
        $this->orphans('external_debt_payments', 'external_debt_id', 'external_debts');

        $this->record('stock_balances: negative quantity', DB::table('stock_balances')->where('quantity', '<', 0)->pluck('id'));

        $this->record(
            'stock_balances vs stock_movements: balance != sum(quantity_change)',
            DB::table('stock_balances as b')
                ->leftJoin('stock_movements as m', function ($join) {
                    $join->on('m.product_variant_id', '=', 'b.product_variant_id')
                        ->on('m.location_id', '=', 'b.location_id');
                })
                ->groupBy('b.id', 'b.quantity')
                ->havingRaw('ABS(b.quantity - COALESCE(SUM(m.quantity_change), 0)) > 0.0001')
                ->pluck('b.id')
        );

        // After returns, header total_amount is reduced while original line_total stays.
        // Compare against effective open quantity * unit_price.
        $this->record(
            'sales: effective items total != total_amount',
            DB::table('sales as s')
                ->join('sale_items as i', 'i.sale_id', '=', 's.id')
                ->groupBy('s.id', 's.total_amount')
                ->havingRaw('ABS(s.total_amount - SUM((i.quantity - COALESCE(i.returned_quantity, 0)) * i.unit_price)) > 0.01')
                ->pluck('s.id')
        );

        $this->record(
            'purchases: effective items total != total_amount',
            DB::table('purchases as p')
                ->join('purchase_items as i', 'i.purchase_id', '=', 'p.id')
                ->groupBy('p.id', 'p.total_amount')
                ->havingRaw('ABS(p.total_amount - SUM((i.quantity - COALESCE(i.returned_quantity, 0)) * i.unit_price)) > 0.01')
                ->pluck('p.id')
        );

        $this->record('sales: paid + remaining > total', DB::table('sales')->whereRaw('paid_amount + remaining_amount > total_amount + 0.01')->pluck('id'));
        $this->record('purchases: paid + remaining > total', DB::table('purchases')->whereRaw('paid_amount + remaining_amount > total_amount + 0.01')->pluck('id'));
        $this->record('sales: negative amounts', DB::table('sales')->where(fn ($q) => $q->where('total_amount', '<', 0)->orWhere('paid_amount', '<', 0)->orWhere('remaining_amount', '<', 0))->pluck('id'));
        $this->record('sale_items: non-positive quantity', DB::table('sale_items')->where('quantity', '<=', 0)->pluck('id'));
        $this->record('purchase_items: non-positive quantity', DB::table('purchase_items')->where('quantity', '<=', 0)->pluck('id'));
        $this->record('external_debts: remaining != original - paid', DB::table('external_debts')->whereRaw('ABS(remaining_amount - (original_amount - paid_amount)) > 0.01')->pluck('id'));
        $this->record('external_debts: status closed but remaining > 0', DB::table('external_debts')->where('status', 'closed')->where('remaining_amount', '>', 0)->pluck('id'));
        $this->record('sales: invalid payment_type', DB::table('sales')->whereNotIn('payment_type', ['cash', 'credit', 'mixed'])->pluck('id'));
        $this->record('users: invalid role', DB::table('users')->whereNotIn('role', ['admin', 'staff'])->pluck('id'));
        $this->record('users: no active admin', DB::table('users')->where('role', 'admin')->where('is_active', true)->exists() ? collect() : collect(['none']));

        $this->partyBalanceDrift();

        $problems = array_sum(array_column($this->results, 'problems'));

        if ($this->option('json')) {
            $this->line(json_encode(['problems' => $problems, 'checks' => $this->results], JSON_PRETTY_PRINT));
        } else {
            foreach ($this->results as $result) {
                $status = $result['problems'] === 0 ? '<fg=green>OK</>' : "<fg=red>{$result['problems']} problem(s)</>";
                $this->components->twoColumnDetail($result['check'], $status);

                if ($result['problems'] > 0) {
                    $this->line('    sample ids: '.implode(', ', $result['sample']));
                }
            }

            $this->newLine();
            $problems === 0
                ? $this->components->info('Integrity check passed: no problems found.')
                : $this->components->error("Integrity check found {$problems} problem(s).");
        }

        return $problems === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function orphans(string $table, string $column, string $parentTable): void
    {
        $ids = DB::table("{$table} as c")
            ->leftJoin("{$parentTable} as p", 'p.id', '=', "c.{$column}")
            ->whereNotNull("c.{$column}")
            ->whereNull('p.id')
            ->pluck('c.id');

        $this->record("{$table}.{$column} -> {$parentTable}: orphan rows", $ids);
    }

    /**
     * Compare denormalized party balances to open document remainings (source of truth).
     */
    private function partyBalanceDrift(): void
    {
        $hasSaleCurrency = $this->hasColumn('sales', 'currency');
        $hasPurchaseCurrency = $this->hasColumn('purchases', 'currency');
        $hasCustomerUsd = $this->hasColumn('customers', 'balance_usd');
        $hasSupplierUsd = $this->hasColumn('suppliers', 'balance_usd');

        $saleAfnFilter = $hasSaleCurrency ? " AND (s.currency = 'AFN' OR s.currency IS NULL)" : '';
        $purchaseAfnFilter = $hasPurchaseCurrency ? " AND (p.currency = 'AFN' OR p.currency IS NULL)" : '';

        $this->record(
            'customers.balance vs sales.remaining_amount (AFN)',
            DB::table('customers as c')
                ->whereRaw(
                    'ABS(COALESCE(c.balance, 0) - COALESCE((
                        SELECT SUM(s.remaining_amount) FROM sales s
                        WHERE s.customer_id = c.id'.$saleAfnFilter.'
                    ), 0)) > 0.01'
                )
                ->pluck('c.id')
        );

        if ($hasCustomerUsd && $hasSaleCurrency) {
            $this->record(
                'customers.balance_usd vs sales.remaining_amount (USD)',
                DB::table('customers as c')
                    ->whereRaw(
                        "ABS(COALESCE(c.balance_usd, 0) - COALESCE((
                            SELECT SUM(s.remaining_amount) FROM sales s
                            WHERE s.customer_id = c.id AND s.currency = 'USD'
                        ), 0)) > 0.01"
                    )
                    ->pluck('c.id')
            );
        }

        $this->record(
            'suppliers.balance vs purchases.remaining_amount (AFN)',
            DB::table('suppliers as s')
                ->whereRaw(
                    'ABS(COALESCE(s.balance, 0) - COALESCE((
                        SELECT SUM(p.remaining_amount) FROM purchases p
                        WHERE p.supplier_id = s.id'.$purchaseAfnFilter.'
                    ), 0)) > 0.01'
                )
                ->pluck('s.id')
        );

        if ($hasSupplierUsd && $hasPurchaseCurrency) {
            $this->record(
                'suppliers.balance_usd vs purchases.remaining_amount (USD)',
                DB::table('suppliers as s')
                    ->whereRaw(
                        "ABS(COALESCE(s.balance_usd, 0) - COALESCE((
                            SELECT SUM(p.remaining_amount) FROM purchases p
                            WHERE p.supplier_id = s.id AND p.currency = 'USD'
                        ), 0)) > 0.01"
                    )
                    ->pluck('s.id')
            );
        }
    }

    private function hasColumn(string $table, string $column): bool
    {
        return Schema::hasColumn($table, $column);
    }

    /**
     * @param  Collection<int, mixed>  $ids
     */
    private function record(string $check, $ids): void
    {
        $this->results[] = [
            'check' => $check,
            'problems' => $ids->count(),
            'sample' => $ids->take(10)->values()->all(),
        ];
    }
}
