import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TagStudioApp } from './TagStudioApp.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('tag studio root is missing');
createRoot(root).render(<StrictMode><TagStudioApp /></StrictMode>);
