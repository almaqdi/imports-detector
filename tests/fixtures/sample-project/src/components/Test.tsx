import React from 'react';

interface TestProps {
  title: string;
}

export const Test: React.FC<TestProps> = ({ title }) => {
  return <div>{title}</div>;
};

export default Test;
