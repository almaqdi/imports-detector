import React, { useState, useEffect } from 'react';
import Test from '../components/Test';

const HomePage: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('Component mounted');
  }, []);

  return (
    <div>
      <h2>Home Page</h2>
      <Test title={`Count: ${count}`} />
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

export default HomePage;
