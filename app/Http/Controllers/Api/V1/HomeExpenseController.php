<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomeExpense;
use App\Services\Settings\SettingsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HomeExpenseController extends Controller
{
    private const CATEGORIES_SETTING_KEY = 'home_expenses.categories';

    /** @var list<string> */
    private const DEFAULT_CATEGORIES = [
        'Food',
        'Household',
        'Personal',
        'Transport',
        'Medical',
    ];

    public function __construct(private readonly SettingsService $settingsService) {}

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

    /**
     * Saved + default expense categories for the Add Expense dropdown.
     */
    public function categories(): JsonResponse
    {
        return ApiResponse::success($this->categoryList());
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

        $data['category'] = trim($data['category']);

        $expense = HomeExpense::query()->create([
            ...$data,
            'reference_no' => 'HEXP-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'user_id' => $request->user()->id,
        ]);

        $this->rememberCategory($data['category']);

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

        if (array_key_exists('category', $data)) {
            $data['category'] = trim($data['category']);
        }

        $homeExpense->fill($data)->save();

        if (! empty($data['category'])) {
            $this->rememberCategory($data['category']);
        }

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

    private function rememberCategory(string $category): void
    {
        $this->settingsService->appendUniqueString(
            self::CATEGORIES_SETTING_KEY,
            $category,
            [
                'group' => 'home_expenses',
                'label' => 'Home Expense Categories',
                'description' => 'Custom categories available in the Add Expense form',
            ]
        );
    }

    /**
     * @return list<array{id:string,label:string}>
     */
    private function categoryList(): array
    {
        $saved = $this->settingsService->get(self::CATEGORIES_SETTING_KEY, []);
        if (! is_array($saved)) {
            $saved = [];
        }

        $fromExpenses = HomeExpense::query()
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->all();

        $merged = [];
        foreach (array_merge(self::DEFAULT_CATEGORIES, $saved, $fromExpenses) as $label) {
            $label = trim((string) $label);
            if ($label === '' || $this->isRetiredCategory($label)) {
                continue;
            }
            $key = mb_strtolower($label);
            if (isset($merged[$key])) {
                continue;
            }
            $merged[$key] = [
                'id' => $label,
                'label' => $label,
            ];
        }

        return array_values($merged);
    }

    private function isRetiredCategory(string $label): bool
    {
        $normalized = mb_strtolower(trim($label));

        return in_array($normalized, ['other', 'other home expenses', 'سایر مصارف خانه'], true);
    }
}
