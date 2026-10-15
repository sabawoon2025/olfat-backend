<?php

namespace Tests\Feature\Api\V1;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Worker;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardAndReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_returns_summary_payload(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 3);

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 50],
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/v1/dashboard?location_id='.$location->id);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.today.sales_count', 1)
            ->assertJsonPath('data.today.sales_total', 50)
            ->assertJsonPath('data.profit_loss.available', true)
            ->assertJsonStructure([
                'data' => [
                    'today',
                    'receivables',
                    'payables',
                    'stock_warnings',
                    'recent_sales',
                    'recent_purchases',
                    'profit_loss',
                    'by_location',
                ],
            ]);
    }

    public function test_dashboard_includes_province_breakdowns(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $kabul = Location::factory()->create(['name' => 'Kabul', 'code' => 'kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni', 'code' => 'ghazni']);
        $variant = ProductVariant::factory()->create();

        $this->seedStock($variant->id, $kabul->id, $user, 20);
        $this->seedStock($variant->id, $ghazni->id, $user, 12);

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 25],
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/v1/dashboard');

        $response->assertOk()
            ->assertJsonPath('data.stock_quantity', 30)
            ->assertJsonPath('data.today.sales_total', 50);

        $byLocation = collect($response->json('data.by_location'));
        $this->assertSame(18.0, (float) $byLocation->firstWhere('name', 'Kabul')['stock_quantity']);
        $this->assertSame(12.0, (float) $byLocation->firstWhere('name', 'Ghazni')['stock_quantity']);
        $this->assertSame(50.0, (float) $byLocation->firstWhere('name', 'Kabul')['sales_total']);
        $this->assertSame(0.0, (float) $byLocation->firstWhere('name', 'Ghazni')['sales_total']);
    }

    public function test_sales_and_purchases_reports(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 20);

        $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5, 'unit_price' => 10],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 20,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 30],
            ],
        ])->assertCreated();

        $this->getJson('/api/v1/reports/sales?location_id='.$location->id)
            ->assertOk()
            ->assertJsonPath('data.summary.count', 1)
            ->assertJsonPath('data.summary.total_amount', 60);

        $this->getJson('/api/v1/reports/purchases?location_id='.$location->id)
            ->assertOk()
            ->assertJsonPath('data.summary.count', 1)
            ->assertJsonPath('data.summary.total_amount', 50);
    }

    public function test_financial_and_worker_reports(): void
    {
        Sanctum::actingAs(User::factory()->create());

        Customer::factory()->create(['balance' => 120]);
        Supplier::factory()->create(['balance' => 80]);

        $worker = Worker::factory()->create();
        $location = Location::factory()->create();

        $this->postJson('/api/v1/worker-payments', [
            'worker_id' => $worker->id,
            'location_id' => $location->id,
            'amount' => 75,
        ])->assertCreated();

        $this->getJson('/api/v1/reports/financial')
            ->assertOk()
            ->assertJsonPath('data.customers.total_receivable', 120)
            ->assertJsonPath('data.suppliers.total_payable', 80);

        $this->getJson('/api/v1/reports/workers?worker_id='.$worker->id)
            ->assertOk()
            ->assertJsonPath('data.summary.total_amount', 75);
    }

    public function test_profit_loss_report_uses_weighted_average(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/reports/profit-loss')
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.method', 'weighted_average')
            ->assertJsonStructure([
                'data' => [
                    'summary' => [
                        'gross_sales',
                        'returns_amount',
                        'revenue',
                        'cost',
                        'gross_profit',
                        'operating_expenses',
                        'net_profit',
                    ],
                    'rows',
                ],
            ]);
    }

    public function test_profit_loss_nets_sales_returns(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 20);

        $sale = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 4, 'unit_price' => 25],
            ],
        ])->assertCreated()->json('data');

        $this->postJson('/api/v1/sales-returns', [
            'sale_id' => $sale['id'],
            'items' => [
                ['sale_item_id' => $sale['items'][0]['id'], 'quantity' => 1],
            ],
        ])->assertCreated();

        $response = $this->getJson('/api/v1/reports/profit-loss?location_id='.$location->id);

        $response->assertOk()
            ->assertJsonPath('data.summary.gross_sales', 100)
            ->assertJsonPath('data.summary.returns_amount', 25)
            ->assertJsonPath('data.summary.revenue', 75);

        $this->assertSame(0.0, (float) $response->json('data.summary.cost'));
        $this->assertSame(75.0, (float) $response->json('data.summary.net_profit'));
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
