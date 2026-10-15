<?php

namespace App\Http\Resources\V1;

use App\Models\Sale;
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

        return [
            'id' => $this->id,
            'reference_no' => $this->reference_no,
            'date' => optional($this->sold_at)?->format('Y-m-d H:i'),
            'sold_at' => optional($this->sold_at)?->toIso8601String(),
            'status' => $this->status,
            'payment_type' => $this->payment_type,
            'notes' => $this->notes,

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
            'remaining_raw' => (float) $this->remaining_amount,

            'items' => SaleItemResource::collection(
                $this->whenLoaded('items', fn () => $this->items)
            ),
        ];
    }
}
