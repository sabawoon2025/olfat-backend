<?php

namespace App\Http\Requests\Payment;

use App\Enums\Currency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:customers,id'],
            'location_id' => ['required', 'exists:locations,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'sale_id' => ['required', 'exists:sales,id'],
            'currency' => ['nullable', 'string', Rule::in(Currency::values())],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
