import { fireEvent } from '@testing-library/react';
import PaymentInformation from './PaymentInformation';
import { paymentMethodFactory } from 'src/factories';
import { renderWithTheme } from 'src/utilities/testHelpers';
import * as React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { PAYPAL_CLIENT_ID } from 'src/constants';

const renderWithPayPalProvider = (jsx: JSX.Element) => {
  return renderWithTheme(
    <PayPalScriptProvider options={{ 'client-id': PAYPAL_CLIENT_ID }}>
      {jsx}
    </PayPalScriptProvider>
  );
};

/*
 * Build payment method list that includes 1 valid and default payment method,
 * 2 valid non-default payment methods, and 1 expired payment method.
 */
const paymentMethods = [
  paymentMethodFactory.build({
    is_default: true,
  }),
  ...paymentMethodFactory.buildList(2),
  paymentMethodFactory.build({
    data: {
      expiry: '12/2021',
    },
  }),
];

describe('Payment Info Panel', () => {
  it('Shows loading animation when loading', () => {
    const { getByLabelText } = renderWithPayPalProvider(
      <PaymentInformation loading={true} paymentMethods={paymentMethods} />
    );

    expect(getByLabelText('Content is loading')).toBeVisible();
  });

  it('Opens "Add Payment Method" drawer when "Add Payment Method" is clicked', () => {
    const { getByTestId } = renderWithPayPalProvider(
      <PaymentInformation loading={false} paymentMethods={paymentMethods} />
    );

    const addPaymentMethodButton = getByTestId(
      'payment-info-add-payment-method'
    );

    fireEvent.click(addPaymentMethodButton);
    expect(getByTestId('drawer')).toBeVisible();
  });

  it('Lists all payment methods', () => {
    const { getByTestId } = renderWithPayPalProvider(
      <PaymentInformation loading={false} paymentMethods={paymentMethods} />
    );

    paymentMethods.forEach((paymentMethod) => {
      expect(
        getByTestId(`payment-method-row-${paymentMethod.id}`)
      ).toBeVisible();
    });
  });
});
