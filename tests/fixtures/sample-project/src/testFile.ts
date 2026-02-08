// Test fixture file with various import types

import React from 'react';
import { Button } from './Button';
import TestUtils from './TestUtils';

// Dynamic import
const loadModule = async () => {
  const module = await import('./LazyComponent');
  return module;
};

// Lazy import (React.lazy)
const LazyHeader = React.lazy(() => import('./Header'));

// Require
const utils = require('./utils');

export default function TestComponent() {
  return <div>Test</div>;
}
