<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ExternalDebtDirection;
use App\Models\ExternalParty;
use App\Models\HomeExpense;
use App\Models\Location;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase8ModulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_worker_payment_is_recorded_with_user_and_location(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $worker = Worker::factory()->create();
        $location = Location::factory()->create();

        $response = $this->postJson('/api/v1/worker-payments', [
            'worker_id' => $worker->id,
            'location_id' => $location->id,
            'amount' => 120.5,
            'description' => 'Weekly pay',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.amount', '120.50')
            ->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.location_id', $location->id);
    }

    public function test_external_debt_and_payment_flow(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $party = ExternalParty::factory()->create(['name' => 'Ahmad']);
        $location = Location::factory()->create();

        $debt = $this->postJson('/api/v1/external-debts', [
            'external_party_id' => $party->id,
            'direction' => ExternalDebtDirection::BusinessOwes->value,
            'reason' => 'Loan',
            'original_amount' => 500,
            'paid_amount' => 0,
            'location_id' => $location->id,
        ])->assertCreated();

        $debtId = $debt->json('data.id');
        $this->assertSame('500.00', $debt->json('data.remaining_amount'));
        $this->assertSame('open', $debt->json('data.status'));

        $payment = $this->postJson('/api/v1/external-debts/'.$debtId.'/payments', [
            'location_id' => $location->id,
            'amount' => 200,
        ])->assertCreated();

        $this->assertSame('300.00', $payment->json('data.remaining_after'));

        $this->getJson('/api/v1/external-debts/'.$debtId)
            ->assertOk()
            ->assertJsonPath('data.remaining_amount', '300.00')
            ->assertJsonPath('data.paid_amount', '200.00');
    }

    public function test_external_debt_payment_cannot_exceed_remaining(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $debt = $this->postJson('/api/v1/external-debts', [
            'external_party_id' => ExternalParty::factory()->create()->id,
            'direction' => ExternalDebtDirection::PersonOwes->value,
            'reason' => 'Advance',
            'original_amount' => 100,
            'location_id' => Location::factory()->create()->id,
        ])->assertCreated();

        $this->postJson('/api/v1/external-debts/'.$debt->json('data.id').'/payments', [
            'location_id' => Location::factory()->create()->id,
            'amount' => 150,
        ])->assertStatus(422);
    }

    public function test_home_expense_is_recorded_and_does_not_require_location(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/home-expenses', [
            'category' => 'Food',
            'description' => 'Market',
            'amount' => 45.75,
            'expense_date' => now()->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.category', 'Food')
            ->assertJsonPath('data.amount', '45.75')
            ->assertJsonPath('data.user_id', $user->id);

        $this->getJson('/api/v1/home-expenses')->assertOk();
    }

    public function test_home_expense_accepts_date_alias_from_ui_form(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/v1/home-expenses', [
            'category' => 'Household',
            'description' => 'Kitchen supplies',
            'amount' => 2000,
            'date' => '2026-10-14',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.category', 'Household')
            ->assertJsonPath('data.amount', '2000.00');

        $this->assertTrue(
            HomeExpense::query()
                ->where('category', 'Household')
                ->whereDate('expense_date', '2026-10-14')
                ->exists()
        );
    }

    public function test_home_expense_saves_new_category_for_future_use(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/home-expenses', [
            'category' => 'School fees',
            'amount' => 150,
            'expense_date' => now()->toDateString(),
        ])->assertCreated();

        $categories = $this->getJson('/api/v1/home-expenses/categories');

        $categories->assertOk();
        $labels = collect($categories->json('data'))->pluck('label')->all();
        $this->assertContains('School fees', $labels);
        $this->assertContains('Food', $labels);
    }
}
