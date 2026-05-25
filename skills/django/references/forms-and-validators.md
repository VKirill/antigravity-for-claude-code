# Forms & validators

Django forms handle two distinct jobs at once: HTML rendering and server-side validation. They're worth using even for API endpoints when you want field-level error structures.

## `Form` vs `ModelForm`

Use `ModelForm` when the form maps to a single model — you get field generation, validation, and `save()` for free. Use `Form` for anything else (search, filters, multi-model wizards).

```python
from django import forms
from .models import Product

class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ["name", "slug", "price_cents", "status"]
        widgets = {
            "slug": forms.TextInput(attrs={"placeholder": "url-slug"}),
        }
        error_messages = {
            "name": {"required": "Name is required."},
        }

class ProductSearchForm(forms.Form):
    q = forms.CharField(max_length=200, required=False)
    min_price = forms.IntegerField(min_value=0, required=False)
    status = forms.ChoiceField(choices=Product.Status.choices, required=False)
```

`Meta.fields` accepts a list or `"__all__"`. Prefer the explicit list — `"__all__"` is a footgun: adding a field to the model silently exposes it through the form.

## Validation pipeline

When you call `form.is_valid()`:

1. Each field's `to_python()` converts the raw input
2. Each field's `validate()` runs built-in checks
3. Each field's `run_validators()` calls `field.validators`
4. `Form.clean_<fieldname>()` runs (per-field custom logic)
5. `Form.clean()` runs (cross-field logic)
6. Errors collected into `form.errors`

```python
class TransferForm(forms.Form):
    from_account = forms.IntegerField()
    to_account = forms.IntegerField()
    amount_cents = forms.IntegerField(min_value=1)

    def clean_to_account(self):
        # Per-field validation — only this field's cleaned_data is available
        to_id = self.cleaned_data["to_account"]
        if not Account.objects.filter(pk=to_id).exists():
            raise forms.ValidationError("Destination account does not exist.")
        return to_id

    def clean(self):
        # Cross-field — all clean_<x> have run, cleaned_data is populated
        cd = super().clean()
        if cd.get("from_account") == cd.get("to_account"):
            raise forms.ValidationError("Cannot transfer to the same account.")
        return cd
```

Raising `forms.ValidationError` in `clean_<x>` attaches the error to that field. Raising in `clean()` attaches to a non-field error (`form.non_field_errors()`).

## Built-in validators

```python
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator

class CouponForm(forms.Form):
    code = forms.CharField(
        validators=[RegexValidator(r"^[A-Z0-9]{6,12}$", "Invalid coupon format")],
    )
    discount = forms.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
```

Reuse model-level validators on form fields by attaching them to the model `Field` — they propagate to `ModelForm`.

## Custom validator function

```python
def validate_even(value: int) -> None:
    if value % 2:
        raise forms.ValidationError(f"{value} is not even.")

class MyForm(forms.Form):
    n = forms.IntegerField(validators=[validate_even])
```

Validators raise `ValidationError`. Returning `False` does nothing — only the raise matters.

## File uploads

```python
class AvatarForm(forms.Form):
    avatar = forms.ImageField()  # requires Pillow

    def clean_avatar(self):
        f = self.cleaned_data["avatar"]
        if f.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Max 5 MB.")
        return f
```

In the view, pass `request.FILES`:

```python
def upload(request):
    form = AvatarForm(request.POST or None, request.FILES or None)
    if request.method == "POST" and form.is_valid():
        ...
```

The form's `<form>` tag must have `enctype="multipart/form-data"`. Django stores small files in memory and large ones in temp files — controlled by `FILE_UPLOAD_HANDLERS` and `FILE_UPLOAD_MAX_MEMORY_SIZE`.

## Formsets

Several instances of the same form on one page (e.g., line items on an invoice):

```python
from django.forms import formset_factory, inlineformset_factory

LineItemFormSet = formset_factory(LineItemForm, extra=3, max_num=20)

# In a view
formset = LineItemFormSet(request.POST or None, prefix="items")
if formset.is_valid():
    for form in formset:
        ...
```

`inlineformset_factory` ties a formset to a parent model — perfect for the admin-style "edit invoice with its lines" pattern:

```python
OrderItemFormSet = inlineformset_factory(
    Order, OrderItem,
    fields=["product", "quantity"],
    extra=1, can_delete=True,
)

# View
order = get_object_or_404(Order, pk=pk)
formset = OrderItemFormSet(request.POST or None, instance=order)
if formset.is_valid():
    formset.save()
```

## Rendering forms

```django
<form method="post" enctype="multipart/form-data">
  {% csrf_token %}
  {{ form.as_p }}                   {# or .as_table / .as_ul / .as_div #}
  <button type="submit">Save</button>
</form>
```

For finer control, render fields one by one:

```django
<div class="field">
  <label for="{{ form.name.id_for_label }}">{{ form.name.label }}</label>
  {{ form.name }}
  {% if form.name.errors %}
    <ul class="errors">{% for e in form.name.errors %}<li>{{ e }}</li>{% endfor %}</ul>
  {% endif %}
</div>
```

## Error messages

```python
class MyForm(forms.Form):
    age = forms.IntegerField(
        error_messages={
            "required": "Age is required.",
            "invalid": "Age must be a whole number.",
            "min_value": "Age must be at least %(limit_value)d.",
        },
        min_value=18,
    )
```

Per-form override beats per-app override beats Django default. Use this for i18n-aware text.

## `RelatedManagerForm` pattern

When a form needs to set a M2M relation:

```python
class TagsForm(forms.ModelForm):
    tags = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.all(),
        widget=forms.CheckboxSelectMultiple,
    )

    class Meta:
        model = Post
        fields = ["title", "body", "tags"]
```

`ModelForm.save()` handles M2M correctly **only if** you call it without `commit=False`. If you do `obj = form.save(commit=False); obj.save(); form.save_m2m()` is required to persist tags.

## When NOT to use Django forms

- Pure REST APIs with structured JSON in/out → use DRF `Serializer` or Django Ninja Pydantic schemas
- Highly dynamic forms driven by client state → render the inputs yourself, validate server-side with a plain `Form` for safety
