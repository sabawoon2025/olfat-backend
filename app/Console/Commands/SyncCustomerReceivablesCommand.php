<?php

namespace App\Console\Commands;

use App\Enums\Currency;
use App\Models\Customer;
use App\Models\Sale;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rebuild customer balance / balance_usd from open sale remainings so the
 * Customers menu Receivable AFN/USD matches the Sales menu Receivable totals.
 */
class SyncCustomerReceivablesCommand extends Command
{
    protected $signature = 'customers:sync-receivables {--dry-run : Show mismatches without writing}';

    protected $description = 'Set each customer balance from the sum of sale remaining_amount by currency';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $updated = 0;

        Customer::query()->orderBy('id')->each(function (Customer $customer) use ($dryRun, &$updated): void {
            $afn = round((float) Sale::query()
                ->where('customer_id', $customer->id)
                ->where(function ($q) {
                    $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
                })
                ->sum('remaining_amount'), 2);

            $usd = round((float) Sale::query()
                ->where('customer_id', $customer->id)
                ->where('currency', Currency::Usd->value)
                ->sum('remaining_amount'), 2);

            $currentAfn = round((float) $customer->balance, 2);
            $currentUsd = round((float) $customer->balance_usd, 2);

            if (abs($currentAfn - $afn) < 0.005 && abs($currentUsd - $usd) < 0.005) {
                return;
            }

            $this->line(sprintf(
                '#%d %s: AFN %s → %s, USD %s → %s',
                $customer->id,
                $customer->name,
                number_format($currentAfn, 2, '.', ''),
                number_format($afn, 2, '.', ''),
                number_format($currentUsd, 2, '.', ''),
                number_format($usd, 2, '.', '')
            ));

            if (! $dryRun) {
                DB::transaction(function () use ($customer, $afn, $usd): void {
                    $locked = Customer::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
                    $locked->balance = $afn;
                    $locked->balance_usd = $usd;
                    $locked->save();
                });
            }

            $updated++;
        });

        if ($updated === 0) {
            $this->components->info('Customer receivables already match sales remainings.');
        } else {
            $this->components->info(
                $dryRun
                    ? "Would update {$updated} customer(s). Re-run without --dry-run to apply."
                    : "Updated {$updated} customer(s) from sales remainings."
            );
        }

        return self::SUCCESS;
    }
}
