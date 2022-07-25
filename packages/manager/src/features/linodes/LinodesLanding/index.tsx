import * as React from 'react';
import CircleProgress from 'src/components/CircleProgress';
import { useReduxLoad } from 'src/hooks/useReduxLoad';

const LinodesLanding = (props: Props) => {
  const { _loading } = useReduxLoad(['linodes', 'images']);
  return _loading ? <CircleProgress /> : <_LinodesLanding {...props} />;
};

import _LinodesLanding, { Props } from './LinodesLanding';
export default LinodesLanding;
