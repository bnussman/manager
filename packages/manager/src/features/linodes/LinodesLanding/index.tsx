import * as React from 'react';
import CircleProgress from 'src/components/CircleProgress';
import { useReduxLoad } from 'src/hooks/useReduxLoad';
import _LinodesLanding, { Props } from './LinodesLanding';

const LinodesLanding: React.FC<Props> = (props) => {
  const { _loading } = useReduxLoad(['linodes', 'images']);
  return _loading ? <CircleProgress /> : <_LinodesLanding {...props} />;
};

export default LinodesLanding;
