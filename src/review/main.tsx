import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewApp } from './ReviewApp.tsx';
import './review.css';

const container = document.getElementById('review-root');
if (container === null) {
    throw new Error('review root missing');
}

createRoot(container).render(
    <StrictMode>
        <ReviewApp />
    </StrictMode>,
);
