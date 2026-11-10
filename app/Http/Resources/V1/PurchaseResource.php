<?php

namespace App\Http\Resources\V1;

use App\Models\Purchase;
use App\Support\PreviousUnpaid;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shape expected by the public/pages/bill.html invoice renderer for purchases.
 *
 * @mixin Purchase
 */
class PurchaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $supplier = $this->whenLoaded('supplier');
        $location = $this->whenLoaded('location');
        $buyer = $this->whenLoaded('user');
        $previous = PreviousUnpaid::forPurchase($this->resource);
        $remaining = round((float) $this->remaining_amount, 2);
        $currency = $this->currency ?: 'AFN';
        $isUsd = strtoupper((string) $currency) === 'USD';
        $outstandingAfn = round($previous['afn'] + ($isUsd ? 0.0 : $remaining), 2);
        $outstandingUsd = round($previous['usd'] + ($isUsd ? $remaining : 0.0), 2);
        $totalOutstanding = $isUsd ? $outstandingUsd : $outstandingAfn;

        return [
            'id' => $this->id,
            'kind' => 'purchase',
            'reference_no' => $this->reference_no,
            'date' => optional($this->purchased_at)?->format('Y-m-d H:i'),
            'purchased_at' => optional($this->purchased_at)?->toIso8601String(),
            'status' => $this->status,
            'payment_type' => $remaining <= 0
                ? 'cash'
                : ((float) $this->paid_amount <= 0 ? 'credit' : 'mixed'),
            'notes' => $this->notes,
            'currency' => $currency,

            'supplier_id' => $this->supplier_id,
            'supplier' => $supplier?->name,
            'supplier_phone' => $supplier?->phone,
            'supplier_address' => $supplier?->address,

            // Aliases so bill.html / bill-page.js can reuse the sale invoice UI.
            'customer_id' => $this->supplier_id,
            'customer' => $supplier?->name,
            'customer_phone' => $supplier?->phone,
            'customer_address' => $supplier?->address,

            'location_id' => $this->location_id,
            'location' => $location?->name,
            'location_code' => $location?->code,
            'invoice_profile' => $location
                ? $location->compactInvoiceProfile()
                : [],

            'user_id' => $this->user_id,
            'user' => $buyer?->name,
            'seller' => $buyer?->name,

            'total' => (string) $this->total_amount,
            'total_raw' => (float) $this->total_amount,
            'total_amount' => (string) $this->total_amount,
            'paid' => (string) $this->paid_amount,
            'paid_raw' => (float) $this->paid_amount,
            'paid_amount' => (string) $this->paid_amount,
            'remaining' => (string) $this->remaining_amount,
            'remaining_raw' => $remaining,
            'remaining_amount' => (string) $this->remaining_amount,
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

            'items' => PurchaseItemResource::collection(
                $this->whenLoaded('items', fn () => $this->items)
            ),
        ];
    }
}
