<?php

namespace App\Services\Sale;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class SaleService
{
    /** Retries for the whole unit of work when the DBMS reports a deadlock. */
    private const DEADLOCK_RETRIES = 3;

    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     customer_id:int,
     *     location_id:int,
     *     user:User,
     *     sold_at?:\DateTimeInterface|string|null,
     *     paid_amount?:float|string|null,
     *     notes?:string|null,
     *     items:list<array{product_variant_id:int, quantity:float|string, unit?:string|null, unit_price:float|string}>
     * }  $data
     */
    public function create(array $data): Sale
    {
        if (empty($data['items'])) {
            throw new InvalidArgumentException('A sale must include at least one item.');
        }

        return DB::transaction(function () use ($data) {
            $paidAmount = round((float) ($data['paid_amount'] ?? 0), 2);
            if ($paidAmount < 0) {
                throw new InvalidArgumentException('paid_amount cannot be negative.');
            }

            $totalAmount = 0.0;
            $normalizedItems = [];

            foreach ($data['items'] as $item) {
                $variant = ProductVariant::query()->with('product')->findOrFail($item['product_variant_id']);
                if ($variant->product && $variant->product->is_active === false) {
                    throw new InvalidArgumentException(
                        'Cannot sell inactive product: '.($variant->product->name ?: '#'.$variant->product_id)
                    );
                }
                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                if ($quantity <= 0) {
                    throw new InvalidArgumentException('Item quantity must be greater than zero.');
                }
                if ($unitPrice < 0) {
                    throw new InvalidArgumentException('Item unit_price cannot be negative.');
                }

                $lineTotal = round($quantity * $unitPrice, 2);
                $totalAmount += $lineTotal;

                $normalizedItems[] = [
                    'product_variant_id' => $variant->id,
                    'quantity' => $quantity,
                    'unit' => $item['unit'] ?? $variant->base_unit,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            $totalAmount = round($totalAmount, 2);
            if ($paidAmount > $totalAmount) {
                throw new InvalidArgumentException('paid_amount cannot exceed total_amount.');
            }

            $remainingAmount = round($totalAmount - $paidAmount, 2);
            $paymentType = $this->resolvePaymentType($paidAmount, $remainingAmount, $totalAmount);

            $sale = Sale::query()->create([
                'reference_no' => $this->nextReference(),
                'customer_id' => $data['customer_id'],
                'location_id' => $data['location_id'],
                'user_id' => $data['user']->id,
                'sold_at' => $data['sold_at'] ?? now(),
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_type' => $paymentType,
                'status' => 'posted',
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($normalizedItems as $item) {
                /** @var SaleItem $saleItem */
                $saleItem = $sale->items()->create($item);

                $this->stockService->apply([
                    'product_variant_id' => $saleItem->product_variant_id,
                    'location_id' => $sale->location_id,
                    'type' => StockMovementType::Sale,
                    'quantity_change' => -1 * (float) $saleItem->quantity,
                    'unit' => $saleItem->unit,
                    'quantity_in_unit' => (float) $saleItem->quantity,
                    'user' => $data['user'],
                    'notes' => 'Sale '.$sale->reference_no,
                    'occurred_at' => $sale->sold_at,
                    'reference_type' => Sale::class,
                    'reference_id' => $sale->id,
                    'allow_negative' => false,
                ]);
            }

            if ($remainingAmount > 0) {
                $customer = Customer::query()
                    ->whereKey($sale->customer_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $customer->balance = round((float) $customer->balance + $remainingAmount, 2);
                $customer->save();
            }

            return $sale->load(['items.variant.product', 'customer', 'location', 'user']);
        }, attempts: self::DEADLOCK_RETRIES);
    }

    private function resolvePaymentType(float $paid, float $remaining, float $total): string
    {
        if ($remaining <= 0) {
            return 'cash';
        }
        if ($paid <= 0) {
            return 'credit';
        }

        return 'mixed';
    }

    private function nextReference(): string
    {
        return 'SAL-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
