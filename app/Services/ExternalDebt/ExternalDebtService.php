<?php

namespace App\Services\ExternalDebt;

use App\Enums\ExternalDebtDirection;
use App\Models\ExternalDebt;
use App\Models\ExternalDebtPayment;
use App\Models\User;
use App\Support\CurrencyGuard;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ExternalDebtService
{
    /**
     * @param  array{
     *     external_party_id:int,
     *     direction:string,
     *     reason:string,
     *     original_amount:float|string,
     *     paid_amount?:float|string|null,
     *     location_id:int,
     *     user:User,
     *     opened_at?:\DateTimeInterface|string|null,
     *     notes?:string|null,
     *     currency?:string|null
     * }  $data
     */
    public function create(array $data): ExternalDebt
    {
        $original = round((float) $data['original_amount'], 2);
        $paid = round((float) ($data['paid_amount'] ?? 0), 2);
        $currency = CurrencyGuard::normalize($data['currency'] ?? null);

        if ($original <= 0) {
            throw new InvalidArgumentException('original_amount must be greater than zero.');
        }
        if ($paid < 0) {
            throw new InvalidArgumentException('paid_amount cannot be negative.');
        }
        if ($paid > $original) {
            throw new InvalidArgumentException('paid_amount cannot exceed original_amount.');
        }

        $direction = ExternalDebtDirection::from($data['direction']);
        $remaining = round($original - $paid, 2);

        return ExternalDebt::query()->create([
            'reference_no' => 'XDBT-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'external_party_id' => $data['external_party_id'],
            'direction' => $direction,
            'reason' => $data['reason'],
            'original_amount' => $original,
            'paid_amount' => $paid,
            'remaining_amount' => $remaining,
            'location_id' => $data['location_id'],
            'user_id' => $data['user']->id,
            'opened_at' => $data['opened_at'] ?? now(),
            'notes' => $data['notes'] ?? null,
            'status' => $remaining <= 0 ? 'closed' : 'open',
            'currency' => $currency,
        ])->load(['party', 'location', 'user']);
    }

    /**
     * @param  array{
     *     external_debt_id:int,
     *     location_id:int,
     *     user:User,
     *     amount:float|string,
     *     paid_at?:\DateTimeInterface|string|null,
     *     notes?:string|null
     * }  $data
     */
    public function recordPayment(array $data): ExternalDebtPayment
    {
        $amount = round((float) $data['amount'], 2);
        if ($amount <= 0) {
            throw new InvalidArgumentException('Payment amount must be greater than zero.');
        }

        return DB::transaction(function () use ($data, $amount) {
            $debt = ExternalDebt::query()
                ->whereKey($data['external_debt_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $remainingBefore = round((float) $debt->remaining_amount, 2);
            if ($amount > $remainingBefore) {
                throw new InvalidArgumentException('Payment amount cannot exceed remaining debt.');
            }

            $remainingAfter = round($remainingBefore - $amount, 2);

            $payment = ExternalDebtPayment::query()->create([
                'reference_no' => 'XPAY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'external_debt_id' => $debt->id,
                'location_id' => $data['location_id'],
                'user_id' => $data['user']->id,
                'amount' => $amount,
                'remaining_before' => $remainingBefore,
                'remaining_after' => $remainingAfter,
                'paid_at' => $data['paid_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
            ]);

            $debt->paid_amount = round((float) $debt->paid_amount + $amount, 2);
            $debt->remaining_amount = $remainingAfter;
            $debt->status = $remainingAfter <= 0 ? 'closed' : 'open';
            $debt->save();

            return $payment->load(['debt.party', 'location', 'user']);
        });
    }
}
