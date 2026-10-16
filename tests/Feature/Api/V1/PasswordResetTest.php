<?php

namespace Tests\Feature\Api\V1;

use App\Mail\PasswordResetCodeMail;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_always_returns_generic_success(): void
    {
        Mail::fake();

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'missing@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('success', true);

        Mail::assertNothingSent();
    }

    public function test_forgot_password_returns_a_clear_error_when_mail_cannot_be_sent(): void
    {
        User::factory()->create([
            'email' => 'brother@example.com',
            'is_active' => true,
        ]);

        Mail::shouldReceive('to')->once()->andReturnUsing(function () {
            return new class
            {
                public function send(mixed $mailable): void
                {
                    throw new \RuntimeException('Unable to write the mail log.');
                }
            };
        });

        $response = $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'brother@example.com',
        ])->assertStatus(503);

        $this->assertStringContainsString(
            'The confirmation email could not be sent.',
            (string) $response->json('message')
        );
    }

    public function test_forgot_password_sends_code_for_active_user(): void
    {
        Mail::fake();

        $user = User::factory()->create([
            'email' => 'brother@example.com',
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => 'brother@example.com',
        ])->assertOk();

        Mail::assertSent(PasswordResetCodeMail::class, function (PasswordResetCodeMail $mail) use ($user) {
            return $mail->hasTo($user->email);
        });

        $this->assertDatabaseHas('password_reset_codes', [
            'email' => 'brother@example.com',
        ]);
    }

    public function test_reset_password_with_valid_code_updates_password_and_revokes_tokens(): void
    {
        $location = Location::factory()->create();
        $user = User::factory()->create([
            'email' => 'brother@example.com',
            'password' => 'old-password',
            'location_id' => $location->id,
        ]);

        $oldToken = $user->createToken('old-device')->plainTextToken;
        $code = '123456';

        DB::table('password_reset_codes')->insert([
            'email' => 'brother@example.com',
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(15),
            'consumed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'brother@example.com',
            'code' => $code,
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->withHeader('Authorization', 'Bearer '.$oldToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'brother@example.com',
            'password' => 'brand-new-pass',
            'location_id' => $location->id,
        ])->assertOk();
    }

    public function test_reset_password_rejects_invalid_code(): void
    {
        User::factory()->create([
            'email' => 'brother@example.com',
            'password' => 'old-password',
        ]);

        DB::table('password_reset_codes')->insert([
            'email' => 'brother@example.com',
            'code_hash' => Hash::make('123456'),
            'expires_at' => now()->addMinutes(15),
            'consumed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'brother@example.com',
            'code' => '000000',
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_two_users_can_login_concurrently(): void
    {
        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni']);

        $first = User::factory()->create([
            'email' => 'user1@example.com',
            'password' => 'password',
            'location_id' => $kabul->id,
        ]);
        $second = User::factory()->create([
            'email' => 'user2@example.com',
            'password' => 'password',
            'location_id' => $ghazni->id,
        ]);

        $loginOne = $this->postJson('/api/v1/auth/login', [
            'email' => $first->email,
            'password' => 'password',
            'location_id' => $kabul->id,
            'device_name' => 'phone-a',
        ])->assertOk();

        $loginTwo = $this->postJson('/api/v1/auth/login', [
            'email' => $second->email,
            'password' => 'password',
            'location_id' => $ghazni->id,
            'device_name' => 'phone-b',
        ])->assertOk();

        $loginOne
            ->assertJsonPath('data.user.email', $first->email)
            ->assertJsonPath('data.user.id', $first->id);
        $loginTwo
            ->assertJsonPath('data.user.email', $second->email)
            ->assertJsonPath('data.user.id', $second->id);

        $this->assertNotSame($loginOne->json('data.token'), $loginTwo->json('data.token'));
        $this->assertDatabaseCount('personal_access_tokens', 2);
        $this->assertSame(1, $first->tokens()->count());
        $this->assertSame(1, $second->tokens()->count());
    }

    public function test_password_change_revokes_other_tokens(): void
    {
        $location = Location::factory()->create();
        $user = User::factory()->create([
            'password' => 'password',
            'location_id' => $location->id,
        ]);

        $current = $user->createToken('current-device');
        $other = $user->createToken('other-device');

        $this->withToken($current->plainTextToken)
            ->putJson('/api/v1/auth/password', [
                'current_password' => 'password',
                'password' => 'newer-secret-pass',
                'password_confirmation' => 'newer-secret-pass',
            ])->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $other->accessToken->id,
        ]);
        $this->assertDatabaseHas('personal_access_tokens', [
            'id' => $current->accessToken->id,
        ]);
    }
}
