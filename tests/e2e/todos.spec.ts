import { test, expect } from './fixtures';
test('register, create, edit, filter, delete, and log in again', async ({
  page,
  account,
}) => {
  const { username, password } = account;
  await page.goto('/');
  await page
    .getByRole('button', { name: 'New here? Create an account' })
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'A little progress.' }),
  ).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('Prepare pipeline');
  await page.getByLabel('Description').fill('I will implement CI/CD myself');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare pipeline', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit Prepare pipeline', exact: true })
    .click();
  await page.getByLabel('Title', { exact: true }).fill('Build pipeline');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('checkbox', { name: 'Complete Build pipeline' }).check();
  await page.getByRole('button', { name: 'Active', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Build pipeline', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Build pipeline', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Build pipeline', exact: true }),
  ).toBeVisible();
  page.on('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Delete Build pipeline', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Build pipeline', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A little progress.' }),
  ).toBeVisible();
});
