<?php

namespace App\Services\Payment;

use App\Enums\Currency;
use App\Models\Customer;
use App\Models\CustomerPayment;
use App\Models\Sale;
use App\Models\User;
use App\Support\CurrencyGuard;
use App\Support\PartyBalanceSync;
use App\Support\ProvinceScope;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class CustomerPaymentService
{
    /** Retries for the whole unit of work when the DBMS reports a deadlock. */
    private const DEADLOCK_RETRIES = 3;

    /**
     * @param  array{
     *     customer_id:int,
     *     location_id:int,
     *     user:User,
     *     amount:float|string,
     *     sale_id?:int|null,
     *     currency?:string|null,
     *     paid_at?:\DateTimeInterface|string|null,
     *     notes?:string|null
     * }  $data
     */
    public function create(array $data): CustomerPayment
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
                'You can only collect customer payments in your own province.'
            );

            $customer = Customer::query()
                ->whereKey($data['customer_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $sale = null;
            if (! empty($data['sale_id'])) {
                $sale = Sale::query()
                    ->whereKey($data['sale_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                if ((int) $sale->customer_id !== (int) $customer->id) {
                    throw new InvalidArgumentException('Sale does not belong to this customer.');
                }

                ProvinceScope::assertSameProvince(
                    $data['user'] ?? null,
                    (int) $sale->location_id,
                    'You can only collect payments for sales from your own province.'
                );

                if ((int) $sale->location_id !== $locationId) {
                    throw new InvalidArgumentException('Payment location must match the sale province.');
                }

                $saleRemaining = round((float) $sale->remaining_amount, 2);
                if ($amount > $saleRemaining) {
                    throw new InvalidArgumentException('Payment amount cannot exceed the sale remaining balance.');
                }
            }

            $currency = CurrencyGuard::normalize(
                $sale?->currency ?? ($data['currency'] ?? Currency::Afn->value)
            );

            if ($sale && CurrencyGuard::normalize((string) ($sale->currency ?: Currency::Afn->value)) !== $currency) {
                throw new InvalidArgumentException('Payment currency must match the sale currency.');
            }

            $openSales = $sale
                ? collect([$sale])
                : $this->openSalesForProvince($customer->id, $locationId, $currency);

            $provinceRemaining = round((float) $openSales->sum(fn (Sale $row) => (float) $row->remaining_amount), 2);
            if ($provinceRemaining <= 0) {
                throw new InvalidArgumentException(
                    'This customer has no remaining balance for sales in your province.'
                );
            }
            if ($amount > $provinceRemaining) {
                throw new InvalidArgumentException(
                    'Payment cannot exceed remaining sales balance for this province ('.$provinceRemaining.').'
                );
            }

            $balanceColumn = CurrencyGuard::partyBalanceColumn($currency);
            $balanceBefore = round((float) $customer->{$balanceColumn}, 2);

            if ($amount > $balanceBefore) {
                throw new InvalidArgumentException(
                    $currency === Currency::Usd->value
                        ? 'Payment amount cannot exceed customer USD balance.'
                        : 'Payment amount cannot exceed customer balance.'
                );
            }

            $balanceAfter = round($balanceBefore - $amount, 2);

            $payment = CustomerPayment::query()->create([
                'reference_no' => 'CPAY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'customer_id' => $customer->id,
                'location_id' => $locationId,
                'user_id' => $data['user']->id,
                'sale_id' => $sale?->id,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'paid_at' => $data['paid_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
                'currency' => $currency,
            ]);

            $this->applyToSales($openSales, $amount);
            PartyBalanceSync::rebuildCustomer((int) $customer->id);

            return $payment->load(['customer', 'location', 'user', 'sale']);
        }, attempts: self::DEADLOCK_RETRIES);
    }

    /**
     * @return Collection<int, Sale>
     */
    private function openSalesForProvince(int $customerId, int $locationId, string $currency): Collection
    {
        return Sale::query()
            ->where('customer_id', $customerId)
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
            ->orderBy('sold_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * @param  Collection<int, Sale>  $sales
     */
    private function applyToSales(Collection $sales, float $amount): void
    {
        $left = $amount;

        foreach ($sales as $sale) {
            if ($left <= 0) {
                break;
            }

            $apply = round(min($left, (float) $sale->remaining_amount), 2);
            if ($apply <= 0) {
                continue;
            }

            $sale->paid_amount = round((float) $sale->paid_amount + $apply, 2);
            $sale->remaining_amount = round((float) $sale->remaining_amount - $apply, 2);
            $sale->payment_type = $this->resolvePaymentType(
                (float) $sale->paid_amount,
                (float) $sale->remaining_amount
            );
            $sale->save();

            $left = round($left - $apply, 2);
        }
    }

    private function resolvePaymentType(float $paid, float $remaining): string
    {
        if ($remaining <= 0) {
            return 'cash';
        }
        if ($paid <= 0) {
            return 'credit';
        }

        return 'mixed';
    }
}
