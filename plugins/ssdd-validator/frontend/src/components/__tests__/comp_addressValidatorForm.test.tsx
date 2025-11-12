import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddressValidatorForm from '../AddressValidatorForm';

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/Street Address/i), '123 Main St');
  await user.type(screen.getByLabelText(/City/i), 'Springfield');
  await user.type(screen.getByLabelText(/^State/i), 'il');
  await user.type(screen.getByLabelText(/ZIP Code/i), '62701');
};

describe('comp_AddressValidatorForm', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('normalizes state input to uppercase', async () => {
    const user = userEvent.setup();
    render(<AddressValidatorForm />);
    const stateInput = screen.getByLabelText(/^State/i);

    await user.type(stateInput, 'ca ');
    expect(stateInput).toHaveValue('CA');
  });

  it('submits form successfully and surfaces callback', async () => {
    const onComplete = jest.fn();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        ssdd: 'CA-12',
        standardizedAddress: {
          street1: '123 MAIN ST',
          street2: '',
          city: 'SPRINGFIELD',
          state: 'CA',
          zip: '62701',
        },
        coordinates: { latitude: 0, longitude: 0 },
        district: { state: 'CA', districtNumber: '12', representative: null },
      }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<AddressValidatorForm onValidationComplete={onComplete} />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /Validate Address/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(screen.getByText(/Address Validated Successfully/i)).toBeInTheDocument();
  });

  it('shows errors returned from API', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid ZIP' }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<AddressValidatorForm />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /Validate Address/i }));

    await waitFor(() => expect(screen.getByText(/Invalid ZIP/i)).toBeInTheDocument());
  });
});
