# Page Object Model with Playwright

Complete POM implementation: class structure, locator encapsulation, composition, and fixture integration.

## Scenario

E-commerce checkout flow: product listing → product detail → cart → checkout. Multiple tests cover different paths through this flow.

## Why POM in Playwright

- Locators defined once — change UI in one place, not 20 test files
- Actions named semantically (`addToCart()`) — tests read like specs
- Composition: complex pages delegate to sub-components
- Fixtures inject POM instances — tests receive ready-to-use objects

## File Structure

```
tests/
├── pages/
│   ├── BasePage.ts          # shared navigation, header, footer
│   ├── ProductListPage.ts   # /products
│   ├── ProductDetailPage.ts # /products/:id
│   ├── CartPage.ts          # /cart
│   └── CheckoutPage.ts      # /checkout
├── fixtures.ts              # POM fixtures
└── checkout.spec.ts         # tests using POM + fixtures
```

## BasePage — Shared Actions

```ts
// tests/pages/BasePage.ts
import { Page, Locator } from '@playwright/test';

export class BasePage {
  protected page: Page;

  // Header navigation — shared across all pages
  readonly cartIcon: Locator;
  readonly userMenu: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartIcon = page.getByRole('link', { name: /cart/i });
    this.userMenu = page.getByRole('button', { name: /account/i });
    this.searchInput = page.getByRole('searchbox', { name: 'Search products' });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.page.waitForURL(/\/search/);
  }

  async goToCart(): Promise<void> {
    await this.cartIcon.click();
    await this.page.waitForURL('/cart');
  }

  async getCartCount(): Promise<number> {
    const text = await this.page
      .getByRole('link', { name: /cart/i })
      .getByRole('status')
      .textContent();
    return parseInt(text ?? '0', 10);
  }
}
```

## ProductListPage

```ts
// tests/pages/ProductListPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductListPage extends BasePage {
  readonly heading: Locator;
  readonly productCards: Locator;
  readonly sortSelect: Locator;
  readonly filterPanel: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.productCards = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: /add to cart/i }),
    });
    this.sortSelect = page.getByRole('combobox', { name: 'Sort by' });
    this.filterPanel = page.getByRole('region', { name: 'Filters' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/products');
    await expect(this.heading).toBeVisible();
  }

  async filterByCategory(category: string): Promise<void> {
    await this.filterPanel
      .getByRole('checkbox', { name: category })
      .check();
    // Wait for list to update
    await expect(this.productCards.first()).toBeVisible();
  }

  async getProductCard(name: string): Promise<Locator> {
    return this.productCards.filter({ hasText: name });
  }

  async clickProduct(name: string): Promise<void> {
    await this.productCards
      .filter({ hasText: name })
      .getByRole('link')
      .click();
    await this.page.waitForURL(/\/products\/\d+/);
  }

  async getProductCount(): Promise<number> {
    return this.productCards.count();
  }
}
```

## ProductDetailPage

```ts
// tests/pages/ProductDetailPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ProductDetailPage extends BasePage {
  readonly name: Locator;
  readonly price: Locator;
  readonly addToCartButton: Locator;
  readonly quantityInput: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByRole('heading', { level: 1 });
    this.price = page.getByTestId('product-price');
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
    this.quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
    this.successToast = page.getByRole('alert').filter({ hasText: 'Added to cart' });
  }

  async addToCart(quantity = 1): Promise<void> {
    if (quantity > 1) {
      await this.quantityInput.fill(String(quantity));
    }
    await this.addToCartButton.click();
    await expect(this.successToast).toBeVisible();
  }

  async getPrice(): Promise<number> {
    const text = await this.price.textContent();
    return parseFloat(text!.replace(/[^0-9.]/g, ''));
  }
}
```

## CartPage

```ts
// tests/pages/CartPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly items: Locator;
  readonly totalPrice: Locator;
  readonly checkoutButton: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: 'Remove' }),
    });
    this.totalPrice = page.getByTestId('cart-total');
    this.checkoutButton = page.getByRole('link', { name: 'Proceed to checkout' });
    this.emptyMessage = page.getByText('Your cart is empty');
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart');
  }

  async removeItem(name: string): Promise<void> {
    await this.items
      .filter({ hasText: name })
      .getByRole('button', { name: 'Remove' })
      .click();
  }

  async getItemCount(): Promise<number> {
    return this.items.count();
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
    await this.page.waitForURL('/checkout');
  }
}
```

## Fixture Integration

```ts
// tests/fixtures.ts
import { test as base } from '@playwright/test';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';

type PageObjects = {
  productList: ProductListPage;
  productDetail: ProductDetailPage;
  cart: CartPage;
};

export const test = base.extend<PageObjects>({
  productList: async ({ page }, use) => {
    await use(new ProductListPage(page));
  },
  productDetail: async ({ page }, use) => {
    await use(new ProductDetailPage(page));
  },
  cart: async ({ page }, use) => {
    await use(new CartPage(page));
  },
});

export { expect } from '@playwright/test';
```

## Tests Using POM

```ts
// tests/checkout.spec.ts
import { test, expect } from './fixtures';

test('add product to cart from listing', async ({ productList, cart }) => {
  await productList.goto();
  await productList.filterByCategory('Electronics');
  await productList.clickProduct('Wireless Headphones');

  // Now on detail page — but we need productDetail fixture
  // Alternative: navigate directly in the test
});

test('full checkout flow', async ({ productDetail, cart, page }) => {
  // Navigate to a known product
  await page.goto('/products/42');

  // Add to cart
  await productDetail.addToCart(2);
  await productDetail.goToCart();

  // Verify cart
  const count = await cart.getItemCount();
  expect(count).toBe(1);

  // Proceed
  await cart.proceedToCheckout();
  await expect(page).toHaveURL('/checkout');
});

test('empty cart shows message', async ({ cart }) => {
  await cart.goto();
  await expect(cart.emptyMessage).toBeVisible();
  await expect(cart.checkoutButton).toBeHidden();
});

test('remove item from cart', async ({ cart, page }) => {
  // Set up: add item first via API or navigation
  await page.goto('/cart?test-item=headphones');  // test-only query param
  await expect(cart.items).toHaveCount(1);

  await cart.removeItem('Wireless Headphones');
  await expect(cart.items).toHaveCount(0);
  await expect(cart.emptyMessage).toBeVisible();
});
```

## Key POM Principles Applied

1. **Locators in constructor** — defined once, type-checked, easy to update
2. **Actions return void or navigate** — don't return locators from methods
3. **Wait implicitly** — each action ends when the next state is stable (use `waitForURL`, `toBeVisible`)
4. **No assertions in POM** — assertions belong in tests, not page objects (exception: `addToCart` asserts toast for convenience)
5. **Inheritance for shared behavior** — `BasePage` holds header/footer actions
6. **Fixtures inject POM** — tests receive ready objects, not `new Page(...)` calls
