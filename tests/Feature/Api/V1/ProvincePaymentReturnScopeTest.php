<?php

namespace Tests\Feature\Api\V1;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProvincePaymentReturnScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_cannot_return_sale_from_another_province(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni']);
        $kabulUser = User::factory()->create(['location_id' => $kabul->id]);
        $ghazniUser = User::factory()->create(['location_id' => $ghazni->id]);

        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $kabul->id, $kabulUser, 20);

        Sanctum::actingAs($kabulUser);
        $sale = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 25],
            ],
        ])->assertCreated()->json('data');

        Sanctum::actingAs($ghazniUser);
        $this->postJson('/api/v1/sales-returns', [
            'sale_id' => $sale['id'],
            'location_id' => $ghazni->id,
            'items' => [
                ['sale_item_id' => $sale['items'][0]['id'], 'quantity' => 1],
            ],
        ])->assertStatus(422);
    }

    public function test_user_cannot_pay_customer_balance_from_another_province_sale(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni']);
        $kabulUser = User::factory()->create(['location_id' => $kabul->id]);
        $ghazniUser = User::factory()->create(['location_id' => $ghazni->id]);
        $customer = Customer::factory()->create();

        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $kabul->id, $kabulUser, 20);

        Sanctum::actingAs($kabulUser);
        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 25],
            ],
        ])->assertCreated();

        Sanctum::actingAs($ghazniUser);
        $this->postJson('/api/v1/customer-payments', [
            'customer_id' => $customer->id,
            'location_id' => $ghazni->id,
            'amount' => 20,
        ])->assertStatus(422);
    }

    public function test_user_can_pay_customer_balance_in_same_province(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $user = User::factory()->create(['location_id' => $kabul->id]);
        $customer = Customer::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $kabul->id, $user, 20);

        Sanctum::actingAs($user);
        $sale = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 25],
            ],
        ])->assertCreated()->json('data');

        $this->postJson('/api/v1/customer-payments', [
            'customer_id' => $customer->id,
            'location_id' => $kabul->id,
            'sale_id' => $sale['id'],
            'amount' => 20,
        ])
            ->assertCreated()
            ->assertJsonPath('data.location_id', $kabul->id)
            ->assertJsonPath('data.sale_id', $sale['id']);

        $this->assertSame('30.00', (string) $customer->fresh()->balance);
    }

    public function test_user_cannot_pay_supplier_balance_from_another_province_purchase(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $maidan = Location::factory()->create(['name' => 'Maidan/Wardak']);
        $kabulUser = User::factory()->create(['location_id' => $kabul->id]);
        $maidanUser = User::factory()->create(['location_id' => $maidan->id]);
        $supplier = Supplier::factory()->create();
        $variant = ProductVariant::factory()->create();

        Sanctum::actingAs($kabulUser);
        $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5, 'unit_price' => 10],
            ],
        ])->assertCreated();

        Sanctum::actingAs($maidanUser);
        $this->postJson('/api/v1/supplier-payments', [
            'supplier_id' => $supplier->id,
            'location_id' => $maidan->id,
            'amount' => 20,
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
        ]);
    }
}
