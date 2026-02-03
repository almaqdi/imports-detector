import React from 'react';
import { Test } from './components/Test';
import { Button } from './components/Button';

const LazyComponent = React.lazy(() => import('./components/Test'));
const Maqdi = React.lazy(() => import('./components/maqdi/Maqdi'));

const App: React.FC = () => {
  return (
    <div>
      <h1>My App</h1>
      <Test title="Hello World" />
      <Button label="Click me" onClick={() => console.log('clicked')} />
    </div>
  );
};

export default App;
