import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnomalyCard from './AnomalyCard'

describe('AnomalyCard', () => {
  it('renders the category name and rounded percentage above average', () => {
    render(<AnomalyCard category="Food" mean={3000} current={6000} pctAboveAvg={99.17} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('+99% vs. usual')).toBeInTheDocument()
  })

  it('renders both the current and average amounts formatted as currency', () => {
    render(<AnomalyCard category="Shopping" mean={2000} current={8000} pctAboveAvg={300} />)
    expect(screen.getByText('₹8,000.00')).toBeInTheDocument()
    expect(screen.getByText(/avg ₹2,000\.00/)).toBeInTheDocument()
  })
})
