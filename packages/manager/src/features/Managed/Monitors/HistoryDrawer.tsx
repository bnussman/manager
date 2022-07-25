import { ManagedIssue } from '@linode/api-v4/lib/managed';
import { APIError } from '@linode/api-v4/lib/types';
import * as React from 'react';
import ActionsPanel from 'src/components/ActionsPanel';
import Button from 'src/components/Button';
import CircleProgress from 'src/components/CircleProgress';
import Drawer from 'src/components/Drawer';
import ErrorState from 'src/components/ErrorState';
import { ExtendedIssue } from 'src/store/managed/issues.actions';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import IssueCalendar from './IssueCalendar';

interface Props {
  open: boolean;
  error?: APIError[];
  loading: boolean;
  monitorLabel: string;
  issues: ExtendedIssue[];
  onClose: () => void;
}

export const HistoryDrawer = (props: Props) => {
  const { error, issues, loading, monitorLabel, onClose, open } = props;
  return (
    <Drawer
      title={`Issue History: ${monitorLabel}`}
      open={open}
      onClose={onClose}
    >
      {renderDrawerContent(issues, loading, error)}
      <ActionsPanel>
        <Button buttonType="primary" onClick={() => onClose()} data-qa-close>
          Close
        </Button>
      </ActionsPanel>
    </Drawer>
  );
};

const renderDrawerContent = (
  issues: ManagedIssue[],
  loading: boolean,
  error?: APIError[]
) => {
  if (loading) {
    return <CircleProgress />;
  }

  if (error) {
    return (
      <ErrorState
        errorText={
          getAPIErrorOrDefault(error, 'Error loading your issue history')[0]
            .reason
        }
      />
    );
  }
  return <IssueCalendar issues={issues} />;
};

export default HistoryDrawer;
