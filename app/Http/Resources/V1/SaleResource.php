<?php

namespace App\Http\Resources\V1;

use App\Models\Sale;
use App\Support\PreviousUnpaid;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shape expected by the public/pages/bill.html invoice renderer.
 *
 * @mixin Sale
 */
class SaleResource extends JsonResource
{
    /**
     * @return array{
     *     id:int,
     *     reference_no:?string,
     *     date:?string,
     *     sold_at:?string,
     *     status:?string,
     *     payment_type:?string,
     *     notes:?string,
     *     customer_id:?int,
     *     customer:?string,
     *     customer_phone:?string,
     *     customer_address:?string,
     *     location_id:?int,
     *     location:?string,
     *     location_code:?string,
     *     invoice_profile:array<string, string>,
     *     user_id:?int,
     *     seller:?string,
     *     total:string,
     *     total_raw:float,
     *     paid:string,
     *     paid_raw:float,
     *     remaining:string,
     *     remaining_raw:float,
     *     items:array
     * }
     */
    public function toArray(Request $request): array
    {
        $customer = $this->whenLoaded('customer');
        $location = $this->whenLoaded('location');
        $seller = $this->whenLoaded('user');
        $previous = PreviousUnpaid::forSale($this->resource);
        $remaining = round((float) $this->remaining_amount, 2);
        $currency = $this->currency ?: 'AFN';
        $isUsd = strtoupper((string) $currency) === 'USD';
        $outstandingAfn = round($previous['afn'] + ($isUsd ? 0.0 : $remaining), 2);
        $outstandingUsd = round($previous['usd'] + ($isUsd ? $remaining : 0.0), 2);
        $totalOutstanding = $isUsd ? $outstandingUsd : $outstandingAfn;

        return [
            'id' => $this->id,
            'kind' => 'sale',
            'reference_no' => $this->reference_no,
            'date' => optional($this->sold_at)?->format('Y-m-d H:i'),
            'sold_at' => optional($this->sold_at)?->toIso8601String(),
            'status' => $this->status,
            'payment_type' => $this->payment_type,
            'notes' => $this->notes,
            'currency' => $currency,

            'customer_id' => $this->customer_id,
            'customer' => $customer?->name,
            'customer_phone' => $customer?->phone,
            'customer_address' => $customer?->address,

            'location_id' => $this->location_id,
            'location' => $location?->name,
            'location_code' => $location?->code,
            'invoice_profile' => $location
                ? $location->compactInvoiceProfile()
                : [],

            'user_id' => $this->user_id,
            'seller' => $seller?->name,

            'total' => (string) $this->total_amount,
            'total_raw' => (float) $this->total_amount,
            'paid' => (string) $this->paid_amount,
            'paid_raw' => (float) $this->paid_amount,
            'remaining' => (string) $this->remaining_amount,
            'remaining_raw' => $remaining,
            'previous_unpaid' => number_format($previous['matching'], 2, '.', ''),
            'previous_unpaid_raw' => $previous['matching'],
            'previous_unpaid_afn' => number_format($previous['afn'], 2, '.', ''),
            'previous_unpaid_afn_raw' => $previous['afn'],
            'previous_unpaid_usd' => number_format($previous['usd'], 2, '.', ''),
            'previous_unpaid_usd_raw' => $previous['usd'],
            'total_outstanding' => number_format($totalOutstanding, 2, '.', ''),
            'total_outstanding_raw' => $totalOutstanding,
            'total_outstanding_afn' => number_format($outstandingAfn, 2, '.', ''),
            'total_outstanding_afn_raw' => $outstandingAfn,
            'total_outstanding_usd' => number_format($outstandingUsd, 2, '.', ''),
            'total_outstanding_usd_raw' => $outstandingUsd,

            'items' => SaleItemResource::collection(
                $this->whenLoaded('items', fn () => $this->items)
            ),
        ];
    }
}
