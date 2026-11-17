<?php

namespace Tests\Feature\Api\V1;

use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProvinceLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_options_lists_users_and_available_provinces(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul', 'code' => 'kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni', 'code' => 'ghazni']);
        $user = User::factory()->create([
            'email' => 'user1@example.com',
            'location_id' => $kabul->id,
        ]);
        User::factory()->create(['email' => 'user2@example.com']);

        $response = $this->getJson('/api/v1/auth/login-options');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $locations = collect($response->json('data.locations'));
        $this->assertFalse($locations->firstWhere('id', $kabul->id)['available']);
        $this->assertSame($user->name, $locations->firstWhere('id', $kabul->id)['claimed_by']['name']);
        $this->assertArrayNotHasKey('email', $locations->firstWhere('id', $kabul->id)['claimed_by']);
        $this->assertTrue($locations->firstWhere('id', $ghazni->id)['available']);

        $emails = collect($response->json('data.users'))->pluck('email')->all();
        $this->assertContains('user1@example.com', $emails);
        $this->assertContains('user2@example.com', $emails);
    }

    public function test_first_login_claims_province_for_user(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul', 'code' => 'kabul']);
        $user = User::factory()->create([
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => null,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.user.location_id', $kabul->id)
            ->assertJsonPath('data.user.location.name', 'Kabul');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'location_id' => $kabul->id,
        ]);
    }

    public function test_second_user_cannot_claim_taken_province(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul', 'code' => 'kabul']);
        User::factory()->create([
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ]);
        User::factory()->create([
            'email' => 'user2@example.com',
            'password' => 'password',
            'location_id' => null,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user2@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['location_id']);
    }

    public function test_user_must_login_with_their_own_claimed_province(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul', 'code' => 'kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni', 'code' => 'ghazni']);
        User::factory()->create([
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $ghazni->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['location_id']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ])->assertOk();
    }
}
