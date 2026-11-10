<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ProductModule;
use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerReceivableSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_usd_sales_return_reduces_balance_usd_not_afn(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['balance' => 0, 'balance_usd' => 0]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Tea])
        )->create();

        $this->seedStock($variant->id, $location->id, $user, 20);

        $sale = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                    'unit_price' => 50,
                ],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('0.00', (string) $customer->fresh()->balance);
        $this->assertSame('100.00', (string) $customer->fresh()->balance_usd);

        $this->postJson('/api/v1/sales-returns', [
            'sale_id' => $sale['id'],
            'items' => [
                [
                    'sale_item_id' => $sale['items'][0]['id'],
                    'quantity' => 1,
                ],
            ],
        ])->assertCreated();

        $customer->refresh();
        $this->assertSame('0.00', (string) $customer->balance);
        $this->assertSame('50.00', (string) $customer->balance_usd);
        $this->assertSame('50.00', (string) Sale::query()->findOrFail($sale['id'])->remaining_amount);
    }

    public function test_sync_command_aligns_customer_balances_with_sales_remainings(): void
    {
        $customer = Customer::factory()->create(['balance' => 10, 'balance_usd' => 5]);
        $location = Location::factory()->create();
        $user = User::factory()->create();

        Sale::query()->create([
            'reference_no' => 'INV-TEST-0001',
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'user_id' => $user->id,
            'sold_at' => now(),
            'total_amount' => 1000,
            'paid_amount' => 0,
            'remaining_amount' => 1000,
            'payment_type' => 'credit',
            'status' => 'posted',
            'currency' => 'AFN',
        ]);

        Sale::query()->create([
            'reference_no' => 'INV-TEST-0002',
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'user_id' => $user->id,
            'sold_at' => now(),
            'total_amount' => 50,
            'paid_amount' => 0,
            'remaining_amount' => 50,
            'payment_type' => 'credit',
            'status' => 'posted',
            'currency' => 'USD',
        ]);

        $this->artisan('customers:sync-receivables')
            ->assertSuccessful();

        $customer->refresh();
        $this->assertSame('1000.00', (string) $customer->balance);
        $this->assertSame('50.00', (string) $customer->balance_usd);
    }

    private function seedStock(int $variantId, int $locationId, User $user, float $qty): void
    {
        app(StockService::class)->apply([
            'product_variant_id' => $variantId,
            'location_id' => $locationId,
            'type' => StockMovementType::Adjustment,
            'quantity_change' => $qty,
            'user' => $user,
            'notes' => 'test seed',
        ]);
    }
}
