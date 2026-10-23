import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import '@cloudscape-design/global-styles/index.css';
import './styles/theme.css';

// Suppress ResizeObserver warnings in development
const debounce = (callback, delay) => {
  let tid;
  return function (...args) {
    const ctx = this;
    tid && clearTimeout(tid);
    tid = setTimeout(() => {
      callback.apply(ctx, args);
    }, delay);
  };
};

const _ = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends _ {
  constructor(callback) {
    callback = debounce(callback, 20);
    super(callback);
  }
};

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
