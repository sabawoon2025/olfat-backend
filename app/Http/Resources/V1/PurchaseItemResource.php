<?php

namespace App\Http\Resources\V1;

use App\Models\PurchaseItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PurchaseItem
 */
class PurchaseItemResource extends JsonResource
{
    /**
     * @return array{
     *     id:int,
     *     product_variant_id:int,
     *     product:?string,
     *     variant:?string,
     *     sku:?string,
     *     quantity:string,
     *     quantity_raw:float,
     *     returned_quantity:string,
     *     returned_quantity_raw:float,
     *     unit:?string,
     *     unit_price:string,
     *     unit_price_raw:float,
     *     line_total:string,
     *     line_total_raw:float
     * }
     */
    public function toArray(Request $request): array
    {
        $variant = $this->whenLoaded('variant');
        $product = $variant && $variant->relationLoaded('product') ? $variant->product : null;

        return [
            'id' => $this->id,
            'product_variant_id' => $this->product_variant_id,
            'product' => $product?->name,
            'variant' => $variant?->name,
            'sku' => $variant?->sku,
            'quantity' => (string) $this->quantity,
            'quantity_raw' => (float) $this->quantity,
            'returned_quantity' => (string) $this->returned_quantity,
            'returned_quantity_raw' => (float) $this->returned_quantity,
            'unit' => $this->unit,
            'unit_price' => (string) $this->unit_price,
            'unit_price_raw' => (float) $this->unit_price,
            'line_total' => (string) $this->line_total,
            'line_total_raw' => (float) $this->line_total,
        ];
    }
}
