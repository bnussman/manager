import * as React from 'react';

import { ActionMenu } from 'src/components/ActionMenu/ActionMenu';

import { getAlertTypeToActionsList } from '../Utils/AlertsActionMenu';

import type { AlertDefinitionType } from '@linode/api-v4';

export interface ActionHandlers {
  /**
   * Callback for show details action
   */
  handleDetails: () => void;

  /**
   * Callback for edit alerts action
   */
  handleEdit: () => void;
}

export interface AlertActionMenuProps {
  /**
   * The label of the alert
   */
  alertLabel: string;
  /**
   * Type of the alert
   */
  alertType: AlertDefinitionType;
  /**
   * Handlers for alert actions like delete, show details etc.,
   */
  handlers: ActionHandlers;
}

export const AlertActionMenu = (props: AlertActionMenuProps) => {
  const { alertLabel, alertType, handlers } = props;
  return (
    <ActionMenu
      actionsList={getAlertTypeToActionsList(handlers)[alertType]}
      ariaLabel={`Action menu for Alert ${alertLabel}`}
    />
  );
};
