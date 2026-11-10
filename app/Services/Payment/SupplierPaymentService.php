<?php

namespace App\Services\Payment;

use App\Enums\Currency;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Support\CurrencyGuard;
use App\Support\ProvinceScope;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class SupplierPaymentService
{
    /** Retries for the whole unit of work when the DBMS reports a deadlock. */
    private const DEADLOCK_RETRIES = 3;

    /**
     * @param  array{
     *     supplier_id:int,
     *     location_id:int,
     *     user:User,
     *     amount:float|string,
     *     purchase_id?:int|null,
     *     currency?:string|null,
     *     paid_at?:\DateTimeInterface|string|null,
     *     notes?:string|null
     * }  $data
     */
    public function create(array $data): SupplierPayment
    {
        $amount = round((float) $data['amount'], 2);
        if ($amount <= 0) {
            throw new InvalidArgumentException('Payment amount must be greater than zero.');
        }

        return DB::transaction(function () use ($data, $amount) {
            $locationId = (int) $data['location_id'];

            ProvinceScope::assertSameProvince(
                $data['user'] ?? null,
                $locationId,
                'You can only pay suppliers in your own province.'
            );

            $supplier = Supplier::query()
                ->whereKey($data['supplier_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $purchase = null;
            if (! empty($data['purchase_id'])) {
                $purchase = Purchase::query()
                    ->whereKey($data['purchase_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ((int) $purchase->supplier_id !== (int) $supplier->id) {
                    throw new InvalidArgumentException('Purchase does not belong to this supplier.');
                }

                ProvinceScope::assertSameProvince(
                    $data['user'] ?? null,
                    (int) $purchase->location_id,
                    'You can only pay for purchases from your own province.'
                );

                if ((int) $purchase->location_id !== $locationId) {
                    throw new InvalidArgumentException('Payment location must match the purchase province.');
                }

                $purchaseRemaining = round((float) $purchase->remaining_amount, 2);
                if ($amount > $purchaseRemaining) {
                    throw new InvalidArgumentException('Payment amount cannot exceed the purchase remaining balance.');
                }
            }

            $currency = CurrencyGuard::normalize(
                $purchase?->currency ?? ($data['currency'] ?? Currency::Afn->value)
            );

            if ($purchase && CurrencyGuard::normalize((string) ($purchase->currency ?: Currency::Afn->value)) !== $currency) {
                throw new InvalidArgumentException('Payment currency must match the purchase currency.');
            }

            $openPurchases = $purchase
                ? collect([$purchase])
                : $this->openPurchasesForProvince($supplier->id, $locationId, $currency);

            $provinceRemaining = round((float) $openPurchases->sum(fn (Purchase $row) => (float) $row->remaining_amount), 2);
            if ($provinceRemaining <= 0) {
                throw new InvalidArgumentException(
                    'This supplier has no remaining balance for purchases in your province.'
                );
            }
            if ($amount > $provinceRemaining) {
                throw new InvalidArgumentException(
                    'Payment cannot exceed remaining purchase balance for this province ('.$provinceRemaining.').'
                );
            }

            $balanceColumn = CurrencyGuard::partyBalanceColumn($currency);
            $balanceBefore = round((float) $supplier->{$balanceColumn}, 2);

            if ($amount > $balanceBefore) {
                throw new InvalidArgumentException(
                    $currency === Currency::Usd->value
                        ? 'Payment amount cannot exceed supplier USD balance.'
                        : 'Payment amount cannot exceed supplier balance.'
                );
            }

            $balanceAfter = round($balanceBefore - $amount, 2);

            $payment = SupplierPayment::query()->create([
                'reference_no' => 'SPAY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'supplier_id' => $supplier->id,
                'location_id' => $locationId,
                'user_id' => $data['user']->id,
                'purchase_id' => $purchase?->id,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'paid_at' => $data['paid_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
                'currency' => $currency,
            ]);

            $supplier->{$balanceColumn} = $balanceAfter;
            $supplier->save();

            $this->applyToPurchases($openPurchases, $amount);

            return $payment->load(['supplier', 'location', 'user', 'purchase']);
        }, attempts: self::DEADLOCK_RETRIES);
    }

    /**
     * @return Collection<int, Purchase>
     */
    private function openPurchasesForProvince(int $supplierId, int $locationId, string $currency): Collection
    {
        return Purchase::query()
            ->where('supplier_id', $supplierId)
            ->where('location_id', $locationId)
            ->where('remaining_amount', '>', 0)
            ->where(function ($q) use ($currency) {
                if ($currency === Currency::Usd->value) {
                    $q->where('currency', Currency::Usd->value);
                } else {
                    $q->where(function ($inner) {
                        $inner->where('currency', Currency::Afn->value)->orWhereNull('currency');
                    });
                }
            })
            ->orderBy('purchased_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * @param  Collection<int, Purchase>  $purchases
     */
    private function applyToPurchases(Collection $purchases, float $amount): void
    {
        $left = $amount;

        foreach ($purchases as $purchase) {
            if ($left <= 0) {
                break;
            }

            $apply = round(min($left, (float) $purchase->remaining_amount), 2);
            if ($apply <= 0) {
                continue;
            }

            $purchase->paid_amount = round((float) $purchase->paid_amount + $apply, 2);
            $purchase->remaining_amount = round((float) $purchase->remaining_amount - $apply, 2);
            $purchase->save();

            $left = round($left - $apply, 2);
        }
    }
}
