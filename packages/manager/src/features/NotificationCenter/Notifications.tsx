import * as React from 'react';
import NotificationSection, { NotificationItem } from './NotificationSection';

interface Props {
  notificationsList: NotificationItem[];
}

export const Notifications = (props: Props) => {
  const { notificationsList } = props;

  return (
    <NotificationSection
      content={notificationsList}
      header="Notifications"
      emptyMessage="No notifications to display."
    />
  );
};

export default React.memo(Notifications);
