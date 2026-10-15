<?php

namespace App\Services\Payment;

use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
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

                $purchaseRemaining = round((float) $purchase->remaining_amount, 2);
                if ($amount > $purchaseRemaining) {
                    throw new InvalidArgumentException('Payment amount cannot exceed the purchase remaining balance.');
                }
            }

            $balanceBefore = round((float) $supplier->balance, 2);

            if ($amount > $balanceBefore) {
                throw new InvalidArgumentException('Payment amount cannot exceed supplier balance.');
            }

            $balanceAfter = round($balanceBefore - $amount, 2);

            $payment = SupplierPayment::query()->create([
                'reference_no' => 'SPAY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'supplier_id' => $supplier->id,
                'location_id' => $data['location_id'],
                'user_id' => $data['user']->id,
                'purchase_id' => $purchase?->id,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'paid_at' => $data['paid_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
            ]);

            $supplier->balance = $balanceAfter;
            $supplier->save();

            if ($purchase) {
                $purchase->paid_amount = round((float) $purchase->paid_amount + $amount, 2);
                $purchase->remaining_amount = round((float) $purchase->remaining_amount - $amount, 2);
                $purchase->save();
            }

            return $payment->load(['supplier', 'location', 'user', 'purchase']);
        }, attempts: self::DEADLOCK_RETRIES);
    }
}
