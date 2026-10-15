<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ProductModule;
use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockBalance;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CriticalLedgerFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_sale_return_payments_update_stock_balances_pl_and_dashboard(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create(['name' => 'Kabul']);
        $supplier = Supplier::factory()->create(['balance' => 0]);
        $customer = Customer::factory()->create(['balance' => 0]);
        $product = Product::factory()->create([
            'module' => ProductModule::Tea,
            'name' => 'Green Tea',
            'is_active' => true,
        ]);
        $variant = ProductVariant::factory()->create([
            'product_id' => $product->id,
            'base_unit' => 'kg',
        ]);

        // Purchase 20kg @ 10 = 200, pay 50 → supplier payable 150, stock 20
        $purchase = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 50,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 20, 'unit_price' => 10],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame(20.0, (float) StockBalance::query()->first()->quantity);
        $this->assertSame('150.00', $supplier->fresh()->balance);

        // Supplier payment 60 against that purchase → payable 90, purchase remaining 90
        $this->postJson('/api/v1/supplier-payments', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'purchase_id' => $purchase['id'],
            'amount' => 60,
        ])->assertCreated();

        $this->assertSame('90.00', $supplier->fresh()->balance);
        $this->assertEqualsWithDelta(90.0, (float) data_get(
            $this->getJson('/api/v1/purchases/'.$purchase['id'])->json('data'),
            'remaining_amount'
        ), 0.001);

        // Sale 8kg @ 25 = 200, pay 50 → receivable 150, stock 12
        $sale = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 50,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 8, 'unit_price' => 25],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame(12.0, (float) StockBalance::query()->first()->quantity);
        $this->assertSame('150.00', $customer->fresh()->balance);

        // Customer payment 40 → receivable 110
        $this->postJson('/api/v1/customer-payments', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'sale_id' => $sale['id'],
            'amount' => 40,
        ])->assertCreated();

        $this->assertSame('110.00', $customer->fresh()->balance);

        // Sales return 2kg @ 25 = 50 → stock 14, reverse receivable first (remaining was 110 on sale after payment?)
        // Sale after create: total 200, paid 50, remaining 150, customer +150
        // After customer payment 40 on sale: paid 90, remaining 110, customer 110
        // Return 50: fromRemaining=50, customer 60, stock 14, sale remaining 60
        $this->postJson('/api/v1/sales-returns', [
            'sale_id' => $sale['id'],
            'items' => [
                ['sale_item_id' => $sale['items'][0]['id'], 'quantity' => 2],
            ],
        ])->assertCreated();

        $this->assertSame(14.0, (float) StockBalance::query()->first()->quantity);
        $this->assertSame('60.00', $customer->fresh()->balance);

        // Damage 1kg → stock 13
        $this->postJson('/api/v1/damaged-stocks', [
            'product_variant_id' => $variant->id,
            'location_id' => $location->id,
            'quantity' => 1,
            'reason' => 'Wet bags',
        ])->assertCreated();

        $this->assertSame(13.0, (float) StockBalance::query()->first()->quantity);

        // P&L: gross 8@25=200, returns 2@25=50, net 6@25=150; WA cost=10; COGS=60; gross profit=90
        $pl = $this->getJson('/api/v1/reports/profit-loss?location_id='.$location->id)
            ->assertOk()
            ->json('data');

        $this->assertTrue($pl['available']);
        $this->assertSame(200.0, (float) $pl['summary']['gross_sales']);
        $this->assertSame(50.0, (float) $pl['summary']['returns_amount']);
        $this->assertSame(150.0, (float) $pl['summary']['revenue']);
        $this->assertSame(60.0, (float) $pl['summary']['cost']);
        $this->assertSame(90.0, (float) $pl['summary']['gross_profit']);
        $this->assertSame(90.0, (float) $pl['summary']['net_profit']);

        $dashboard = $this->getJson('/api/v1/dashboard?location_id='.$location->id)
            ->assertOk()
            ->json('data');

        $this->assertSame(13.0, (float) $dashboard['stock_quantity']);
        $this->assertSame(60.0, (float) $dashboard['receivables']['customers_total']);
        $this->assertSame(90.0, (float) $dashboard['payables']['suppliers_total']);
        $this->assertTrue($dashboard['profit_loss']['available']);
        $this->assertSame(90.0, (float) $dashboard['profit_loss']['net_profit']);
        $this->assertNotEmpty($dashboard['recent_sales']);
        $this->assertNotEmpty($dashboard['recent_purchases']);
    }

    public function test_cannot_sell_or_purchase_inactive_product(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $product = Product::factory()->create([
            'module' => ProductModule::Rice,
            'is_active' => false,
        ]);
        $variant = ProductVariant::factory()->create(['product_id' => $product->id]);

        $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 10],
            ],
        ])->assertStatus(422);

        $this->seedStock($variant->id, $location->id, $user, 5);

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 12],
            ],
        ])->assertStatus(422);
    }

    private function seedStock(int $variantId, int $locationId, User $user, float $qty): void
    {
        app(StockService::class)->apply([
            'product_variant_id' => $variantId,
            'location_id' => $locationId,
            'type' => StockMovementType::Adjustment,
            'quantity_change' => $qty,
            'user' => $user,
            'allow_negative' => true,
        ]);
    }
}
