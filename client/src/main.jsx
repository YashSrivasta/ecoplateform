import React from 'react'; import { createRoot } from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx'; import { A11yProvider } from './a11y.jsx'; import './styles.css';
createRoot(document.getElementById('root')).render(<BrowserRouter><A11yProvider><App /></A11yProvider></BrowserRouter>);
