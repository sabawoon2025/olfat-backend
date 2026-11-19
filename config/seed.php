<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Production admin seed credentials
    |--------------------------------------------------------------------------
    |
    | Used by Database\Seeders\UserSeeder when APP_ENV=production.
    | Must live in config (not env() calls in the seeder) so values survive
    | php artisan config:cache.
    |
    */

    'admins' => [
        1 => [
            'name' => env('SEED_ADMIN_1_NAME', ''),
            'email' => env('SEED_ADMIN_1_EMAIL', ''),
            'password' => env('SEED_ADMIN_1_PASSWORD', ''),
        ],
        2 => [
            'name' => env('SEED_ADMIN_2_NAME', ''),
            'email' => env('SEED_ADMIN_2_EMAIL', ''),
            'password' => env('SEED_ADMIN_2_PASSWORD', ''),
        ],
        3 => [
            'name' => env('SEED_ADMIN_3_NAME', ''),
            'email' => env('SEED_ADMIN_3_EMAIL', ''),
            'password' => env('SEED_ADMIN_3_PASSWORD', ''),
        ],
    ],

    'legacy' => [
        'name' => env('SEED_ADMIN_NAME', 'Administrator'),
        'email' => env('SEED_ADMIN_EMAIL', ''),
        'password' => env('SEED_ADMIN_PASSWORD', ''),
    ],

    'dev_password' => env('SEED_USER_PASSWORD', 'password'),

];
