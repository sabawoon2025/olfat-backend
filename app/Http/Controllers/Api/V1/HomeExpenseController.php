<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomeExpense;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HomeExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // OPEN QUESTION: visibility among the three users — currently all auth users can list all.
        $query = HomeExpense::query()
            ->with('user')
            ->latest('expense_date')
            ->latest('id');

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('from')) {
            $query->whereDate('expense_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('expense_date', '<=', $request->date('to'));
        }

        return ApiResponse::success($query->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $this->mergeExpenseDateAlias($request);

        $data = $request->validate([
            'category' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'expense_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $expense = HomeExpense::query()->create([
            ...$data,
            'reference_no' => 'HEXP-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'user_id' => $request->user()->id,
        ]);

        return ApiResponse::success($expense->load('user'), 'Home expense recorded', 201);
    }

    public function show(HomeExpense $homeExpense): JsonResponse
    {
        return ApiResponse::success($homeExpense->load('user'));
    }

    public function update(Request $request, HomeExpense $homeExpense): JsonResponse
    {
        $this->mergeExpenseDateAlias($request);

        $data = $request->validate([
            'category' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['sometimes', 'required', 'numeric', 'gt:0'],
            'expense_date' => ['sometimes', 'required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $homeExpense->fill($data)->save();

        return ApiResponse::success($homeExpense->fresh('user'), 'Home expense updated');
    }

    public function destroy(HomeExpense $homeExpense): JsonResponse
    {
        $homeExpense->delete();

        return ApiResponse::success(null, 'Home expense deleted');
    }

    /**
     * UI forms historically send `date`; the API column is `expense_date`.
     */
    private function mergeExpenseDateAlias(Request $request): void
    {
        if (! $request->filled('expense_date') && $request->filled('date')) {
            $request->merge([
                'expense_date' => $request->input('date'),
            ]);
        }
    }
}
