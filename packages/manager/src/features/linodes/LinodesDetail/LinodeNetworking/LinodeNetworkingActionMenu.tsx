import { IPAddress, IPRange } from '@linode/api-v4/lib/networking';
import { isEmpty } from 'ramda';
import * as React from 'react';
import ActionMenu, { Action } from 'src/components/ActionMenu';
import {
  makeStyles,
  Theme,
  useMediaQuery,
  useTheme,
} from 'src/components/core/styles';
import InlineMenuAction from 'src/components/InlineMenuAction';
import { IPTypes } from './types';

const useStyles = makeStyles({
  emptyCell: {
    height: 40,
  },
});

interface Props {
  onEdit?: (ip: IPAddress | IPRange) => void;
  onRemove?: (ip: IPAddress | IPRange) => void;
  ipType: IPTypes;
  ipAddress?: IPAddress | IPRange;
  readOnly: boolean;
}

export const LinodeNetworkingActionMenu = (props: Props) => {
  const classes = useStyles();

  const theme = useTheme<Theme>();
  const matchesMdDown = useMediaQuery(theme.breakpoints.down('md'));

  const { onEdit, onRemove, ipType, ipAddress, readOnly } = props;

  const showEdit =
    ipType !== 'IPv4 – Private' &&
    ipType !== 'IPv6 – Link Local' &&
    ipType !== 'IPv4 – Reserved (public)' &&
    ipType !== 'IPv4 – Reserved (private)';

  const deletableIPTypes = ['IPv4 – Public', 'IPv6 – Range'];

  // if we have a 116 we don't want to give the option to remove it
  const is116Range = ipAddress?.prefix === 116;

  const actions = [
    onRemove && ipAddress && !is116Range && deletableIPTypes.includes(ipType)
      ? {
          title: 'Delete',
          disabled: readOnly,
          onClick: () => {
            onRemove(ipAddress);
          },
        }
      : null,
    onEdit && ipAddress && showEdit
      ? {
          title: 'Edit RDNS',
          disabled: readOnly,
          onClick: () => {
            onEdit(ipAddress);
          },
        }
      : null,
  ].filter(Boolean) as Action[];

  return !isEmpty(actions) ? (
    <>
      {!matchesMdDown &&
        actions.map((action) => {
          return (
            <InlineMenuAction
              key={action.title}
              actionText={action.title}
              disabled={readOnly}
              onClick={action.onClick}
            />
          );
        })}
      {matchesMdDown && (
        <ActionMenu
          actionsList={actions}
          ariaLabel={`Action menu for IP Address ${props.ipAddress}`}
        />
      )}
    </>
  ) : (
    <span className={classes.emptyCell}></span>
  );
};

export default LinodeNetworkingActionMenu;
