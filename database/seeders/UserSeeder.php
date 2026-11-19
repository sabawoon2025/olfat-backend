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
            $this->seedProductionAdmins();

            return;
        }

        $password = (string) config('seed.dev_password', 'password');

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

    /**
     * Create equal Admin accounts for production (Kabul / Maidan / Ghazni).
     *
     * Prefers SEED_ADMIN_1_* … SEED_ADMIN_3_*. Falls back to legacy
     * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME for a single admin.
     */
    private function seedProductionAdmins(): void
    {
        $admins = $this->productionAdminDefinitions();

        if ($admins === []) {
            $this->command?->warn(
                'Production user seed skipped. Set SEED_ADMIN_1_EMAIL + SEED_ADMIN_1_PASSWORD (and 2/3), or legacy SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD.'
            );

            return;
        }

        foreach ($admins as $admin) {
            if (strlen($admin['password']) < 12) {
                throw new RuntimeException(
                    "Password for {$admin['email']} must be at least 12 characters in production."
                );
            }

            User::query()->updateOrCreate(
                ['email' => $admin['email']],
                [
                    'name' => $admin['name'],
                    'password' => Hash::make($admin['password']),
                    'is_active' => true,
                    'role' => UserRole::Admin,
                ]
            );
        }
    }

    /**
     * @return list<array{name: string, email: string, password: string}>
     */
    private function productionAdminDefinitions(): array
    {
        $admins = [];

        for ($i = 1; $i <= 3; $i++) {
            $email = trim((string) config("seed.admins.{$i}.email", ''));
            $password = (string) config("seed.admins.{$i}.password", '');
            $name = trim((string) config("seed.admins.{$i}.name", ''));

            if ($email === '' || $password === '') {
                continue;
            }

            $admins[] = [
                'email' => $email,
                'password' => $password,
                'name' => $name !== '' ? $name : "Administrator {$i}",
            ];
        }

        if ($admins !== []) {
            return $admins;
        }

        $email = trim((string) config('seed.legacy.email', ''));
        $password = (string) config('seed.legacy.password', '');
        $name = trim((string) config('seed.legacy.name', 'Administrator'));

        if ($email === '' || $password === '') {
            return [];
        }

        return [[
            'email' => $email,
            'password' => $password,
            'name' => $name !== '' ? $name : 'Administrator',
        ]];
    }
}
