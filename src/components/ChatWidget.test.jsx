import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { insert, invoke } = vi.hoisted(() => ({ insert: vi.fn(), invoke: vi.fn() }))
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({ insert })),
    functions: { invoke },
  },
}))
vi.mock('../utils/imageResize', () => ({
  fileToResizedBase64: vi.fn(async () => ({ image: 'QUJD', mediaType: 'image/jpeg' })),
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

import ChatWidget from './ChatWidget'
import { supabase } from '../lib/supabaseClient'
import { todayISO } from '../utils/constants'

async function openAndSend(text) {
  render(<ChatWidget />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /open assistant/i }))
  await user.type(screen.getByLabelText(/message the assistant/i), text)
  await user.click(screen.getByRole('button', { name: 'Send' }))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  insert.mockResolvedValue({ error: null })
})

describe('ChatWidget', () => {
  it('turns "spent 450 on lunch" into a confirm card and saves nothing until confirmed', async () => {
    await openAndSend('spent 450 on lunch')
    expect(await screen.findByText('New expense')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(450)
    expect(screen.getByLabelText('Category')).toHaveValue('Food')
    expect(insert).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('inserts the expense for the signed-in user on Save and notifies the parent', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<ChatWidget onSaved={onSaved} />)
    await user.click(screen.getByRole('button', { name: /open assistant/i }))
    await user.type(screen.getByLabelText(/message the assistant/i), 'spent 450 on lunch')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument())
    expect(supabase.from).toHaveBeenCalledWith('expenses')
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u1', amount: 450, category: 'Food', description: 'Lunch', expense_date: todayISO(),
    })
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('saves income to the income table', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(screen.getByRole('button', { name: /open assistant/i }))
    await user.type(screen.getByLabelText(/message the assistant/i), 'received salary 50000')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith('income'))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', amount: 50000, source: 'Salary' }))
  })

  it('Discard saves nothing', async () => {
    const user = await openAndSend('spent 450 on lunch')
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(screen.getByText('Discarded')).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })

  it('shows the database error and lets the user retry', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'boom' } })
    const user = await openAndSend('spent 450 on lunch')
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('sends questions to the finance-chat function and shows the reply', async () => {
    invoke.mockResolvedValue({ data: { reply: 'You spent ₹2,000 on food.' }, error: null })
    render(<ChatWidget />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /open assistant/i }))
    await user.type(screen.getByLabelText(/message the assistant/i), 'How much did I spend on food?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('You spent ₹2,000 on food.')).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('finance-chat', {
      body: { messages: [{ role: 'user', content: 'How much did I spend on food?' }], today: todayISO() },
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('falls back gracefully when the function is not deployed', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request' } })
    await openAndSend('hello there')
    expect(await screen.findByText(/not deployed yet/i)).toBeInTheDocument()
  })

  it('shows the server-provided error message when there is one', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context: { json: async () => ({ error: 'Not signed in.' }) } } })
    await openAndSend('why is my food spend high?')
    expect(await screen.findByText('Not signed in.')).toBeInTheDocument()
  })

  it('lets the user correct a parsed entry before saving', async () => {
    const user = await openAndSend('spent 450 on lunch')
    const amount = await screen.findByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '480')
    await user.selectOptions(screen.getByLabelText('Category'), 'Transport')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(insert).toHaveBeenCalled())
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ amount: 480, category: 'Transport' }))
  })

  it('refuses to save a zero or empty amount', async () => {
    const user = await openAndSend('spent 450 on lunch')
    await user.clear(await screen.findByLabelText('Amount'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/greater than zero/i)).toBeInTheDocument()
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('ChatWidget receipt scanning', () => {
  const pickFile = async (user) => {
    await user.click(screen.getByRole('button', { name: /open assistant/i }))
    await user.upload(screen.getByTestId('receipt-input'), new File(['x'], 'bill.jpg', { type: 'image/jpeg' }))
  }

  it('sends the resized image to scan-receipt and shows an editable, labelled card', async () => {
    invoke.mockResolvedValue({
      data: { entry: { amount: 482.5, category: 'Food', description: 'Cafe Roma', date: '2026-11-10', dateFromReceipt: true } },
      error: null,
    })
    render(<ChatWidget />)
    await pickFile(userEvent.setup())

    expect(await screen.findByText(/from receipt, please check/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue(482.5)
    expect(screen.getByLabelText('Note')).toHaveValue('Cafe Roma')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-10')
    expect(invoke).toHaveBeenCalledWith('scan-receipt', {
      body: expect.objectContaining({ image: 'QUJD', mediaType: 'image/jpeg', today: todayISO(), categories: expect.arrayContaining(['Food', 'Other']) }),
    })
    expect(insert).not.toHaveBeenCalled() // scanning never saves by itself
  })

  it('warns when the receipt had no date', async () => {
    invoke.mockResolvedValue({ data: { entry: { amount: 99, category: 'Other', description: '', date: todayISO(), dateFromReceipt: false } }, error: null })
    render(<ChatWidget />)
    await pickFile(userEvent.setup())
    expect(await screen.findByText(/No date found on the receipt/i)).toBeInTheDocument()
  })

  it('shows the server message when the image is not a receipt', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context: { json: async () => ({ error: "Couldn't find a total on that image. Is it a receipt?" }) } } })
    render(<ChatWidget />)
    await pickFile(userEvent.setup())
    expect(await screen.findByText(/Is it a receipt/)).toBeInTheDocument()
  })

  it('falls back gracefully when scan-receipt is not deployed', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request' } })
    render(<ChatWidget />)
    await pickFile(userEvent.setup())
    expect(await screen.findByText(/receipt scanning is not deployed yet/i)).toBeInTheDocument()
  })
})
