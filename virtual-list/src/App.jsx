import React from 'react';
import VirtualList from './components/VirtualList';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
    return (
        <ErrorBoundary>
            <div className="app-container">
                <VirtualList />
            </div>
        </ErrorBoundary>
    );
}

export default App;