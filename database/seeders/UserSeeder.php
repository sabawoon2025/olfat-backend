<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->seedProductionAdmin();

            return;
        }

        $password = (string) env('SEED_USER_PASSWORD', 'password');

        $users = [
            ['name' => 'User One', 'email' => 'user1@example.com', 'role' => UserRole::Admin],
            ['name' => 'User Two', 'email' => 'user2@example.com', 'role' => UserRole::Admin],
            ['name' => 'User Three', 'email' => 'user3@example.com', 'role' => UserRole::Admin],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'password' => Hash::make($password),
                    'is_active' => true,
                    'role' => $user['role'],
                ]
            );
        }
    }

    private function seedProductionAdmin(): void
    {
        $email = (string) env('SEED_ADMIN_EMAIL', '');
        $password = (string) env('SEED_ADMIN_PASSWORD', '');
        $name = (string) env('SEED_ADMIN_NAME', 'Administrator');

        if ($email === '' || $password === '') {
            $this->command?->warn(
                'Production user seed skipped. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin.'
            );

            return;
        }

        if (strlen($password) < 12) {
            throw new RuntimeException('SEED_ADMIN_PASSWORD must be at least 12 characters in production.');
        }

        User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name !== '' ? $name : 'Administrator',
                'password' => Hash::make($password),
                'is_active' => true,
                'role' => UserRole::Admin,
            ]
        );
    }
}
