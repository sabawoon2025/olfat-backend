<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ExternalDebtDirection;
use App\Enums\ProductModule;
use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\ExternalParty;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiCurrencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_tea_usd_sale_updates_balance_usd_only(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['balance' => 0, 'balance_usd' => 0]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Tea])
        )->create();

        $this->seedStock($variant->id, $location->id, $user, 20);

        $response = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 10,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                    'unit_price' => 50,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.total_amount', '100.00')
            ->assertJsonPath('data.remaining_amount', '90.00');

        $customer->refresh();
        $this->assertSame('0.00', (string) $customer->balance);
        $this->assertSame('90.00', (string) $customer->balance_usd);
    }

    public function test_non_tea_usd_sale_is_rejected(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create();
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Rice])
        )->create();

        $this->seedStock($variant->id, $location->id, $user, 10);

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 1,
                    'unit_price' => 20,
                ],
            ],
        ])->assertStatus(422);

        $this->assertSame('0.00', (string) $customer->fresh()->balance);
        $this->assertSame('0.00', (string) $customer->fresh()->balance_usd);
    }

    public function test_mixed_tea_and_rice_usd_sale_is_rejected(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create();
        $location = Location::factory()->create();
        $tea = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Tea])
        )->create();
        $rice = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Rice])
        )->create();

        $this->seedStock($tea->id, $location->id, $user, 10);
        $this->seedStock($rice->id, $location->id, $user, 10);

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $tea->id,
                    'quantity' => 1,
                    'unit_price' => 20,
                ],
                [
                    'product_variant_id' => $rice->id,
                    'quantity' => 1,
                    'unit_price' => 15,
                ],
            ],
        ])->assertStatus(422);
    }

    public function test_external_debt_usd_create_pay_and_dashboard_split(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $party = ExternalParty::factory()->create();
        $location = Location::factory()->create();

        $debt = $this->postJson('/api/v1/external-debts', [
            'external_party_id' => $party->id,
            'direction' => ExternalDebtDirection::PersonOwes->value,
            'reason' => 'Tea advance',
            'original_amount' => 200,
            'paid_amount' => 0,
            'location_id' => $location->id,
            'currency' => 'USD',
        ])->assertCreated();

        $this->assertSame('USD', $debt->json('data.currency'));
        $this->assertSame('200.00', $debt->json('data.remaining_amount'));

        $debtId = $debt->json('data.id');
        $this->postJson('/api/v1/external-debts/'.$debtId.'/payments', [
            'location_id' => $location->id,
            'amount' => 50,
        ])->assertCreated()
            ->assertJsonPath('data.remaining_after', '150.00');

        $this->getJson('/api/v1/external-debts/'.$debtId)
            ->assertOk()
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.remaining_amount', '150.00');

        $this->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.receivables.external_person_owes_usd', 150)
            ->assertJsonPath('data.receivables.external_person_owes', 0);
    }

    public function test_dashboard_keeps_tea_usd_sales_separate_from_afn(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $tea = ProductVariant::factory()->for(
            Product::factory()->state(['module' => ProductModule::Tea])
        )->create();

        $this->seedStock($tea->id, $location->id, $user, 20);

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'currency' => 'AFN',
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $tea->id, 'quantity' => 1, 'unit_price' => 40],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $tea->id, 'quantity' => 1, 'unit_price' => 25],
            ],
        ])->assertCreated();

        $dashboard = $this->getJson('/api/v1/dashboard?location_id='.$location->id)
            ->assertOk()
            ->assertJsonPath('data.today.sales_total', 40)
            ->assertJsonPath('data.today.sales_total_usd', 25)
            ->assertJsonPath('data.receivables.customers_total', 40)
            ->assertJsonPath('data.receivables.customers_total_usd', 25)
            ->json('data');

        $province = collect($dashboard['by_location'])->firstWhere('location_id', $location->id);
        $this->assertNotNull($province);
        $this->assertSame(40.0, (float) $province['sales_total']);
        $this->assertSame(25.0, (float) $province['sales_total_usd']);
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
