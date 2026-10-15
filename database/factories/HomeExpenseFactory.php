<?php

namespace Database\Factories;

use App\Models\HomeExpense;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<HomeExpense> */
class HomeExpenseFactory extends Factory
{
    protected $model = HomeExpense::class;

    public function definition(): array
    {
        return [
            'reference_no' => 'HEXP-'.now()->format('Ymd').'-'.fake()->unique()->bothify('??????'),
            'category' => fake()->randomElement(['Food', 'Household', 'Personal', 'Transport', 'Medical']),
            'description' => fake()->sentence(3),
            'amount' => fake()->randomFloat(2, 5, 200),
            'expense_date' => now()->toDateString(),
            'user_id' => User::factory(),
            'notes' => null,
        ];
    }
}
