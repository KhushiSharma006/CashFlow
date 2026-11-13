import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BudgetProgress from './BudgetProgress'

describe('BudgetProgress', () => {
  it('shows "On track" when well under budget', () => {
    render(<BudgetProgress category="Food" spent={1000} limit={5000} readOnly />)
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('shows "Near limit" between 80% and 100%', () => {
    render(<BudgetProgress category="Food" spent={4200} limit={5000} readOnly />)
    expect(screen.getByText('Near limit')).toBeInTheDocument()
  })

  it('shows "Over budget" at or above 100%', () => {
    render(<BudgetProgress category="Food" spent={5500} limit={5000} readOnly />)
    expect(screen.getByText('Over budget')).toBeInTheDocument()
  })

  it('displays the category name and formatted amounts', () => {
    render(<BudgetProgress category="Transport" spent={1200} limit={2000} readOnly />)
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('₹1,200.00')).toBeInTheDocument()
  })

  it('hides edit/remove controls when readOnly', () => {
    render(<BudgetProgress category="Food" spent={100} limit={5000} readOnly />)
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('shows edit/remove controls when not readOnly', () => {
    render(<BudgetProgress category="Food" spent={100} limit={5000} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })
})
