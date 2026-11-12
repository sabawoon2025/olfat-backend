<?php

namespace App\Console\Commands;

use App\Enums\Currency;
use App\Models\Purchase;
use App\Models\Supplier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rebuild supplier balance / balance_usd from open purchase remainings so the
 * Suppliers menu Payable AFN/USD matches the Purchases menu Payable totals.
 */
class SyncSupplierPayablesCommand extends Command
{
    protected $signature = 'suppliers:sync-payables {--dry-run : Show mismatches without writing}';

    protected $description = 'Set each supplier balance from the sum of purchase remaining_amount by currency';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $updated = 0;

        Supplier::query()->orderBy('id')->each(function (Supplier $supplier) use ($dryRun, &$updated): void {
            $afn = round((float) Purchase::query()
                ->where('supplier_id', $supplier->id)
                ->where(function ($q) {
                    $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
                })
                ->sum('remaining_amount'), 2);

            $usd = round((float) Purchase::query()
                ->where('supplier_id', $supplier->id)
                ->where('currency', Currency::Usd->value)
                ->sum('remaining_amount'), 2);

            $currentAfn = round((float) $supplier->balance, 2);
            $currentUsd = round((float) $supplier->balance_usd, 2);

            if (abs($currentAfn - $afn) < 0.005 && abs($currentUsd - $usd) < 0.005) {
                return;
            }

            $this->line(sprintf(
                '#%d %s: AFN %s → %s, USD %s → %s',
                $supplier->id,
                $supplier->name,
                number_format($currentAfn, 2, '.', ''),
                number_format($afn, 2, '.', ''),
                number_format($currentUsd, 2, '.', ''),
                number_format($usd, 2, '.', '')
            ));

            if (! $dryRun) {
                DB::transaction(function () use ($supplier, $afn, $usd): void {
                    $locked = Supplier::query()->whereKey($supplier->id)->lockForUpdate()->firstOrFail();
                    $locked->balance = $afn;
                    $locked->balance_usd = $usd;
                    $locked->save();
                });
            }

            $updated++;
        });

        if ($updated === 0) {
            $this->components->info('Supplier payables already match purchase remainings.');
        } else {
            $this->components->info(
                $dryRun
                    ? "Would update {$updated} supplier(s). Re-run without --dry-run to apply."
                    : "Updated {$updated} supplier(s) from purchase remainings."
            );
        }

        return self::SUCCESS;
    }
}
