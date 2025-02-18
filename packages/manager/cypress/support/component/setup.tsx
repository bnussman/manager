// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import { queryClientFactory } from '@src/queries/base';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/cypress/add-commands';
import 'cypress-axe';
import { mount } from 'cypress/react';
import { LDProvider } from 'launchdarkly-react-client-sdk';
import { SnackbarProvider } from 'notistack';
import * as React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { LinodeThemeWrapper } from 'src/LinodeThemeWrapper';
import { storeFactory } from 'src/store';

import type { ThemeName } from '@linode/ui';

/**
 * Mounts a component with a Cloud Manager theme applied.
 *
 * @param jsx - React Component to mount.
 * @param theme - Cloud Manager theme to apply. Defaults to `light`.
 */
export const mountWithTheme = (
  jsx: React.ReactNode,
  theme: ThemeName = 'light',
  flags: any = {}
) => {
  const queryClient = queryClientFactory();
  const store = storeFactory();

  return mount(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <LinodeThemeWrapper theme={theme}>
          <LDProvider
            clientSideID={''}
            deferInitialization
            flags={flags}
            options={{ bootstrap: flags }}
          >
            <SnackbarProvider>
              <MemoryRouter>{jsx}</MemoryRouter>
            </SnackbarProvider>
          </LDProvider>
        </LinodeThemeWrapper>
      </QueryClientProvider>
    </Provider>
  );
};

// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
      mountWithTheme: typeof mountWithTheme;
    }
  }
}

Cypress.Commands.add('mount', mount);
Cypress.Commands.add('mountWithTheme', mountWithTheme);
