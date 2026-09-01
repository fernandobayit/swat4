import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Basic Setup Test', () => {
    it('renders a div component', () => {
        render(<div>Hello Frontend Testing</div>);
        expect(screen.getByText('Hello Frontend Testing')).toBeInTheDocument();
    });
});
