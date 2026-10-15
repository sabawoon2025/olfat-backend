<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ProductModule;
use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaleProductFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_sales_index_can_filter_by_product_id(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $customer = Customer::factory()->create();

        $tea = Product::factory()->create(['module' => ProductModule::Tea, 'name' => 'Green Tea']);
        $rice = Product::factory()->create(['module' => ProductModule::Rice, 'name' => 'Basmati']);
        $teaVariant = ProductVariant::factory()->create(['product_id' => $tea->id]);
        $riceVariant = ProductVariant::factory()->create(['product_id' => $rice->id]);

        $this->seedStock($teaVariant->id, $location->id, $user, 20);
        $this->seedStock($riceVariant->id, $location->id, $user, 20);

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $teaVariant->id, 'quantity' => 1, 'unit_price' => 10],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $riceVariant->id, 'quantity' => 1, 'unit_price' => 20],
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/v1/sales?product_id='.$tea->id);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 1);

        $sale = $response->json('data.data.0');
        $this->assertSame($teaVariant->id, (int) data_get($sale, 'items.0.product_variant_id'));
    }

    public function test_purchases_index_can_filter_by_product_id(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $product = Product::factory()->create(['module' => ProductModule::Detergent]);
        $variant = ProductVariant::factory()->create(['product_id' => $product->id]);
        $other = ProductVariant::factory()->create();

        $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 4, 'unit_price' => 5],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $other->id, 'quantity' => 2, 'unit_price' => 8],
            ],
        ])->assertCreated();

        $this->getJson('/api/v1/purchases?product_id='.$product->id)
            ->assertOk()
            ->assertJsonPath('data.total', 1);
    }

    private function seedStock(int $variantId, int $locationId, User $user, float $quantity): void
    {
        app(StockService::class)->apply([
            'product_variant_id' => $variantId,
            'location_id' => $locationId,
            'type' => StockMovementType::Purchase,
            'quantity_change' => $quantity,
            'unit' => 'unit',
            'user' => $user,
            'notes' => 'Test seed',
            'allow_negative' => false,
        ]);
    }
}
